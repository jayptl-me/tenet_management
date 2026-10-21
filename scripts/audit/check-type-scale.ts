/**
 * The type-scale guard.
 *
 * Run from the repo root: bun scripts/audit/check-type-scale.ts
 *
 * It reads the admin app from disk. It starts no server, needs no database and writes no file.
 *
 * The rules it enforces:
 *   TEXT_SIZE  a class sizes text with a raw pixel value (text-[13px]). The app has ONE scale,
 *              declared in apps/web/src/app/globals.css, with a token for every size it uses,
 *              so an arbitrary value is a second scale.
 *   PX_DIM     a width, height, gap, inset or radius is a raw pixel value where a token, a grid
 *              or a flex rule does the same job.
 *   CSS_SMALL  a --text-* token renders below 10px, which is illegible.
 *   CSS_ALIAS  a semantic name (--text-xs, --text-sm, ...) does not render at the size of the
 *              canonical token it aliases, so the two scales have drifted apart again.
 *
 * Findings that are listed in ALLOWLIST are reported as BASELINE and do not fail the gate. They
 * are not hidden: every one is printed with its file, its line and its reason, and it fails again
 * as soon as the allowlist entry is deleted. The allowlist is a ratchet: it only tightens when
 * somebody removes the code it excuses.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ADMIN_SRC = join(REPO_ROOT, 'apps/web/src');

/** The smallest font size the admin app is allowed to render. */
const MIN_TEXT_PX = 10;

/** The rules the guard enforces. */
type RuleId = 'TEXT_SIZE' | 'PX_DIM' | 'CSS_SMALL' | 'CSS_ALIAS';

/** The rules an allowlist entry may excuse. */
type AllowlistableRule = 'TEXT_SIZE' | 'PX_DIM';

/** One thing the guard found. */
interface Finding {
  /** Path relative to apps/web/src, with posix separators. */
  file: string;
  line: number;
  rule: RuleId;
  token: string;
  detail: string;
  /** True when the text renders below 10px, which is illegible. */
  illegible: boolean;
  /** True when an allowlist entry may excuse this finding. */
  allowlistable: boolean;
}

/** One excused finding: a file may hold at most `count` occurrences of `token`. */
type AllowlistEntry = readonly [
  file: string,
  rule: AllowlistableRule,
  token: string,
  count: number,
  reason: string,
];

/** A --text-* declaration of one stylesheet. */
interface CssDeclaration {
  value: string;
  line: number;
}

/** One stylesheet and the --text-* tokens it declares. */
interface Stylesheet {
  file: string;
  tokens: Map<string, CssDeclaration[]>;
}

// --- The allowlist ---
// Every entry is one line of debt that survived the sweep: the file, the rule, the exact
// token, how many of it the file may hold, and why it is still there. Paths are relative to
// apps/web/src. A new occurrence of an allowlisted token fails the gate.

// The admin pages keep pinned table columns and fixed filter widths.
const R_PAGE = 'fixed px width in an admin page; the page sweep is owned by another unit';
// Pixel decisions that a token cannot express.
const R_CONNECTOR = 'pixel decision: the connector sits on the centre of the 32px icon box';
const R_BED_MIN_W = 'pixel decision: 90px is not on the 4px grid and the bar must not squash';
const R_BED_RADIUS = 'pixel decision: 3px radius on a bed cell, the nearest token is 4px';
const R_BADGE_MIN_W = 'pixel decision: the badge floor is one mono digit wide at 10px';
const R_SWATCH_RADIUS = 'pixel decision: 2px radius on the legend swatch';
const R_TOOLTIP_MIN_W = 'pixel decision: the 130px tooltip floor is not on the 4px spacing grid';
const R_TIMELINE_RULE = 'pixel decision: the rule is centred on the 10px dot';
const R_TIMELINE_DOT = 'pixel decision: the dot sits on the rule beside it';
// The admin page sweep kept the widths that are not on the 4px grid, and the one that tracks
// a chart height set in pixels by a prop.
const R_ACTIONS_COL =
  'pixel decision: the actions column is 130px, the width the row buttons need, and 130px is not on the 4px grid';
