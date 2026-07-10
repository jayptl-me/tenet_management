export const meta = {
  name: 'full-codebase-audit',
  description:
    'Exhaustive codebase audit: auth, security, type safety, data flow, and edge cases across every module',
  phases: [
    { title: 'Discover', detail: 'Map every file that needs review' },
    { title: 'Audit', detail: 'Parallel security, type, and correctness audit' },
    { title: 'Verify', detail: 'Adversarial cross-validation of findings' },
    { title: 'Report', detail: 'Synthesize ranked findings with severity' },
  ],
};

phase('Discover');
const fileMap = await agent(
  'List every source file in this project, organized by module (routes, models, services, components, hooks, lib, store, types). Return as JSON: { module: string, files: string[] }[]. Exclude node_modules, dist, .next, and build directories.',
  {
    label: 'discover-files',
    phase: 'Discover',
    schema: {
      type: 'object',
      required: ['modules'],
      properties: {
        modules: {
          type: 'array',
          items: {
            type: 'object',
            required: ['module', 'files'],
            properties: {
              module: { type: 'string' },
              files: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  },
);

const modules = (fileMap?.modules ?? []).filter(Boolean);
log(
  `Discovered ${modules.reduce((sum, m) => sum + m.files.length, 0)} files across ${modules.length} modules`,
);

phase('Audit');
const audits = await pipeline(modules, async (mod) => {
  if (mod.files.length === 0) return null;
  return agent(
    `Audit all files in the "${mod.module}" module for:
1. Missing or broken authentication/authorization
2. Type safety violations (implicit any, unsafe casts)
3. Unhandled error states (missing try/catch, unhandled promise rejections)
4. Data validation gaps (missing input sanitization)
5. Logical errors or race conditions
6. Hardcoded secrets or environment-dependent values
7. API contract mismatches

Files: ${mod.files.join(', ')}

For each finding, include: file path, line number, issue description, severity (critical/high/medium/low), and proposed fix.`,
    {
      label: `audit:${mod.module}`,
      phase: 'Audit',
      schema: {
        type: 'object',
        required: ['findings'],
        properties: {
          findings: {
            type: 'array',
            items: {
              type: 'object',
              required: ['file', 'issue', 'severity'],
              properties: {
                file: { type: 'string' },
                line: { type: 'number' },
                issue: { type: 'string' },
                severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                fix: { type: 'string' },
              },
            },
          },
        },
      },
    },
  );
});

const allFindings = audits.filter(Boolean).flatMap((a) => a.findings ?? []);
log(`Found ${allFindings.length} issues across all modules`);

phase('Verify');
const verified = await pipeline(allFindings, async (finding) => {
  return agent(
    `Adversarially verify this finding by re-reading the actual code:

File: ${finding.file}
Line: ${finding.line}
Issue: ${finding.issue}

Read the file, check if the issue is real. If it's a false positive, explain why. If it's real but less severe than stated, adjust the severity.

Return: { confirmed: boolean, adjustedSeverity: "critical"|"high"|"medium"|"low"|null, explanation: string }`,
    {
      label: `verify:${finding.file.split('/').pop()}`,
      phase: 'Verify',
      schema: {
        type: 'object',
        required: ['confirmed', 'explanation'],
        properties: {
          confirmed: { type: 'boolean' },
          adjustedSeverity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          explanation: { type: 'string' },
        },
      },
    },
  );
});

const confirmedFindings = allFindings
  .map((f, i) => ({ ...f, verification: verified[i] }))
  .filter((f) => f.verification?.confirmed);

log(`${confirmedFindings.length} findings confirmed after adversarial verification`);

phase('Report');
return await agent(
  `Synthesize the following verified audit findings into a prioritized report:
${JSON.stringify(confirmedFindings, null, 2)}

Format as:
## Executive Summary
## Critical Issues (immediate action required)
## High Priority Issues
## Medium Priority Issues
## Low Priority / Informational
## Patterns & Recommendations

Group by severity, then by module. For each finding include file:line and the fix recommendation.`,
  { label: 'final-report', phase: 'Report' },
);
