/**
 * The contract checker.
 *
 * Run from the repo root: bun scripts/audit/check-contracts.ts
 *
 * It reads the contracts from packages/types/src/contracts and the live code from disk. It
 * starts no server, needs no database and writes no file.
 *
 * The rules it enforces:
 *   ROUTE_NOT_FOUND               a route path named by a contract is not in the Hono route table
 *   STATUS_NOT_SETTABLE           a declared status is not in the model enum, or no route of the
 *                                 domain can write it
 *   STATUS_MISSING_ENTERED_BY     a status has no inbound trigger
 *   NEXT_ACTION_TARGET_NOT_FOUND  a next best action does not resolve to an admin page
 *   NOTIFICATION_NOT_IMPLEMENTED  a state change owes a notification the domain never sends
 *                                 (the route file and the modules it imports are searched)
 *   LAYOUT_ARCHETYPE_INVALID      the archetype is not one of the allowed archetypes
 *   LAYOUT_GRAMMAR_TOKEN_MISSING  a grammar token is not a component of apps/web/src/components/ui
 *
 * Findings that are listed in KNOWN_BASELINE (packages/types/src/contracts/baseline.ts) are
 * reported as BASELINE and do not fail the gate. They are not hidden: they are printed with
 * their reason, and they fail again as soon as the baseline entry is deleted.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KNOWN_BASELINE,
  LAYOUT_ARCHETYPES,
  ASSETS_CONTRACT,
  ATTENDANCE_CONTRACT,
  AUDIT_LOGS_CONTRACT,
  COMPLAINTS_CONTRACT,
  DASHBOARD_CONTRACT,
  ELECTRICITY_CONTRACT,
  ENQUIRIES_CONTRACT,
  EXPORT_CONTRACT,
  FLOORS_CONTRACT,
  GUARDIANS_CONTRACT,
  INVOICES_CONTRACT,
  LAUNDRY_CONTRACT,
  LEAVES_CONTRACT,
  MEALS_CONTRACT,
  MENUS_CONTRACT,
  NOTICES_CONTRACT,
  NOTIFICATIONS_CONTRACT,
  PAYMENTS_CONTRACT,
  ROOMS_CONTRACT,
  SERVICES_CONTRACT,
  TENANTS_CONTRACT,
  VISITORS_CONTRACT,
  WASHING_MACHINES_CONTRACT,
  type ContractRuleId,
  type KnownBaselineEntry,
  type ModuleContract,
} from '../../packages/types/src/contracts/index.ts';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const API_SRC_DIR = join(REPO_ROOT, 'apps/api/src');
const API_ROUTES_DIR = join(REPO_ROOT, 'apps/api/src/routes');
const API_MODELS_DIR = join(REPO_ROOT, 'apps/api/src/models');
const ADMIN_APP_DIR = join(REPO_ROOT, 'apps/web/src/app/(admin)');
const UI_COMPONENTS_DIR = join(REPO_ROOT, 'apps/web/src/components/ui');

/** A contract under check. The id is what the report and the baseline name it by. */
interface RegisteredContract {
  id: string;
  contract: ModuleContract;
}

/** Every contract under check. A rebuilt module is added here. */
const CONTRACTS: RegisteredContract[] = [
  { id: 'payments', contract: PAYMENTS_CONTRACT },
  { id: 'invoices', contract: INVOICES_CONTRACT },
  { id: 'tenants', contract: TENANTS_CONTRACT },
  { id: 'complaints', contract: COMPLAINTS_CONTRACT },
  { id: 'leaves', contract: LEAVES_CONTRACT },
  { id: 'visitors', contract: VISITORS_CONTRACT },
  { id: 'enquiries', contract: ENQUIRIES_CONTRACT },
  { id: 'electricity', contract: ELECTRICITY_CONTRACT },
  { id: 'rooms', contract: ROOMS_CONTRACT },
  { id: 'attendance', contract: ATTENDANCE_CONTRACT },
  { id: 'assets', contract: ASSETS_CONTRACT },
  { id: 'services', contract: SERVICES_CONTRACT },
  { id: 'notifications', contract: NOTIFICATIONS_CONTRACT },
  { id: 'notices', contract: NOTICES_CONTRACT },
  { id: 'meals', contract: MEALS_CONTRACT },
  { id: 'menus', contract: MENUS_CONTRACT },
  { id: 'laundry', contract: LAUNDRY_CONTRACT },
  { id: 'washing-machines', contract: WASHING_MACHINES_CONTRACT },
  { id: 'guardians', contract: GUARDIANS_CONTRACT },
  { id: 'floors', contract: FLOORS_CONTRACT },
  { id: 'audit-logs', contract: AUDIT_LOGS_CONTRACT },
  { id: 'export', contract: EXPORT_CONTRACT },
  { id: 'dashboard', contract: DASHBOARD_CONTRACT },
];

