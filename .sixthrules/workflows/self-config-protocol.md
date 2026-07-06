# Self-Config Protocol — Project Auto-Adaptation

> **Loaded on every session start.** Scans the current working directory, determines project identity and tech stack, updates all references, skills, and paths to match. Run this before any other protocol.

---

## Phase 0: Project Identity Scan (Run on EVERY session start)

```
1. CAPTURE CURRENT DIRECTORY:
   PROJECT_DIR = $(pwd)
   PROJECT_NAME = $(basename $PROJECT_DIR)

2. DETECT TECH STACK (first match wins):
   if pubspec.yaml exists      → STACK=flutter, RUN: flutter pub get
   if package.json exists:
     if "next" in deps         → STACK=nextjs
     if "expo" or "react-native" → STACK=react-native
     if "react" in deps        → STACK=react
     if "express|fastify|hono|nestjs" → STACK=node-backend
     if multiple workspaces    → STACK=monorepo
     otherwise                 → STACK=node-library
   if requirements.txt/setup.py/pyproject.toml → STACK=python
   if go.mod                   → STACK=golang
   if Cargo.toml               → STACK=rust
   if composer.json            → STACK=php
   if *.sln                    → STACK=dotnet
   otherwise                   → STACK=generic

3. DETECT PACKAGE MANAGER:
   if bun.lock exists          → PM=bun
   if yarn.lock exists         → PM=yarn
   if pnpm-lock.yaml exists    → PM=pnpm
   if package-lock.json exists → PM=npm
   if pubspec.lock exists      → PM=pub

4. READ EXISTING CONFIG:
   if .sixthrules/ exists:
     Read rules.md for existing MCP/skill config
     Read workflows/ to understand existing protocols
   else:
     CREATE .sixthrules/ directory

5. CHECK EXISTING RULE FILES:
   if .claude/ or CLAUDE.md or AGENTS.md exists:
     Read and merge into .sixthrules/rules.md
     Do NOT overwrite — append missing configs only
```

---

## Phase 1: Skill & MCP Auto-Configuration

```
1. UPDATE rules.md with project identity:
   - Set STACK and PROJECT_NAME variables
   - Update skill URLs/references to current directory
   - Add project-specific MCP servers if detected

2. ACTIVATE STACK-SPECIFIC SKILLS (from skill map):
   - Append to rules.md: "Active skills for this project: [list]"
   - Skills are already globally installed — no install needed
   - This just activates them contextually for this project

3. DETECT PROJECT-SPECIFIC CONFIG:
   - Check for .env / .env.example → document required vars
   - Check for Dockerfile → activate docker verification
   - Check for CI configs (.github/, .gitlab-ci.yml, Jenkinsfile)
   - Check for database config (prisma/, drizzle/, migrations/)
   - Check for test framework (jest, vitest, pytest, flutter_test)

4. WRITE rules.md with ALL found configs:
   - Project identity
   - Tech stack + versions
   - Available commands
   - Active skills
   - MCP configuration
   - Environment requirements
   - Deployment targets
```

---

## Phase 2: Codebase Index Generation

```
1. SCAN DIRECTORY STRUCTURE:
   find . -maxdepth 4 -type f -name "*.ts" -o -name "*.tsx" \
          -o -name "*.dart" -o -name "*.py" -o -name "*.js" \
          -o -name "*.jsx" -o -name "*.vue" -o -name "*.svelte" \
          | grep -v node_modules | grep -v .git | grep -v build \
          | grep -v dist | grep -v .next | grep -v .dart_tool \
          | head -80

2. POPULATE codebase-index.md:
   - Write detected directories and key files
   - Note any architectural patterns found
   - Document import aliases, state management, etc.

3. DETECT TEST LOCATIONS:
   - __tests__/ or *.test.ts or *.spec.ts → update test section
   - test/ or tests/ directory
   - Integration test paths
```

---

## Phase 3: Path & Reference Auto-Update

```
1. UPDATE ALL PROTOCOL FILES with project paths:
   - Replace any hardcoded references with $PROJECT_DIR
   - Update verify commands to use detected package manager
   - Update all file paths to relative from $PROJECT_DIR

2. WRITE STACK-SPECIFIC VERIFY OVERRIDE:
   - Copy from template: stacks/<stack>/verify.md
   - Update with project-specific build/test/dev commands
   - Customize for package manager
```

---

## Phase 4: Done — Ready

```
ON COMPLETE:
  - .sixthrules/ exists with: master.md, rules.md, codebase-index.md,
    code-quality-verification-gates.md, adaptive-research-protocol.md,
    automation-loop.md, sub-agent-orchestration.md,
    multi-pass-batch-planning.md, codebase-index-update-protocol.md
  - rules.md has project-specific skill activation
  - All paths are relative to current directory
  - Agent is ready to work with full context

RETRY LOGIC:
  If any phase fails → retry up to 3 times
  If all 3 retries fail → continue with degraded mode (no config)
```

---

## Quick Reference

```
VARIABLES SET:
  $PROJECT_NAME    = <basename of current dir>
  $PROJECT_DIR     = <absolute path of current dir>
  $STACK           = flutter|nextjs|react|node-backend|python|monorepo|generic
  $PM              = bun|npm|yarn|pnpm|pub

STACK DETECTION:
  pubspec.yaml           → flutter
  package.json[expo]     → react-native
  package.json[next]     → nextjs
  package.json[react]    → react
  package.json[express]  → node-backend
  requirements.txt       → python
  go.mod                 → golang
  Cargo.toml             → rust
```
