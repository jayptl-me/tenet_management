/**
 * Generates the Dart side of the lifecycle vocabulary.
 *
 * Run from the repo root: bun run gen:lifecycle
 *
 * Dart cannot import TypeScript, so the one vocabulary lives in
 * packages/types/src/lifecycle.json and is emitted here for the Flutter portal. The admin panel
 * reads the same JSON through packages/types/src/lifecycle.ts.
 *
 * The script reads one file and writes one file. It starts no server, needs no database and
 * writes nothing else.
 *
 * scripts/audit/check-lifecycle-parity.ts regenerates the same output in memory and fails when
 * the file on disk has drifted, so the two clients cannot drift apart.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const JSON_PATH = join(REPO_ROOT, 'packages/types/src/lifecycle.json');
const DART_PATH = join(REPO_ROOT, 'mobile/lib/core/models/lifecycle.dart');

/** One step of the vocabulary, as it is written in the JSON. */
export interface LifecycleStepJson {
  key: string;
  label: string;
  endpoint: string;
  actor: string;
  allowedNext: string[];
}

/** One domain of the vocabulary, as it is written in the JSON. */
export interface LifecycleDomainJson {
  kind: string;
  label: string;
  steps: LifecycleStepJson[];
}

/** The whole vocabulary, as it is written in the JSON. */
export type LifecycleJson = Record<string, LifecycleDomainJson>;

/**
 * The Dart preamble. It is fixed text: the classes and the derivation rules the two clients share
 * (the linear path, the branches and the anchor of a branch).
 */
const DART_PREAMBLE = `// GENERATED FILE - DO NOT EDIT BY HAND.
//
// Source: packages/types/src/lifecycle.json
// Regenerate: bun run gen:lifecycle
//
// The admin panel reads the same JSON through packages/types/src/lifecycle.ts, so the portal and
// the admin panel render one vocabulary. scripts/audit/check-lifecycle-parity.ts fails the build
// when this file drifts from the source.
//
// ignore_for_file: lines_longer_than_80_chars

/// One state of one domain.
class LifecycleStep {
  const LifecycleStep({
    required this.key,
    required this.label,
    required this.endpoint,
    required this.actor,
    required this.allowedNext,
  });

  /// The status key exactly as the API writes it.
  final String key;

  /// The human label of the state.
  final String label;

  /// The API route that writes this status, or "SERVICE <path>" when a shared service writes it.
  final String endpoint;

  /// The role that performs the transition.
  final String actor;

  /// The status keys that may follow this one.
  final List<String> allowedNext;
}

/// The lifecycle of one domain.
class LifecycleDomain {
  const LifecycleDomain({
    required this.kind,
    required this.label,
    required this.steps,
  });

  /// "ladder" for a progression, "grid" for a set of states with no path between them.
  final String kind;

  /// The human label of the domain.
  final String label;

  /// The states, ordered so that the linear path comes first.
  final List<LifecycleStep> steps;

  /// The linear path of the domain.
  List<LifecycleStep> get spine {
    if (kind == 'grid') return List<LifecycleStep>.of(steps);
    final List<LifecycleStep> path = <LifecycleStep>[];
    for (final LifecycleStep step in steps) {
      if (path.isEmpty) {
        path.add(step);
        continue;
      }
      if (!path.last.allowedNext.contains(step.key)) break;
      path.add(step);
    }
    return path;
  }

  /// The states that are not on the linear path.
  List<LifecycleStep> get branches {
    final Set<String> onPath = <String>{};
    for (final LifecycleStep step in spine) {
      onPath.add(step.key);
    }
    final List<LifecycleStep> result = <LifecycleStep>[];
    for (final LifecycleStep step in steps) {
      if (!onPath.contains(step.key)) result.add(step);
    }
    return result;
  }

  /// The index of the step a branch hangs off.
  int anchorIndex(String branchKey) {
    final List<LifecycleStep> path = spine;
    for (int index = 1; index < path.length; index++) {
      if (path[index].allowedNext.contains(branchKey)) return index;
    }
    return 0;
  }
}

/// Every lifecycle, keyed by domain.
const Map<String, LifecycleDomain> lifecycleDomains = <String, LifecycleDomain>{`;

/** Reads the vocabulary from disk. */
export function readLifecycleJson(path: string = JSON_PATH): LifecycleJson {
  return JSON.parse(readFileSync(path, 'utf8')) as LifecycleJson;
}

/** Quotes a value as a Dart string literal. */
function dartString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Renders one step. */
function renderStep(step: LifecycleStepJson): string[] {
  const allowed = step.allowedNext.map((key) => dartString(key)).join(', ');
  return [
    '      LifecycleStep(',
    `        key: ${dartString(step.key)},`,
    `        label: ${dartString(step.label)},`,
    `        endpoint: ${dartString(step.endpoint)},`,
    `        actor: ${dartString(step.actor)},`,
    `        allowedNext: <String>[${allowed}],`,
    '      ),',
  ];
}

/** Renders one domain. */
function renderDomain(name: string, domain: LifecycleDomainJson): string[] {
  const lines = [
    `  ${dartString(name)}: LifecycleDomain(`,
    `    kind: ${dartString(domain.kind)},`,
    `    label: ${dartString(domain.label)},`,
    '    steps: <LifecycleStep>[',
  ];
  for (const step of domain.steps) {
    lines.push(...renderStep(step));
  }
  lines.push('    ],', '  ),');
  return lines;
}

/** Renders the whole Dart file. */
export function renderDart(json: LifecycleJson): string {
  const lines: string[] = [DART_PREAMBLE];
  for (const [name, domain] of Object.entries(json)) {
    lines.push(...renderDomain(name, domain));
  }
  lines.push('};', '');
  return lines.join('\n');
}

/** Writes the Dart file. */
export function writeDart(content: string, path: string = DART_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

function main(): void {
  const content = renderDart(readLifecycleJson());
  writeDart(content);
  console.log(`Wrote ${relative(REPO_ROOT, DART_PATH)}`);
}

const invokedDirectly =
  process.argv[1] !== undefined && process.argv[1].endsWith('gen-lifecycle-dart.ts');
if (invokedDirectly) {
  main();
}