/** One broken rule. */
interface Finding {
  contract: string;
  rule: ContractRuleId;
  message: string;
}

/** The result of one rule for one contract. */
interface RuleOutcome {
  rule: ContractRuleId;
  checked: number;
  summary: string;
  findings: Finding[];
}

/** One registered route of the API. */
interface RouteEntry {
  method: string;
  path: string;
  file: string;
}

/** One page of the admin app. */
interface AdminRoute {
  segments: string[];
}

/** Prints a path relative to the repo root, with posix separators. */
function repoPath(absolute: string): string {
  return relative(REPO_ROOT, absolute).split(sep).join('/');
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
 * The app is never imported, so nothing is booted and no database is needed.
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

/** Collects every page of the admin app as a route pattern. */
function collectAdminRoutes(): AdminRoute[] {
  const routes: AdminRoute[] = [];
  if (!existsSync(ADMIN_APP_DIR)) return routes;

  const walk = (dir: string, segments: string[]): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const isGroup = entry.name.startsWith('(') && entry.name.endsWith(')');
        walk(full, isGroup ? segments : [...segments, entry.name]);
        continue;
      }
      if (entry.name !== 'page.tsx') continue;
      routes.push({ segments: [...segments] });
    }
  };

  walk(ADMIN_APP_DIR, []);
  return routes;
}

/** Lists the shared components of the admin app by name. */
function listUiComponents(): Set<string> {
  const names = new Set<string>();
  if (!existsSync(UI_COMPONENTS_DIR)) return names;
  for (const file of readdirSync(UI_COMPONENTS_DIR)) {
    if (!file.endsWith('.tsx')) continue;
    names.add(file.replace(/\.tsx$/, ''));
  }
  return names;
}

/** Finds the route file of a domain, ignoring case and separators. */
function resolveDomainRouteFile(domain: string): string | null {
  const wanted = domain.replace(/[^a-z0-9]/gi, '').toLowerCase();
  for (const file of readdirSync(API_ROUTES_DIR).sort()) {
    if (!file.endsWith('.ts')) continue;
    const name = file
      .replace(/\.ts$/, '')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase();
    if (name === wanted) return join(API_ROUTES_DIR, file);
  }
  return null;
}

/**
 * Finds the model file of a domain, ignoring case and separators.
 *
 * The domain is usually named after the route file (payments), while the model
 * is usually singular (payment.ts), so the singular and plural forms are both
 * tried. An explicit model name in the contract wins over the guess.
 */
function resolveDomainModelFile(domain: string, explicit?: string): string | null {
  const candidates = explicit === undefined || explicit === '' ? [domain] : [explicit];
  const guesses = [...candidates, ...candidates.map((name) => name.replace(/s$/, ''))];
  for (const candidate of guesses) {
    const wanted = candidate.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (wanted === '') continue;
    for (const file of readdirSync(API_MODELS_DIR).sort()) {
      if (!file.endsWith('.ts')) continue;
      const name = file
        .replace(/\.ts$/, '')
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase();
      if (name === wanted) return join(API_MODELS_DIR, file);
    }
  }
  return null;
}

/** Reads the status enum of a mongoose model. */
function parseModelStatusEnum(source: string): string[] {
  const pattern = /status\s*:\s*\{[^}]*?enum\s*:\s*\[(.*?)\]/s;
  const match = pattern.exec(source);
  if (match === null) return [];
  return [...(match[1] ?? '').matchAll(/'([^']+)'/g)].map((entry) => entry[1] ?? '');
}

/** Resolves a next best action target to an admin page. */
function resolveAdminTarget(target: string, routes: AdminRoute[]): AdminRoute | null {
  const clean = target.split('?')[0]?.split('#')[0]?.trim() ?? '';
  const segments = clean.split('/').filter((segment) => segment !== '');
  for (const route of routes) {
    if (route.segments.length !== segments.length) continue;
    let matches = true;
    for (let index = 0; index < segments.length; index++) {
      const pattern = route.segments[index] ?? '';
      const actual = segments[index] ?? '';
      if (/^\[.+\]$/.test(pattern)) continue;
      if (pattern !== actual) {
        matches = false;
        break;
      }
    }
    if (matches) return route;
  }
  return null;
}

/** Finds the baseline entry that covers a finding, if there is one. */
function findBaseline(contract: string, rule: ContractRuleId): KnownBaselineEntry | null {
  for (const entry of KNOWN_BASELINE) {
    if (entry.contract !== contract) continue;
    if (entry.rule === undefined || entry.rule === rule) return entry;
  }
  return null;
}

