import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const screensFile = '/Users/omkarmanikire/.gemini/antigravity-ide/brain/37cf22a0-f341-4058-8659-ce66bb248131/.system_generated/steps/42/output.txt';
const projectFile = '/Users/omkarmanikire/.gemini/antigravity-ide/brain/37cf22a0-f341-4058-8659-ce66bb248131/.system_generated/steps/38/output.txt';

const targetDir = '/Users/omkarmanikire/Desktop/Food Buddy/design/login';
fs.mkdirSync(targetDir, { recursive: true });

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (!url) return resolve(null);
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(dest));
      });
    }).on('error', (err) => {
      try { fs.unlinkSync(dest); } catch {}
      reject(err);
    });
  });
}

function sanitizeName(title) {
  return title
    .replace(/[—–]/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

async function run() {
  console.log('Reading Stitch screens and project details...');
  const screensData = JSON.parse(fs.readFileSync(screensFile, 'utf8'));
  const projectData = JSON.parse(fs.readFileSync(projectFile, 'utf8'));

  // Save DESIGN.md directly from project theme
  if (projectData.designMd) {
    fs.writeFileSync(path.join(targetDir, 'DESIGN.md'), projectData.designMd, 'utf8');
    console.log('Saved DESIGN.md from designTheme');
  }

  for (const s of screensData.screens) {
    const baseSlug = sanitizeName(s.title);
    console.log(`Processing: ${s.title} -> ${baseSlug}`);

    // If it's DESIGN.md screen, save as DESIGN_screen.md
    if (s.title.includes('DESIGN.md')) {
      const mdDest = path.join(targetDir, 'DESIGN_screen.md');
      await downloadFile(s.htmlCode?.downloadUrl, mdDest);
      console.log(`Downloaded ${mdDest}`);
      continue;
    }

    const htmlDest = path.join(targetDir, `${baseSlug}.html`);
    if (s.htmlCode?.downloadUrl) {
      await downloadFile(s.htmlCode.downloadUrl, htmlDest);
      console.log(`Downloaded ${htmlDest}`);
    }

    const imgDest = path.join(targetDir, `${baseSlug}.png`);
    if (s.screenshot?.downloadUrl) {
      await downloadFile(s.screenshot.downloadUrl, imgDest);
      console.log(`Downloaded ${imgDest}`);
    }
  }

  console.log('All Stitch assets downloaded successfully into /design/login/');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