const R_COL_90 = 'pixel decision: the details column is 90px, not on the 4px grid';
const R_FILTER_190 = 'pixel decision: the filter control is 190px, not on the 4px grid';
const R_FILTER_170 = 'pixel decision: the filter control is 170px, not on the 4px grid';
const R_FILTER_150 = 'pixel decision: the filter control is 150px, not on the 4px grid';
const R_TRUNCATE_250 = 'pixel decision: the notice body truncates at 250px, not on the 4px grid';
const R_CHART_HEIGHT =
  'pixel decision: the loading box of the trend chart, whose height is the LineChart height prop';

const ALLOWLIST: readonly AllowlistEntry[] = [
  ['app/(admin)/attendance/page.tsx', 'PX_DIM', 'max-w-[200px]', 2, R_PAGE],
  ['app/(admin)/attendance/page.tsx', 'PX_DIM', 'max-w-[320px]', 1, R_PAGE],
  ['app/(admin)/attendance/page.tsx', 'PX_DIM', 'min-w-[240px]', 1, R_PAGE],
  ['app/(admin)/attendance/page.tsx', 'PX_DIM', 'w-[130px]', 1, R_PAGE],
  ['app/(admin)/audit-logs/page.tsx', 'PX_DIM', 'w-[190px]', 2, R_FILTER_190],
  ['app/(admin)/audit-logs/page.tsx', 'PX_DIM', 'w-[90px]', 1, R_COL_90],
  ['app/(admin)/complaints/page.tsx', 'PX_DIM', 'w-[150px]', 1, R_FILTER_150],
  ['app/(admin)/dashboard/page.tsx', 'PX_DIM', 'max-h-[160px]', 1, R_PAGE],
  ['app/(admin)/electricity/page.tsx', 'PX_DIM', 'w-[130px]', 1, R_ACTIONS_COL],
  ['app/(admin)/enquiries/page.tsx', 'PX_DIM', 'w-[130px]', 1, R_ACTIONS_COL],
  ['app/(admin)/floors/page.tsx', 'PX_DIM', 'w-[130px]', 1, R_ACTIONS_COL],
  ['app/(admin)/guardians/page.tsx', 'PX_DIM', 'w-[130px]', 1, R_ACTIONS_COL],
  ['app/(admin)/invoices/page.tsx', 'PX_DIM', 'h-[160px]', 1, R_CHART_HEIGHT],
  ['app/(admin)/invoices/page.tsx', 'PX_DIM', 'w-[130px]', 1, R_ACTIONS_COL],
  ['app/(admin)/invoices/page.tsx', 'PX_DIM', 'w-[170px]', 1, R_FILTER_170],
  ['app/(admin)/meals/page.tsx', 'PX_DIM', 'w-[130px]', 1, R_ACTIONS_COL],
  ['app/(admin)/meals/page.tsx', 'PX_DIM', 'w-[170px]', 1, R_FILTER_170],
  ['app/(admin)/menus/page.tsx', 'PX_DIM', 'w-[130px]', 1, R_ACTIONS_COL],
  ['app/(admin)/notices/page.tsx', 'PX_DIM', 'max-w-[250px]', 1, R_TRUNCATE_250],
  ['app/(admin)/notices/page.tsx', 'PX_DIM', 'w-[130px]', 1, R_ACTIONS_COL],
  ['app/(admin)/notifications/page.tsx', 'PX_DIM', 'w-[130px]', 1, R_ACTIONS_COL],
  ['app/(admin)/tenants/page.tsx', 'PX_DIM', 'w-[130px]', 1, R_ACTIONS_COL],
  ['components/ui/AssetVisuals.tsx', 'PX_DIM', 'left-[15px]', 1, R_CONNECTOR],
  ['components/ui/AssetVisuals.tsx', 'PX_DIM', 'top-[15px]', 1, R_CONNECTOR],
  ['components/ui/BedMiniGrid.tsx', 'PX_DIM', 'min-w-[90px]', 1, R_BED_MIN_W],
  ['components/ui/BedMiniGrid.tsx', 'PX_DIM', 'rounded-[3px]', 1, R_BED_RADIUS],
  ['components/ui/FloorServiceGrid.tsx', 'PX_DIM', 'min-w-[14px]', 1, R_BADGE_MIN_W],
  ['components/ui/HeatmapCalendar.tsx', 'PX_DIM', 'rounded-[2px]', 1, R_SWATCH_RADIUS],
  ['components/ui/LineChart.tsx', 'PX_DIM', 'min-w-[130px]', 1, R_TOOLTIP_MIN_W],
  ['components/ui/Timeline.tsx', 'PX_DIM', 'left-[11px]', 1, R_TIMELINE_RULE],
  ['components/ui/Timeline.tsx', 'PX_DIM', 'left-[7px]', 1, R_TIMELINE_DOT],
];

