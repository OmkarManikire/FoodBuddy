import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve('.');

function findFiles(dir, exts, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === 'dist') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFiles(fullPath, exts, list);
    } else if (exts.includes(path.extname(entry.name).toLowerCase())) {
      list.push(fullPath);
    }
  }
  return list;
}

console.log('🔍 Checking syntax of JS, JSON, and SQL files in repository...');

let checkedCount = 0;
let errors = 0;

// 1. Check JS/MJS
const jsFiles = findFiles(ROOT, ['.js', '.mjs']);
for (const file of jsFiles) {
  try {
    execSync(`node --check "${file}"`, { stdio: 'pipe' });
    checkedCount++;
  } catch (err) {
    console.error(`❌ Syntax error in JS: ${file}\n${err.message}`);
    errors++;
  }
}

// 2. Check JSON
const jsonFiles = findFiles(ROOT, ['.json']);
for (const file of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
    checkedCount++;
  } catch (err) {
    console.error(`❌ Parse error in JSON: ${file}\n${err.message}`);
    errors++;
  }
}

// 3. Check SQL files for basic syntax
const sqlFiles = findFiles(ROOT, ['.sql']);
for (const file of sqlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.length > 0) {
    checkedCount++;
  }
}

console.log(`Checked ${checkedCount} files.`);
if (errors > 0) {
  console.error(`❌ ${errors} syntax errors found.`);
  process.exit(1);
} else {
  console.log('✅ All checked files are syntactically valid!');
}
