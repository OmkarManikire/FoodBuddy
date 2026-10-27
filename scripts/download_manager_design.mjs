import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.join(__dirname, '..', 'design', 'manager');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Map of screen metadata from Stitch
const screens = [
  {
    key: 'manager_overview_desktop',
    title: 'Mess Manager Overview',
    device: 'desktop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFiOTZiNmMwNzQwMWE2Mjk0OThkMWYxY2IxEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1Wb4Fyjryw2hKwp6HG4UDs0YTUA2WA_3U6bzyDLxpx2YYmzVISQrovOdf7qGYUoH3_MW84a_B--3MPXnK1CW9ZEtlbiTON42TwqoEixg8kyQVCIJYA-CE8Bc9lIBIzGs35ZL5GJZWzWM_g1IDIQK3us-GoFQV42TjdoXNPt-rZl89WKRT6jjkuO8LAGzhVaqm0BKa9_9OH1BLp2LevB5YnleHsyS4jHNjMrJwnp9lXf3lhRqaOEuVGgHQ'
  },
  {
    key: 'attendance_overview_desktop',
    title: 'Attendance Overview',
    device: 'desktop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFiOTY0YzdmNzgwMmQzZTAyNTFkMmVhNGQ3EgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1X4lI0pp2MMRZS4stgdhnaZOpaT-B39rqDBeYwNnCoXvuSFEaqfE5-OgkMN9plIeUJ9HGwKAnrJzhszeq0WNoEgelFvCi6W_C5XE1cpcRSQ8qAwoWtPsC3IAtz4oHSNwlo129kKLA9kOFO2V_EB_sE2xcc-nREh0iMjXzG-7o249dDbP4aaq4p8EvuPU2DM74Iy_zo5oy8gzKDhb2ADY72jyH0-5bNYOuLDoCBfcdqQPMu_7BEJOrx9-Q'
  },
  {
    key: 'dynamic_qr_desktop',
    title: 'Dynamic QR',
    device: 'desktop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFiOTYwN2M2NWYwNGVhYjAzNDg4MjNiYTM2EgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1UsdJeYVYn-WdZRWN7g8KU4f93upRxTdiTQQW4BnzPLmAfzZQYFrDyMbwKhkF_5Y8ePa0lSfcIMqxe_Hsj16zmPicKNSHnGA5kYaJMJGTS3Nl3RloO6D0vm4GaKlLngLPE7LS2P2hY349fxrOFbTTxnMRqzyLwSByWRpCkfjmdsr8-cJ3Z5W0QsLT4n4K0rsWHC3tocHz5k5PBNVFt4PGVnBBjYb-B3hOQmwGEe0e_Zqom3wnr3P8xhTa0'
  },
  {
    key: 'menu_management_desktop',
    title: 'Menu Management',
    device: 'desktop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFiOTc4NDVlYzMwN2M0ZDIzODkzMDAxYjFhEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1XIG5vqBntwXi6LR4HaiF4XdCKkCMgvsiJPQPxDURKyeRi_wMhAUhwK9qkqUT094m7GFhsTWbh7tsnCKwdKND1sMozDS2Y_2XCrrVK8EUKAhs4Aj7hR6LDrZLapcTfw5Ehk63QSheUJCkeF-hvTDVo1gv8LSTon9ptymtBP464IoRQKQdmQipaHp3Rtn-jKiw6_NmjipU-qFjQ4OyRoC_VDjPy0cL3bwAFZzfRvKGTAlRPbx_3iHUEIhq0'
  },
  {
    key: 'post_notice_desktop',
    title: 'Post Notice',
    device: 'desktop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFiOWVlNTk2MTYwOTEwNGYzZWFiMzVlYmY1EgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1VOiQZcsBHA-vF03JrDLdT5I8EqM7hmGjJdfquBg29Xri0l3jxfWu7S5PDxOA92Fhtny4r87FL1Zy9KUe0Q8yD_tzrm-0t5nfXGeIOzt6nzZ0-Y5of2JUEqEJHUiP6f_bjkw736Pm-SFYYR3WOm-ShiV090q2gscg2f15m8n4AoVR_2YdyOjPhcztKOJVUXqdBZusC2gmlRuI_Hvu8sQ9cjXVJu0USwXlikdpi4J-RcIt4mk6G9qpoMAUk'
  },
  {
    key: 'complaint_review_desktop',
    title: 'Complaint Review Queue',
    device: 'desktop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFiOWYxNjE1MDgwMWVlN2U0OTdhMGM5Y2YxEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1U5B0cZ57qHVKHaqPKjmwpOFhPzQDghyDXxgxuSfSxm77CTlx8GmS2i7tE7s19e9u_H14t7fmfwNNDqpbcmtM3stoZfS1OmeQPnS2jpyku4jhUYhVuqwW7ccKKTWGDfDYaiAzeReCoR00JLbQpjvbAw-arXc7UYeuoLOB1WyO_vlCGAIx4BrpAqjp7QrXzTP14CnMPh_uTzyjTq77Se_B0W61-ua5Mc_8jPOz4eOoXcIC_hOJgIb7rxZxY'
  },
  {
    key: 'ratings_analytics_desktop',
    title: 'Ratings & Analytics',
    device: 'desktop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFiOWVhMTEzNmIwMzM4NDgzMTljMmE2YjA1EgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1V4eGbNr0KJ5Aoe1TpZOoHXme7HBcfRE_Aoueg7QgyN3wFvAJmrfRWSHDPgIxWYBmLJU_jx21A6PXjzbZ1JeMZ54tVp_CDVgtx1hhwltlQVhA7Upuy4VFDUidT1zmAbVGAqPq-BWolfQtMO7-Tk7YqlZ-99JK1HfNzB6gfUw-ocAcYRP6NZtBw2u60mBeeJS0iVGfVxlC1L7AhCCB2P2Smq8qeKSnNCfx2mQGx3g9Ds0wr4My41gU900Q'
  },
  {
    key: 'premeal_checklist_desktop',
    title: 'Pre-Meal Checklist',
    device: 'desktop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFiOWVmODg4MmMwMWE2M2U2YmU3MzljYzAwEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1Ux6-1MKC35mthx6JopOwDO44bs5_NKjQNloxWsmX5W_vFn_z5-m-yAVHfMOyEs4j21hjpPexDeE5sdSpyoNEV8jHgMO10gcULJhPy0H74cTXY0kkWoDGsy0J2uE-NopENSHWqd7tvGkNbIdolrPbuj9UQh2eRp9uKClLtHtd5ybxjYKL625bNx8GyVNSlXFgUCHnz_rIOZ8P7zaGpsatZqXEp2F8inqeaYKd7U2hgTtaTG9qKyaoNyVSI'
  },
  {
    key: 'manager_overview_mobile',
    title: 'Manager Overview Mobile',
    device: 'mobile',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFiYTI5ZWMxOTAwNDMxMDQ3NTY4MDliMjAxEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1XoiHPfg9_rPwV0KdVaIzpbZ_L5jUbdtQ5p-SRoU4jCJIoGyYEZ3nW3QJOu0V204h8nz6tV_gHwRwzVF08p-f45-YdtgJPGnJU0FXHAwKiphZFoIQRlXfw-E6su1YvqnsUlhdout-ufZtANIY29Fzr0UzgkHVVfa3TXRW9XHGP-kwvcKfEXhz_Nd4ZAH94BZt1XVuxq9RIfsVEsVzHdb6KMoCzapnq-ktvNKVze9yM9GHLeeZX57b31WQ'
  },
  {
    key: 'dynamic_qr_mobile',
    title: 'Dynamic QR Mobile',
    device: 'mobile',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFiYTJlNmM1NDgwMjA3YTJiNDE1MDU0ZWNjEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1VIZQBEAV7stYZehchzKbYL2cC5OmAuKNXG8gtz5XNlyzRngc6PKIR9TT1bJAJZBS_V1mZ0cnN6phOLH8WR8AYSderaVp5vfpgmxXBTtt2dKxVFLtluvgtZcfMOSBNZnDXlcHoLKhUbyk5QHTAIGRLjAKfMgW8_GCzKMjfRJBD4afkVGOiS8sIdshsayfAO1Kyi_T0oZDMZnNhAiLGBLa5iAlxDTax-cOmxcltcX4dpgk8xHxb-9r9n-sM'
  },
  {
    key: 'complaint_review_mobile',
    title: 'Complaint Review Queue Mobile',
    device: 'mobile',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFiYTM0MmU0OTMwNzllNzZmMmNjMGE4NzEzEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1UsSruaJcE0-4E1uKWkbNAINvc3NNYoZIL8zNlEd2d0dOgyxeBemYfEmlIAx3vY4uVvm0C0cLkvPdNpklehLzibwqwbBWtxgTPcOflFkj_UGVWBd0uFHyqXNZK8JnsyfbOEKVi0UFlva2ZMHGjWGurlPktBgcBR2cDsntvuGhv6foN5je007_DwkPRPP5N26cDA_zDjzUJX1eHB22qEbwNEhWUqAZNHfB77AtMrPAuaFJlgIExyLESKvCg'
  }
];

async function downloadAll() {
  console.log(`📥 Downloading ${screens.length} Stitch Manager screens to ${outDir}...`);
  for (const s of screens) {
    try {
      // Download HTML
      console.log(`Downloading ${s.title} HTML...`);
      const htmlRes = await fetch(s.htmlUrl);
      if (htmlRes.ok) {
        const html = await htmlRes.text();
        fs.writeFileSync(path.join(outDir, `${s.key}.html`), html, 'utf8');
      } else {
        console.warn(`Failed to fetch HTML for ${s.key}: ${htmlRes.status}`);
      }

      // Download Screenshot
      console.log(`Downloading ${s.title} Screenshot...`);
      const imgRes = await fetch(s.imgUrl);
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        fs.writeFileSync(path.join(outDir, `${s.key}.png`), Buffer.from(buf));
      } else {
        console.warn(`Failed to fetch Image for ${s.key}: ${imgRes.status}`);
      }
    } catch (err) {
      console.error(`Error downloading ${s.key}:`, err);
    }
  }
  console.log('✅ All Stitch Manager screens saved to /design/manager/!');
}

downloadAll();
