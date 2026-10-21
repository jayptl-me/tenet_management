/**
 * The lifecycle parity checker.
 *
 * Run from the repo root: bun run check:lifecycle
 *
 * Two jobs:
 *
 *   1. Regenerate the Dart lifecycle in memory and compare it with the file on disk. Dart cannot
 *      import TypeScript, so the portal and the admin panel read the same JSON by two routes. If
 *      the generated file drifts, the portal renders a vocabulary the admin panel no longer has,
 *      which is exactly the failure this checker exists to kill.
 *   2. Validate the JSON against the code. A vocabulary that names a status the model does not
 *      have, or a route that does not exist, is a lie that both clients would repeat.
 *
 * The rules it enforces:
 *   DART_LIFECYCLE_STALE   the generated Dart file does not match the JSON
 *   DOMAIN_MALFORMED       a domain is missing a field or uses an unknown value
 *   STATUS_NOT_IN_MODEL    a step key is not a status the model allows
 *   STATUS_NOT_COVERED     a status the model allows has no step
 *   ALLOWED_NEXT_UNKNOWN   an allowedNext entry is not a key of the same domain
 *   ENDPOINT_NOT_FOUND     an endpoint is neither a route of the API nor a service file
 *
 * It reads files and starts nothing: no server, no database, no network.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLifecycleJson, renderDart, type LifecycleJson } from './gen-lifecycle-dart.ts';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const API_ROUTES_DIR = join(REPO_ROOT, 'apps/api/src/routes');
const API_MODELS_DIR = join(REPO_ROOT, 'apps/api/src/models');
const JSON_PATH = join(REPO_ROOT, 'packages/types/src/lifecycle.json');
const DART_PATH = join(REPO_ROOT, 'mobile/lib/core/models/lifecycle.dart');

/** The actors a transition can belong to. */
const ACTORS = ['admin', 'tenant', 'guardian', 'visitor', 'system'];

/** The kinds a domain can declare. */
const KINDS = ['ladder', 'grid'];

/** The model file that owns the status union of each domain. */
const DOMAIN_MODELS: Record<string, string> = {
  payment: 'payment.ts',
  invoice: 'invoice.ts',
  complaint: 'complaint.ts',
  leave: 'leaveApplication.ts',
  visitor: 'visitor.ts',
  enquiry: 'enquiry.ts',
};

/** One registered route of the API. */
interface RouteEntry {
  method: string;
  path: string;
  file: string;
}

/** One broken rule. */
interface Finding {
  rule: string;
  message: string;
}

/** Reads a file, or returns null when it is not there. */
function readText(path: string): string | null {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

/** Normalises a path so that /payments and /payments/ are the same route. */
function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** Joins a mount path and a route path the way the API serves it. */
function joinPath(mount: string, path: string): string {
  const base = mount.replace(/\/+$/, '');
  const tail = path.replace(/^\/+/, '');
  if (tail === '') return base === '' ? '/' : base;
  return `${base}/${tail}`;
}

/**
 * Builds the route table of the API by reading apps/api/src/index.ts and every route file.
 * The app is never imported, so nothing is booted and no database is needed. The technique is the
 * one scripts/audit/check-contracts.ts uses.
 */
function buildRouteTable(): RouteEntry[] {
  const indexSource = readText(join(REPO_ROOT, 'apps/api/src/index.ts')) ?? '';

  const aliasToFile = new Map<string, string>();
  const importPattern = /import\s+(\w+)\s+from\s+'\.\/routes\/([A-Za-z0-9_]+)\.js'/g;
  for (const match of indexSource.matchAll(importPattern)) {
    aliasToFile.set(match[1] ?? '', match[2] ?? '');
  }

  const mountsByFile = new Map<string, string[]>();
  const mountPattern = /api\.route\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g;
  for (const match of indexSource.matchAll(mountPattern)) {
    const file = aliasToFile.get(match[2] ?? '');
    if (file === undefined || file === '') continue;
    const mounts = mountsByFile.get(file) ?? [];
    mounts.push(match[1] ?? '');
    mountsByFile.set(file, mounts);
  }

  const entries: RouteEntry[] = [];
  for (const file of readdirSync(API_ROUTES_DIR).sort()) {
    if (!file.endsWith('.ts')) continue;
    const source = readText(join(API_ROUTES_DIR, file));
    if (source === null) continue;

    const routerNames = new Set<string>();
    const routerPattern = /const\s+(\w+)\s*=\s*new\s+Hono\b/g;
    for (const match of source.matchAll(routerPattern)) {
      routerNames.add(match[1] ?? '');
    }
    if (routerNames.size === 0) continue;

    const mounts = mountsByFile.get(file.replace(/\.ts$/, '')) ?? [''];
    const routePattern = /\b(\w+)\.(get|post|put|patch|delete|options|all)\(\s*'([^']*)'/g;
    for (const match of source.matchAll(routePattern)) {
      const router = match[1] ?? '';
      if (!routerNames.has(router)) continue;
      const method = (match[2] ?? '').toUpperCase();
      const path = match[3] ?? '';
      for (const mount of mounts) {
        entries.push({ method, path: joinPath(mount, path), file });
      }
    }
  }
  return entries;
}