// --- The patterns ---

/** A text size written as a raw pixel value. */
const TEXT_SIZE_PATTERN = /text-\[(\d+(?:\.\d+)?)px\]/g;

/** A layout dimension written as a raw pixel value. */
const PX_DIM_PATTERN =
  /(min-|max-)?(w|h|size|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|top|right|bottom|left|inset|rounded)-\[(\d+(?:\.\d+)?)px\]/g;

/** A --text-* declaration in a stylesheet. */
const CSS_TOKEN_PATTERN = /--text-([a-z0-9-]+)\s*:\s*([^;{}]+)/g;

/** The semantic names and the canonical token each one aliases. */
const CANONICAL_ALIASES: readonly (readonly [alias: string, canonical: string])[] = [
  ['text-3xs', 'text-10'],
  ['text-2xs', 'text-11'],
  ['text-xs', 'text-12'],
  ['text-sm', 'text-13'],
  ['text-base', 'text-15'],
];

// --- Helpers ---

/** Prints a path relative to apps/web/src, with posix separators. */
function adminPath(absolute: string): string {
  return relative(ADMIN_SRC, absolute).split(sep).join('/');
}

/** Every file under a directory with one of the given extensions, sorted. */
function listFiles(dir: string, extensions: readonly string[]): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
        found.push(full);
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return found.sort();
}

/** The 1-based line a match starts on. */
function lineOf(source: string, index: number): number {
  let line = 1;
  for (let at = 0; at < index; at += 1) {
    if (source.charCodeAt(at) === 10) line += 1;
  }
  return line;
}

/** The --text-* declarations of one stylesheet, by token name. */
function cssTextTokens(source: string): Map<string, CssDeclaration[]> {
  const tokens = new Map<string, CssDeclaration[]>();
  for (const match of source.matchAll(CSS_TOKEN_PATTERN)) {
    const name = `text-${match[1] ?? ''}`;
    const declarations = tokens.get(name) ?? [];
    declarations.push({ value: (match[2] ?? '').trim(), line: lineOf(source, match.index ?? 0) });
    tokens.set(name, declarations);
  }
  return tokens;
}

/** Resolves a --text-* token to the pixel size it renders, following var() references. */
function resolveTextPx(
  name: string,
  tokens: Map<string, CssDeclaration[]>,
  path: Set<string>,
): number | null {
  if (path.has(name)) return null;
  const nextPath = new Set(path);
  nextPath.add(name);
  for (const declaration of tokens.get(name) ?? []) {
    const literal = /^(-?\d+(?:\.\d+)?)(rem|px)$/.exec(declaration.value);
    if (literal) {
      const amount = Number.parseFloat(literal[1] ?? '0');
      return literal[2] === 'rem' ? amount * 16 : amount;
    }
    const reference = /^var\(--text-([a-z0-9-]+)\)$/.exec(declaration.value);
    if (reference) {
      const resolved = resolveTextPx(`text-${reference[1] ?? ''}`, tokens, nextPath);
      if (resolved !== null) return resolved;
    }
  }
  return null;
}

