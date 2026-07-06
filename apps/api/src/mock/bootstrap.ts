/**
 * Mock bootstrap — MUST swap mongoose BEFORE any file imports it.
 * Uses synchronous file operations to ensure the module cache
 * gets the mock version.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockDir = path.resolve(__dirname, 'mongoose-package');
const nodeModulesDir = path.resolve(__dirname, '../../node_modules');
const realDir = path.join(nodeModulesDir, 'mongoose');
const backupDir = path.join(nodeModulesDir, 'mongoose.REAL');

// ---- Swap BEFORE any mongoose import happens ----
if (!fs.existsSync(backupDir)) {
  console.log('Backing up real mongoose and installing mock...');
  // Move real mongoose to backup (sync, atomic)
  fs.renameSync(realDir, backupDir);
  // Copy mock (sync)
  fs.cpSync(mockDir, realDir, { recursive: true });
}

// ---- Now safe to import mongoose-dependent modules ----
const { seedMockData } = await import('./seed.js');
seedMockData();

console.log('Starting API server in mock mode...');
await import('../index.js');