/** Reads the status enum of a mongoose model. */
function parseModelStatusEnum(source: string): string[] {
  const pattern = /status\s*:\s*\{[^}]*?enum\s*:\s*\[(.*?)\]/s;
  const match = pattern.exec(source);
  if (match === null) return [];
  return [...(match[1] ?? '').matchAll(/'([^']+)'/g)].map((entry) => entry[1] ?? '');
}

/** The endpoint of a step, parsed into the two shapes the vocabulary allows. */
type ParsedEndpoint =
  | { kind: 'route'; method: string; path: string }
  | { kind: 'service'; path: string }
  | { kind: 'unknown' };

/** Parses "METHOD /path" and "SERVICE path". */
function parseEndpoint(endpoint: string): ParsedEndpoint {
  const serviceMatch = /^SERVICE\s+(\S+)$/.exec(endpoint);
  if (serviceMatch !== null) {
    return { kind: 'service', path: serviceMatch[1] ?? '' };
  }
  const routeMatch = /^([A-Z]+)\s+(\/\S*)$/.exec(endpoint);
  if (routeMatch !== null) {
    return { kind: 'route', method: routeMatch[1] ?? '', path: routeMatch[2] ?? '' };
  }
  return { kind: 'unknown' };
}

/** Checks one endpoint against the route table and the service files. */
function checkEndpoint(endpoint: string, routeTable: RouteEntry[], findings: Finding[]): void {
  const parsed = parseEndpoint(endpoint);
  if (parsed.kind === 'unknown') {
    findings.push({
      rule: 'ENDPOINT_NOT_FOUND',
      message: `endpoint "${endpoint}" is neither "METHOD /path" nor "SERVICE <path>"`,
    });
    return;
  }
  if (parsed.kind === 'service') {
    if (!existsSync(join(REPO_ROOT, parsed.path))) {
      findings.push({
        rule: 'ENDPOINT_NOT_FOUND',
        message: `endpoint "${endpoint}" names a service file that does not exist`,
      });
    }
    return;
  }
  const candidates = routeTable.filter(
    (route) => normalizePath(route.path) === normalizePath(parsed.path),
  );
  if (candidates.length === 0) {
    findings.push({
      rule: 'ENDPOINT_NOT_FOUND',
      message: `endpoint "${endpoint}" is not in the route table of the API`,
    });
    return;
  }
  if (!candidates.some((route) => route.method === parsed.method)) {
    findings.push({
      rule: 'ENDPOINT_NOT_FOUND',
      message:
        `endpoint "${endpoint}" is registered for ` +
        `${candidates.map((route) => route.method).join(', ')}, not for ${parsed.method}`,
    });
  }
}