// --- The scan ---

/** Scans one source file for the class rules. */
function scanSource(file: string, source: string): Finding[] {
  const findings: Finding[] = [];
  for (const match of source.matchAll(TEXT_SIZE_PATTERN)) {
    const size = Number.parseFloat(match[1] ?? '0');
    findings.push({
      file,
      line: lineOf(source, match.index ?? 0),
      rule: 'TEXT_SIZE',
      token: match[0],
      detail: `text sized at ${size}px`,
      illegible: size < MIN_TEXT_PX,
      allowlistable: true,
    });
  }
  for (const match of source.matchAll(PX_DIM_PATTERN)) {
    findings.push({
      file,
      line: lineOf(source, match.index ?? 0),
      rule: 'PX_DIM',
      token: match[0],
      detail: `hardcoded ${match[0]} dimension`,
      illegible: false,
      allowlistable: true,
    });
  }
  return findings;
}

/** Scans every stylesheet for the token rules. */
function scanStylesheets(sheets: Stylesheet[]): Finding[] {
  const findings: Finding[] = [];
  for (const sheet of sheets) {
    for (const [name, declarations] of sheet.tokens) {
      const px = resolveTextPx(name, sheet.tokens, new Set<string>());
      if (px === null || px >= MIN_TEXT_PX) continue;
      findings.push({
        file: sheet.file,
        line: declarations[0]?.line ?? 1,
        rule: 'CSS_SMALL',
        token: `--${name}`,
        detail: `the token renders at ${px}px, below the ${MIN_TEXT_PX}px floor`,
        illegible: true,
        allowlistable: false,
      });
    }
  }

  const canonicalSheet = sheets.find((sheet) => sheet.file === 'app/globals.css');
  if (!canonicalSheet) return findings;
  for (const [alias, canonical] of CANONICAL_ALIASES) {
    const expected = resolveTextPx(canonical, canonicalSheet.tokens, new Set<string>());
    if (expected === null) continue;
    for (const sheet of sheets) {
      const declarations = sheet.tokens.get(alias);
      if (!declarations) continue;
      const actual = resolveTextPx(alias, sheet.tokens, new Set<string>());
      if (actual === null || actual === expected) continue;
      for (const declaration of declarations) {
        findings.push({
          file: sheet.file,
          line: declaration.line,
          rule: 'CSS_ALIAS',
          token: `--${alias}`,
          detail: `the alias renders at ${actual}px, the canonical --${canonical} at ${expected}px`,
          illegible: false,
          allowlistable: false,
        });
      }
    }
  }
  return findings;
}

/** The key an allowlist entry is counted under. */
function allowlistKey(file: string, rule: string, token: string): string {
  return `${file}|${rule}|${token}`;
}

/** The baseline findings of one allowlist key, with the lines they sit on. */
interface BaselineGroup {
  file: string;
  rule: AllowlistableRule;
  token: string;
  lines: number[];
  reason: string;
}

/** Matches the findings against the allowlist. */
function applyAllowlist(findings: Finding[]): {
  failures: Finding[];
  baseline: BaselineGroup[];
  stale: AllowlistEntry[];
} {
  const left = new Map<string, number>();
  const reasons = new Map<string, string>();
  for (const entry of ALLOWLIST) {
    const key = allowlistKey(entry[0], entry[1], entry[2]);
    left.set(key, (left.get(key) ?? 0) + entry[3]);
    reasons.set(key, entry[4]);
  }

  const failures: Finding[] = [];
  const baseline: BaselineGroup[] = [];
  const groups = new Map<string, BaselineGroup>();
  for (const finding of findings) {
    if (!finding.allowlistable) {
      failures.push(finding);
      continue;
    }
    const key = allowlistKey(finding.file, finding.rule, finding.token);
    const remaining = left.get(key) ?? 0;
    if (remaining <= 0) {
      failures.push(finding);
      continue;
    }
    left.set(key, remaining - 1);
    const group = groups.get(key) ?? {
      file: finding.file,
      rule: finding.rule as AllowlistableRule,
      token: finding.token,
      lines: [],
      reason: reasons.get(key) ?? 'no reason given',
    };
    group.lines.push(finding.line);
    groups.set(key, group);
  }
  baseline.push(...groups.values());

  const stale = ALLOWLIST.filter((entry) => {
    const key = allowlistKey(entry[0], entry[1], entry[2]);
    return (left.get(key) ?? 0) > 0;
  });
  return { failures, baseline, stale };
}

