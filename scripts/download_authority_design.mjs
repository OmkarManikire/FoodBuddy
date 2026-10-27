import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.join(__dirname, '..', 'design', 'authority');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const screens = [
  {
    key: 'authority_overview_desktop',
    title: 'Higher Authority Overview',
    device: 'desktop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFjNTIyNTU0MGUwNzNhZThlMDQyMmJkZGMzEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1Vv96u98z4iSoo-8sCax1-s0KcHCeQ_ZFFEyNoiLsRbJMI2aqeqDMjX-LLoVVK7dJCECPef4inS1usBKMEj5rB9Q8gwJ0F9_W5_EK1JwnRKDd7Fm6zHJOx2FPYC0I-ax1ZferBnh1ofKDKmY0O116cPmnnqYGtQUacwHz1WVBNAS9BWnBTIcmUZzCfzrVddv6vDZvV1MAv5ZSq8Wo3CeLt8CdCZ2GdEe8ITfa1zzPFCgkA8SfkJlXt3Wqw'
  },
  {
    key: 'authority_overview_mobile',
    title: 'Authority Overview Mobile',
    device: 'mobile',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFjNTFiNGY5MGYwMmE5OTYxZDgzMzA4NmYxEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1VTtSmGu0h5cpC0baS9Xmp2mOlK_rCs1X8V9i9EtDDxxxjsDOOTS2QOAwBSUcMevTojkYjDEo0ujeb16Io4wrXbiGPcM0mMEgG99hvwlngCFYaqXP0L2a-P5hrEFcn3Uo0djdjtlJBvYHaSi0ekTg03DUnYPIqiQeEcglTQd4mY3JISSGDGpYvUSpeOk8xyadxqAHnQ4OOT4ZGtOL7O-FG8HSvDYpfUdQy2r3fxdzdauzJRHKvYYk1Kvg'
  },
  {
    key: 'official_directives_desktop',
    title: 'Official Directives',
    device: 'desktop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFjNTJjN2ZlNzMwMWE2M2U2YmU3MzljYzAwEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1WPKRIjFcHBEk1JczuarHZQ9aH6YuXm4gvFWTdTIl6eXhfG96e7oTY-2nYmcOQsq9QnxBtXFFeTw129CocFpAYfmDBzUhq1bir46ZPNZXV712b3bTAH-EmfQNqLgYmlboWeYNbmR51YELI20g2UqizDQJo7nJsCt4v-Fbcvznuu_BeyuNDzuphJNYmn9cDPr6Wmiq8DJlVguBGgxIwgQYj5kQGIfaVOSXjTI7m2IqmZt_HJGWvnQZF_Wzg'
  },
  {
    key: 'escalated_queue_desktop',
    title: 'Escalated Queue',
    device: 'desktop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFjNTIwNjgxOTcwMWE2Mjk0OThkMWYxY2IxEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1WDDvrWAB8MyU6CLXVhfGR12TDJbWcROKqlxChPEGYvfBD42MgIKluNMW7B1r-rkosV1TSkbUbpKkdeKPYjLGjGW8uMIgHiTi8BfZXTgwkP7B9SXTWWHim2JSjovVDUcm1PbvbUfljUXKgNDhDXD502tim5cb7I0c-gr66hEi5vcU4b14s8q8uZB9w1p0z1VtEibeAbqpSEiB2Eg67Pnh-Yc5dH35XSxyKtaqyIXrnLFiADAMdUc-jnUFM'
  },
  {
    key: 'escalated_queue_mobile',
    title: 'Escalated Queue Mobile',
    device: 'mobile',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFjNTJiZDBmZGUwNGVhYjAzNDg4MjNiYTM2EgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1VRlP_Rz2Kr30I99TSXZNyeIkLEAqGWEVoQpnMfdiOp9d7x6wpfmE9qqUcKnMSRkiLVfBD9sPpNay298_zFvgYmwLe5cAQQnDje1AhW_XN702mQ6c7R-ImD8YIJ2jIwd4dvHFmpRprh2ZTp5uN4Z_ED_22O-Ykv1wTawKf1EkviTUt4oBioZDKGASXCYegMUJu8Kj4rDudTxOBK4_yumtKAAt2Xotp4JwteuG_iCYUD-taAqnMENld7w5U'
  },
  {
    key: 'audit_trail_desktop',
    title: 'Full Audit Trail',
    device: 'desktop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFjNTFmNzY5ZDkwMzc0OWIyYTkwMzNjNWNkEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1UGY7_ih3udEb4p6SHTNqPSBsDeQNcmOA8LpKAGRUQjGUSubmhAcrySHFpEY4XTy8c__Q6LSQU9vE2j3LQpPxycbyVzaAiv7j15OGvVgTQmmFK8ulUS_jFgQm61Q0kDItbBLRxrJjqQ_KkBVtDaPvbmyC7Vu1LXpcee9Lrjw6W3WEGVFihQAWHFcy0VGPyQiKebwbP7jnTE-tmDXCFyJADOn9F8KxxqVtgaUz07btgaf4XtA0AanoUzng'
  },
  {
    key: 'quality_index_desktop',
    title: 'Quality Index',
    device: 'desktop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFjNTJlOGVhZjMwNTIyOTQ1ODc3Mjg3MjYwEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1UwUsFrgLyrmo1kKGCfx9nYWr7ynOlKuyfyVoXltMb4zY1oyfSQQNbQJw7ryj2RhE5cKE31NPzHVgNgZcxXPlBC41dSg3jpcPWZpN8SyNpxM4yUPKb6kFvf5kTuai6UCyuSnIZsnZ1PmfiFdGPuzGagq2Raxb4Qazbs40brd_jt-viU14Xd2PNOWoJjM-3vhZgqSYKYcv4YzWpkQUGY4MfpdzU8dDOQaX6RMEiGV4F8Y5H3zTErBFETqgI'
  },
  {
    key: 'caterer_governance_desktop',
    title: 'Caterer Governance',
    device: 'desktop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFjNTJkMjhjZWQwOTEwNGY3MzAxMWU5ZGIwEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1XWcnYiuXuYbqrT7XRuYFJKXa_P-ZeYvGPnU3102Yoknhtyab-Zs-DMkZT5qNP3O0s-SAHzR01HaSskMm8MzOh6ADLSUfDMX3SczMHMc400zSmqmie07l23eXZ3YtgaNWsMxxYVh7Cut9fnxTQasg-IIPSVDe1Q2ROok54YM4wA6HYNyTzanUFH_0eLWHruyweaIlhHbXMxw5yXlzRxJ5s_jewfyrd7LdZAr1JdLmntH3TIKs7MzbSZcg'
  }
];

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buffer));
}

async function run() {
  console.log(`Starting download of ${screens.length} Authority screens into ${outDir}...`);
  for (const s of screens) {
    console.log(`\nDownloading ${s.title} (${s.key})...`);
    const htmlDest = path.join(outDir, `${s.key}.html`);
    const imgDest = path.join(outDir, `${s.key}.png`);

    try {
      await downloadFile(s.htmlUrl, htmlDest);
      console.log(`  Saved HTML -> ${htmlDest}`);
    } catch (e) {
      console.error(`  Failed HTML: ${e.message}`);
    }

    try {
      await downloadFile(s.imgUrl, imgDest);
      console.log(`  Saved Screenshot -> ${imgDest}`);
    } catch (e) {
      console.error(`  Failed Screenshot: ${e.message}`);
    }
  }
  console.log('\nAll Authority screen downloads finished!');
}

run();