/**
 * Removes the definition of createNotification from a source.
 *
 * The mechanism itself lives in apps/api/src/services/notification.service.ts.
 * Counting that definition as a call would let every domain pass the rule
 * without sending anything, so only a call counts as an implementation.
 */
function stripNotificationDefinition(source: string): string {
  return source.replace(/function\s+createNotification\s*\(/g, 'function __createNotification(');
}

/** Resolves a relative import specifier to a TypeScript file of the API. */
function resolveRelativeImport(file: string, specifier: string): string | null {
  const base = resolve(dirname(file), specifier);
  const candidates = [base.replace(/\.js$/, '.ts'), `${base}.ts`];
  for (const candidate of candidates) {
    if (!candidate.startsWith(API_SRC_DIR)) continue;
    if (!existsSync(candidate)) continue;
    return candidate;
  }
  return null;
}

/**
 * Collects the source of a file and of the modules it imports, two levels deep.
 *
 * A domain may send its notification from a service instead of from its route
 * file: the invoice domain does, from apps/api/src/services/invoice.service.ts,
 * and its route file only calls the service. The rule has to see that call,
 * otherwise a module that really notifies is reported as one that does not.
 */
function collectModuleSources(file: string, depth = 2, seen = new Set<string>()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  const source = readText(file);
  if (source === null) return [];
  const sources = [source];
  if (depth <= 0) return sources;
  const importPattern = /from\s+'(\.[^']+)'|import\('(\.[^']+)'\)/g;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2] ?? '';
    if (specifier === '') continue;
    const resolved = resolveRelativeImport(file, specifier);
    if (resolved === null) continue;
    sources.push(...collectModuleSources(resolved, depth - 1, seen));
  }
  return sources;
}