// --- The report ---

/** The place a finding sits, for the report. */
function location(finding: Finding): string {
  return `apps/web/src/${finding.file}:${finding.line}`;
}

/** Prints the report and returns the number of failures. */
function printReport(
  findings: Finding[],
  failures: Finding[],
  baseline: BaselineGroup[],
  stale: AllowlistEntry[],
  canonical: Map<string, number>,
): number {
  console.log('Type scale check: apps/web/src');
  console.log('');

  const scale = [...canonical.entries()]
    .filter(([name]) => /^text-\d+$/.test(name))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, px]) => `${name}=${px}px`)
    .join(' ');
  console.log(`Canonical scale: ${scale}`);
  console.log('');

  const illegible = findings.filter((finding) => finding.illegible);
  if (illegible.length > 0) {
    console.log(`ILLEGIBLE (renders below ${MIN_TEXT_PX}px)`);
    for (const finding of illegible) {
      console.log(`  ${location(finding)}  ${finding.rule}  ${finding.token}`);
    }
    console.log('');
  }

  if (failures.length > 0) {
    console.log(`FAILURES (${failures.length})`);
    for (const finding of failures) {
      console.log(`  ${location(finding)}  ${finding.rule}  ${finding.token}`);
      console.log(`    ${finding.detail}`);
    }
    console.log('');
  }

  if (baseline.length > 0) {
    console.log(`KNOWN BASELINE (${baseline.length} entries)`);
    for (const group of baseline) {
      const where = `apps/web/src/${group.file}`;
      console.log(`  ${where}  ${group.rule}  ${group.token}  x${group.lines.length}`);
      console.log(`    lines ${group.lines.join(', ')}`);
      console.log(`    baseline: ${group.reason}`);
    }
    console.log('');
  }

  if (stale.length > 0) {
    console.log(`STALE ALLOWLIST ENTRIES (${stale.length})`);
    for (const entry of stale) {
      console.log(`  apps/web/src/${entry[0]}  ${entry[1]}  ${entry[2]}  x${entry[3]}`);
    }
    console.log('  the code is gone or the token changed: delete the entry');
    console.log('');
  }

  const baselineCount = baseline.reduce((total, group) => total + group.lines.length, 0);
  console.log(`Summary: ${failures.length} failure(s), ${baselineCount} known baseline(s)`);
  console.log(`  ${findings.length} finding(s) in total, ${stale.length} stale entry(ies)`);
  return failures.length;
}

function main(): void {
  const findings: Finding[] = [];
  for (const file of listFiles(ADMIN_SRC, ['.ts', '.tsx'])) {
    findings.push(...scanSource(adminPath(file), readFileSync(file, 'utf8')));
  }

  const sheets: Stylesheet[] = listFiles(ADMIN_SRC, ['.css']).map((file) => {
    const source = readFileSync(file, 'utf8');
    return { file: adminPath(file), tokens: cssTextTokens(source) };
  });
  findings.push(...scanStylesheets(sheets));

  const canonical = new Map<string, number>();
  const canonicalSheet = sheets.find((sheet) => sheet.file === 'app/globals.css');
  if (canonicalSheet) {
    for (const [name] of canonicalSheet.tokens) {
      const px = resolveTextPx(name, canonicalSheet.tokens, new Set<string>());
      if (px !== null) canonical.set(name, px);
    }
  }

  const { failures, baseline, stale } = applyAllowlist(findings);
  const failureCount = printReport(findings, failures, baseline, stale, canonical);
  process.exitCode = failureCount > 0 ? 1 : 0;
}

main();
