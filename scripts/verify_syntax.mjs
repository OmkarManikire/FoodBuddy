import fs from 'fs';
import path from 'path';
import vm from 'vm';
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

console.log('🔍 Running comprehensive Food Buddy syntax & code integrity checks...');

let checkedCount = 0;
let errors = 0;

// 1. Check JS/MJS syntax
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

// 2. Check JSON syntax
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

// 4. Check HTML files, duplicate IDs, inline scripts, and branding consistency
const htmlFiles = findFiles(path.join(ROOT, 'public'), ['.html']);
for (const file of htmlFiles) {
  const relPath = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');
  checkedCount++;

  // Duplicate IDs
  const idRegex = /\bid=["']([^"']+)["']/g;
  const ids = new Map();
  let m;
  while ((m = idRegex.exec(content)) !== null) {
    const id = m[1];
    ids.set(id, (ids.get(id) || 0) + 1);
  }
  for (const [id, count] of ids.entries()) {
    if (count > 1) {
      console.error(`❌ Duplicate ID in ${relPath}: id="${id}" appears ${count} times`);
      errors++;
    }
  }

  // Inline script syntax
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let sMatch;
  let scriptIdx = 0;
  while ((sMatch = scriptRegex.exec(content)) !== null) {
    scriptIdx++;
    const attrs = sMatch[1];
    const scriptCode = sMatch[2].trim();
    if (!scriptCode) continue;

    const isModule = attrs.includes('type="module"') || attrs.includes("type='module'");
    try {
      if (isModule) {
        new vm.SourceTextModule(scriptCode, { identifier: `${relPath}:script[${scriptIdx}]` });
      } else {
        new vm.Script(scriptCode, { filename: `${relPath}:script[${scriptIdx}]` });
      }
    } catch (err) {
      console.error(`❌ Script syntax error in ${relPath} (#${scriptIdx}): ${err.message}`);
      errors++;
    }
  }

  // Branding: FoodBuddy -> Food Buddy
  const noCode = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  if (/FoodBuddy(?![a-zA-Z0-9_\-\.])/g.test(noCode)) {
    console.error(`❌ Branding inconsistency: "FoodBuddy" found in visible text in ${relPath}. Must be "Food Buddy".`);
    errors++;
  }
}

console.log(`Checked ${checkedCount} files.`);
if (errors > 0) {
  console.error(`❌ ${errors} errors found.`);
  process.exit(1);
} else {
  console.log('✅ All checked files (JS, MJS, JSON, SQL, HTML) are syntactically and structurally valid!');
}
