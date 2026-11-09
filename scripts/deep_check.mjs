import fs from 'fs';
import path from 'path';
import vm from 'vm';

const PUBLIC_DIR = path.resolve('public');

function getAllHtmlFiles(dir, list = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      getAllHtmlFiles(full, list);
    } else if (item.name.endsWith('.html')) {
      list.push(full);
    }
  }
  return list;
}

const htmlFiles = getAllHtmlFiles(PUBLIC_DIR);
console.log(`Analyzing ${htmlFiles.length} HTML files...`);

let issues = [];

for (const file of htmlFiles) {
  const relPath = path.relative(PUBLIC_DIR, file);
  const content = fs.readFileSync(file, 'utf8');

  // 1. Check duplicate IDs
  const idRegex = /\bid=["']([^"']+)["']/g;
  const ids = new Map();
  let m;
  while ((m = idRegex.exec(content)) !== null) {
    const id = m[1];
    if (ids.has(id)) {
      ids.set(id, ids.get(id) + 1);
    } else {
      ids.set(id, 1);
    }
  }
  for (const [id, count] of ids.entries()) {
    if (count > 1) {
      issues.push(`[Duplicate ID] in ${relPath}: id="${id}" appears ${count} times`);
    }
  }

  // 2. Check asset links: src and href
  const srcRegex = /\b(?:src|href)=["']([^"']+)["']/g;
  while ((m = srcRegex.exec(content)) !== null) {
    const link = m[1];
    if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('//') || link.startsWith('#') || link.startsWith('mailto:') || link.startsWith('tel:') || link.startsWith('data:')) {
      continue;
    }
    // Local path
    const cleanLink = link.split('?')[0].split('#')[0];
    if (!cleanLink) continue;

    let targetFile;
    if (cleanLink.startsWith('/')) {
      targetFile = path.join(PUBLIC_DIR, cleanLink);
    } else {
      targetFile = path.join(path.dirname(file), cleanLink);
    }

    // If it's a directory or clean URL without .html
    let exists = fs.existsSync(targetFile);
    if (!exists && !path.extname(cleanLink)) {
      exists = fs.existsSync(targetFile + '.html') || fs.existsSync(path.join(targetFile, 'index.html'));
    }

    if (!exists) {
      issues.push(`[Broken Asset/Link] in ${relPath}: "${link}" -> resolved to ${path.relative(PUBLIC_DIR, targetFile)} does not exist`);
    }
  }

  // 3. Extract and check syntax of inline <script> tags
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let sMatch;
  let scriptIndex = 0;
  while ((sMatch = scriptRegex.exec(content)) !== null) {
    scriptIndex++;
    const attrs = sMatch[1];
    const scriptCode = sMatch[2].trim();
    if (!scriptCode) continue;

    const isModule = attrs.includes('type="module"') || attrs.includes("type='module'");
    try {
      if (isModule) {
        new vm.SourceTextModule(scriptCode, { identifier: `${relPath}:script[${scriptIndex}]` });
      } else {
        new vm.Script(scriptCode, { filename: `${relPath}:script[${scriptIndex}]` });
      }
    } catch (err) {
      issues.push(`[Script Syntax Error] in ${relPath} (script #${scriptIndex}): ${err.message}`);
    }
  }

  // 4. Check FoodBuddy vs Food Buddy branding in visible text
  // Strip script and style tags first
  const noScripts = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const foodBuddyRegex = /FoodBuddy(?![a-zA-Z0-9_\-\.])/g;
  let fbMatch;
  while ((fbMatch = foodBuddyRegex.exec(noScripts)) !== null) {
    const snippetStart = Math.max(0, fbMatch.index - 20);
    const snippetEnd = Math.min(noScripts.length, fbMatch.index + 30);
    const snippet = noScripts.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ');
    // Ignore if inside an attribute like class="...FoodBuddy..." or href
    issues.push(`[Branding: FoodBuddy -> Food Buddy] in ${relPath}: "...${snippet}..."`);
  }
}

console.log(`\nFound ${issues.length} potential issues:`);
for (const issue of issues) {
  console.log(' - ' + issue);
}