/** Checks the vocabulary against the models and the routes. */
function checkVocabulary(json: LifecycleJson, routeTable: RouteEntry[]): Finding[] {
  const findings: Finding[] = [];
  const domains = Object.entries(json);

  if (domains.length === 0) {
    findings.push({ rule: 'DOMAIN_MALFORMED', message: 'the vocabulary has no domain' });
    return findings;
  }

  for (const [domain, spec] of domains) {
    if (!KINDS.includes(spec.kind)) {
      const kinds = KINDS.join(', ');
      findings.push({
        rule: 'DOMAIN_MALFORMED',
        message: `domain "${domain}" declares the kind "${spec.kind}", expected ${kinds}`,
      });
    }
    if (spec.label.trim() === '') {
      findings.push({
        rule: 'DOMAIN_MALFORMED',
        message: `domain "${domain}" has no label`,
      });
    }
    if (spec.steps.length === 0) {
      findings.push({
        rule: 'DOMAIN_MALFORMED',
        message: `domain "${domain}" has no step`,
      });
      continue;
    }

    const modelFile = DOMAIN_MODELS[domain];
    if (modelFile === undefined) {
      findings.push({
        rule: 'DOMAIN_MALFORMED',
        message: `domain "${domain}" has no model in this checker`,
      });
      continue;
    }
    const modelSource = readText(join(API_MODELS_DIR, modelFile));
    if (modelSource === null) {
      findings.push({
        rule: 'DOMAIN_MALFORMED',
        message: `the model of domain "${domain}" (${modelFile}) cannot be read`,
      });
      continue;
    }
    const modelStatuses = parseModelStatusEnum(modelSource);
    const keys = spec.steps.map((step) => step.key);

    for (const step of spec.steps) {
      if (keys.filter((key) => key === step.key).length > 1) {
        findings.push({
          rule: 'DOMAIN_MALFORMED',
          message: `domain "${domain}" declares the key "${step.key}" twice`,
        });
      }
      if (!modelStatuses.includes(step.key)) {
        findings.push({
          rule: 'STATUS_NOT_IN_MODEL',
          message:
            `step "${step.key}" of domain "${domain}" is not a status of ` +
            `${modelFile} (${modelStatuses.join(', ')})`,
        });
      }
      if (step.label.trim() === '') {
        findings.push({
          rule: 'DOMAIN_MALFORMED',
          message: `step "${step.key}" of domain "${domain}" has no label`,
        });
      }
      if (!ACTORS.includes(step.actor)) {
        findings.push({
          rule: 'DOMAIN_MALFORMED',
          message:
            `step "${step.key}" of domain "${domain}" declares the actor "${step.actor}", ` +
            `expected one of ${ACTORS.join(', ')}`,
        });
      }
      for (const next of step.allowedNext) {
        if (!keys.includes(next)) {
          findings.push({
            rule: 'ALLOWED_NEXT_UNKNOWN',
            message:
              `step "${step.key}" of domain "${domain}" allows the next status "${next}", ` +
              'which is not a key of that domain',
          });
        }
      }
      checkEndpoint(step.endpoint, routeTable, findings);
    }

    for (const status of modelStatuses) {
      if (!keys.includes(status)) {
        findings.push({
          rule: 'STATUS_NOT_COVERED',
          message: `status "${status}" of ${modelFile} has no step in domain "${domain}"`,
        });
      }
    }
  }

  return findings;
}

/** Prints the report and returns the number of failures. */
function printReport(findings: Finding[], dartStale: boolean): number {
  console.log('Lifecycle check (packages/types/src/lifecycle.json)');
  console.log('');

  let failureCount = 0;

  if (dartStale) {
    failureCount++;
    console.log('    [FAIL] DART_LIFECYCLE_STALE  mobile/lib/core/models/lifecycle.dart');
    console.log('               the Dart lifecycle is stale, run bun run gen:lifecycle');
  } else {
    console.log('    [ok]   DART_LIFECYCLE_STALE  the Dart lifecycle matches the JSON');
  }

  if (findings.length === 0) {
    console.log('    [ok]   VOCABULARY            every domain matches the models and the routes');
  } else {
    for (const finding of findings) {
      console.log(`    [FAIL] ${finding.rule}  ${finding.message}`);
    }
    failureCount += findings.length;
  }

  console.log('');
  console.log(`Summary: ${failureCount} failure(s)`);
  return failureCount;
}

function main(): void {
  const json = readLifecycleJson(JSON_PATH);
  const expected = renderDart(json);
  const onDisk = readText(DART_PATH);
  const dartStale = onDisk === null || onDisk !== expected;

  const routeTable = buildRouteTable();
  const findings = checkVocabulary(json, routeTable);
  const failures = printReport(findings, dartStale);
  process.exitCode = failures > 0 ? 1 : 0;
}

main();