/** Runs every rule against one contract. */
function checkContract(
  registered: RegisteredContract,
  routeTable: RouteEntry[],
  adminRoutes: AdminRoute[],
  uiComponents: Set<string>,
): RuleOutcome[] {
  const contract = registered.contract;
  const id = registered.id;
  const outcomes: RuleOutcome[] = [];

  const domain = contract.stateMachine?.domain ?? '';
  const statuses = contract.stateMachine?.statuses ?? [];
  const routeFile = domain === '' ? null : resolveDomainRouteFile(domain);
  const routeSource = routeFile === null ? null : readText(routeFile);
  const modelFile =
    domain === '' ? null : resolveDomainModelFile(domain, contract.stateMachine?.model);
  const modelSource = modelFile === null ? null : readText(modelFile);
  const modelPath = modelFile === null ? 'the model file' : repoPath(modelFile);
  const routePath = routeFile === null ? 'the route file' : repoPath(routeFile);

  // Rule: every route path named by the contract exists in the route table.
  const routeFindings: Finding[] = [];
  let routeChecked = 0;
  for (const status of statuses) {
    const entry = status.enteredBy;
    if (entry === undefined || entry.path === '') continue;
    routeChecked++;
    const candidates = routeTable.filter(
      (route) => normalizePath(route.path) === normalizePath(entry.path),
    );
    if (candidates.length === 0) {
      routeFindings.push({
        contract: id,
        rule: 'ROUTE_NOT_FOUND',
        message:
          `status "${status.status}" names route "${entry.method} ${entry.path}", ` +
          'which is not in the route table',
      });
      continue;
    }
    const method = entry.method.toUpperCase();
    if (!candidates.some((route) => route.method === method)) {
      routeFindings.push({
        contract: id,
        rule: 'ROUTE_NOT_FOUND',
        message:
          `status "${status.status}" names route "${entry.method} ${entry.path}", ` +
          `but that path is registered for ${candidates.map((route) => route.method).join(', ')}`,
      });
    }
  }
  const routeOk = routeChecked - routeFindings.length;
  outcomes.push({
    rule: 'ROUTE_NOT_FOUND',
    checked: routeChecked,
    summary: `${routeOk} of ${routeChecked} routes resolve in the route table`,
    findings: routeFindings,
  });

  // Rule: every declared status is in the model enum and writable by a route of the domain.
  const statusFindings: Finding[] = [];
  const modelStatuses = modelSource === null ? [] : parseModelStatusEnum(modelSource);
  for (const status of statuses) {
    if (modelSource === null || modelFile === null) {
      statusFindings.push({
        contract: id,
        rule: 'STATUS_NOT_SETTABLE',
        message: `the model of domain "${domain}" cannot be read, so status "${status.status}" cannot be checked`,
      });
      continue;
    }
    if (!modelStatuses.includes(status.status)) {
      statusFindings.push({
        contract: id,
        rule: 'STATUS_NOT_SETTABLE',
        message:
          `status "${status.status}" is not in the status enum of ${modelPath} ` +
          `(${modelStatuses.join(', ')})`,
      });
      continue;
    }
    if (routeSource === null) {
      statusFindings.push({
        contract: id,
        rule: 'STATUS_NOT_SETTABLE',
        message: `the route file of domain "${domain}" cannot be read, so status "${status.status}" cannot be checked`,
      });
      continue;
    }
    if (!routeSource.includes(`'${status.status}'`)) {
      statusFindings.push({
        contract: id,
        rule: 'STATUS_NOT_SETTABLE',
        message:
          `status "${status.status}" appears in the model but no route of ` +
          `${routePath} can write it`,
      });
    }
  }
  const statusOk = statuses.length - statusFindings.length;
  outcomes.push({
    rule: 'STATUS_NOT_SETTABLE',
    checked: statuses.length,
    summary: `${statusOk} of ${statuses.length} statuses are settable by a route`,
    findings: statusFindings,
  });

  // Rule: every status names the trigger that sets it.
  const triggerFindings: Finding[] = [];
  for (const status of statuses) {
    const entry = status.enteredBy;
    if (entry === undefined || entry.method === '' || entry.path === '') {
      triggerFindings.push({
        contract: id,
        rule: 'STATUS_MISSING_ENTERED_BY',
        message: `status "${status.status}" has no inbound trigger (method and path)`,
      });
    }
  }
  const triggerOk = statuses.length - triggerFindings.length;
  outcomes.push({
    rule: 'STATUS_MISSING_ENTERED_BY',
    checked: statuses.length,
    summary: `${triggerOk} of ${statuses.length} statuses name a trigger`,
    findings: triggerFindings,
  });

  // Rule: every next best action resolves to an admin page.
  const actionFindings: Finding[] = [];
  const perStatus = Object.entries(contract.nextBestAction?.perStatus ?? {});
  const perEmptyState = Object.entries(contract.nextBestAction?.perEmptyState ?? {});
  const actions = [...perStatus, ...perEmptyState];
  for (const [key, action] of actions) {
    const target = action?.target ?? '';
    if (target === '') {
      actionFindings.push({
        contract: id,
        rule: 'NEXT_ACTION_TARGET_NOT_FOUND',
        message: `the next best action "${key}" has no target`,
      });
      continue;
    }
    if (resolveAdminTarget(target, adminRoutes) === null) {
      actionFindings.push({
        contract: id,
        rule: 'NEXT_ACTION_TARGET_NOT_FOUND',
        message: `the next best action "${key}" points at "${target}", which is not a page of the admin app`,
      });
    }
  }
  const actionOk = actions.length - actionFindings.length;
  outcomes.push({
    rule: 'NEXT_ACTION_TARGET_NOT_FOUND',
    checked: actions.length,
    summary: `${actionOk} of ${actions.length} targets resolve to an admin page`,
    findings: actionFindings,
  });

  // Rule: a state change that owes a notification is actually sent by the domain.
  const notificationFindings: Finding[] = [];
  const truthEntries = contract.truthContract ?? [];
  let notificationChecked = 0;
  // The domain sends a notification from its route file or from one of the
  // modules that route file imports.
  const domainSources = routeFile === null ? [] : collectModuleSources(routeFile);
  const domainSendsNotification = domainSources.some((source) =>
    /\bcreateNotification\s*\(/.test(stripNotificationDefinition(source)),
  );
  for (const entry of truthEntries) {
    if (entry?.notification?.required !== true) continue;
    notificationChecked++;
    if (routeFile === null || routeSource === null) {
      notificationFindings.push({
        contract: id,
        rule: 'NOTIFICATION_NOT_IMPLEMENTED',
        message:
          `the action "${entry.action}" owes a notification but the route file of domain ` +
          `"${domain}" cannot be read`,
      });
      continue;
    }
    if (!domainSendsNotification) {
      notificationFindings.push({
        contract: id,
        rule: 'NOTIFICATION_NOT_IMPLEMENTED',
        message:
          `the action "${entry.action}" owes a ${entry.notification.to} notification ` +
          `of type "${entry.notification.type}", but neither ${routePath} nor the modules it ` +
          `imports calls createNotification`,
      });
    }
  }
  const notificationOk = notificationChecked - notificationFindings.length;
  outcomes.push({
    rule: 'NOTIFICATION_NOT_IMPLEMENTED',
    checked: notificationChecked,
    summary: `${notificationOk} of ${notificationChecked} owed notifications are sent`,
    findings: notificationFindings,
  });

  // Rule: the archetype is one of the allowed archetypes.
  const archetypeFindings: Finding[] = [];
  const archetype = contract.layout?.archetype;
  const allowed: readonly string[] = LAYOUT_ARCHETYPES;
  if (archetype === undefined || archetype === '') {
    archetypeFindings.push({
      contract: id,
      rule: 'LAYOUT_ARCHETYPE_INVALID',
      message: 'the module declares no layout archetype',
    });
  } else if (!allowed.includes(archetype)) {
    archetypeFindings.push({
      contract: id,
      rule: 'LAYOUT_ARCHETYPE_INVALID',
      message: `the archetype "${archetype}" is not one of ${allowed.join(', ')}`,
    });
  }
  outcomes.push({
    rule: 'LAYOUT_ARCHETYPE_INVALID',
    checked: 1,
    summary: `the archetype "${archetype ?? ''}" is allowed`,
    findings: archetypeFindings,
  });

  // Rule: every grammar token is a component of the shared ui folder.
  const tokenFindings: Finding[] = [];
  const tokens = contract.layout?.grammarTokens ?? [];
  for (const token of tokens) {
    if (!uiComponents.has(token)) {
      tokenFindings.push({
        contract: id,
        rule: 'LAYOUT_GRAMMAR_TOKEN_MISSING',
        message: `the grammar token "${token}" is not a component of apps/web/src/components/ui`,
      });
    }
  }
  const tokenOk = tokens.length - tokenFindings.length;
  outcomes.push({
    rule: 'LAYOUT_GRAMMAR_TOKEN_MISSING',
    checked: tokens.length,
    summary: `${tokenOk} of ${tokens.length} grammar tokens exist`,
    findings: tokenFindings,
  });

  return outcomes;
}

/** Prints the report and returns the number of failures. */
function printReport(
  results: { id: string; outcomes: RuleOutcome[] }[],
  baselineByFinding: Map<Finding, KnownBaselineEntry>,
): number {
  console.log('Contract check (packages/types/src/contracts)');
  console.log(
    'Baseline note: findings covered by KNOWN_BASELINE are reported as BASELINE and do not fail the gate.',
  );
  console.log('');

  let failureCount = 0;
  let baselineCount = 0;

  for (const result of results) {
    console.log(result.id);
    for (const outcome of result.outcomes) {
      const failed = outcome.findings.filter((finding) => !baselineByFinding.has(finding));
      const baselined = outcome.findings.filter((finding) => baselineByFinding.has(finding));
      failureCount += failed.length;
      baselineCount += baselined.length;
      if (failed.length > 0) {
        for (const finding of failed) {
          console.log(`    [FAIL]     ${finding.rule}  ${finding.message}`);
        }
        continue;
      }
      if (baselined.length > 0) {
        const finding = baselined[0];
        if (finding !== undefined) {
          const entry = baselineByFinding.get(finding);
          console.log(`    [BASELINE] ${finding.rule}  ${finding.message}`);
          console.log(`               baseline: ${entry?.reason ?? 'no reason given'}`);
        }
        continue;
      }
      console.log(`    [ok]       ${outcome.rule}  ${outcome.summary}`);
    }
    console.log('');
  }

  if (failureCount > 0) {
    console.log(`FAILURES (${failureCount})`);
    for (const result of results) {
      for (const outcome of result.outcomes) {
        for (const finding of outcome.findings) {
          if (baselineByFinding.has(finding)) continue;
          console.log(`  ${finding.contract} / ${finding.rule}: ${finding.message}`);
        }
      }
    }
    console.log('');
  }

  console.log(
    `Summary: ${results.length} contract(s), ${failureCount} failure(s), ${baselineCount} known baseline(s)`,
  );
  return failureCount;
}

function main(): void {
  const routeTable = buildRouteTable();
  const adminRoutes = collectAdminRoutes();
  const uiComponents = listUiComponents();

  const results = CONTRACTS.map((registered) => ({
    id: registered.id,
    outcomes: checkContract(registered, routeTable, adminRoutes, uiComponents),
  }));

  const baselineByFinding = new Map<Finding, KnownBaselineEntry>();
  for (const result of results) {
    for (const outcome of result.outcomes) {
      for (const finding of outcome.findings) {
        const entry = findBaseline(finding.contract, finding.rule);
        if (entry !== null) baselineByFinding.set(finding, entry);
      }
    }
  }

  const failures = printReport(results, baselineByFinding);
  process.exitCode = failures > 0 ? 1 : 0;
}

main();
