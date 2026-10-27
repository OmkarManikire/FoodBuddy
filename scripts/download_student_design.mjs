import fs from 'fs';
import path from 'path';

const screens = [
  {
    id: '0276f2c5051443e99e6187f802b237eb',
    filename: 'student_dashboard_desktop',
    title: "Student Dashboard — FoodBuddy",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFhZGNmMzNiODkwOTFmN2VhNjRiMzU0NjhlEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/AEtjO1XI4zZ0jwlBW382n3U96r2sW2R9U2IoOBGy35_cqzsihHGo8lxTCUvYJ973q_IYhHPwDxcJn_jWFKFuH_9_rqmkx-tI4YmzFMz4GUXsAU6SNqmGBRHqFweCOWcdJA671zXSQ1UjVRxek6zqgb1UpsdDTaRCz60e6JLpezZetN-9otzGuWGtee3WilYX0aOv9krWYBBSP_gr79QEtBDrQqU6tuJ3P9EJIMCAtLflAwmn3vWn_Lju6Vx1_vY"
  },
  {
    id: 'd68ed0fd7d1c4c83bc78a020f568f75b',
    filename: 'student_dashboard_mobile',
    title: "Student Dashboard — FoodBuddy Mobile",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFhZTI1ZGUxZTkwN2M0ZDU5YjgwMDhjNDgwEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/AEtjO1XmYFeDxpm6AOf926U6pm_iKGEsL7I4vKkZfuvb8gbHq8PgDdK69i5bmFeKznFYP-Urdi2zdj_Oa2Lz1tHnQ4x7zNRh9uFR5vQQE9-ynjYR-a2i3KcufTIoI3nDtK5p-8p2PFOBpRRP0bO4pGZVUK-VR-5N7uu51t_9oTYrziPcc1dBTigtVlD8SaW4F4Vjw9ZbSY8ssZJ9UI4s5eUfFkm1Krv1PpSGcvluOLq9URG6uNGMmYyIK1JUgWc"
  },
  {
    id: '4604931f96084743afbd7b1fd7e17d02',
    filename: 'rate_today_food_desktop',
    title: "Rate Today's Food — FoodBuddy",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFhZGJkOTRiN2UwOTFmN2VhNjRiMzU0NjhlEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/AEtjO1VyQv8NyZOiuRjle1e4kcve7rlv8TJs8Dr14v49oUfqkeD7w18Q5vU1V4VVsksm8MR-DZIDTJ-12BCF1yKZjj1PgSm7FJTBvSEEQE6O90BvNyY4QDpb3Xgc29KhZTuJUKRqkeEyBzkNgnKIX7S1f3ItPLjWsIDn1CegiLXKRFLMsiIKXLTlUtH7vL-V2eXsL6XO0FrIRPMhnDgHtD7WEJzDDMOV2L6XjG3U1iGRdu9Shu18P7sa7JXqFLU"
  },
  {
    id: 'b36e30edbfa74482a54e2af6c4ebbed1',
    filename: 'rate_today_food_mobile',
    title: "Rate Today's Food — FoodBuddy Mobile",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFhZTI0ZjQ1MTUwMWE2M2UxMzJhMWJlNjQ1EgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/AEtjO1ViKywpSlGowCS1Hnb5QDdzOM53ilVQ2I9cAF-mJ0jD7uZM0LN6krErYUCmG2_XTNKTbIs2Ve7SsOG_nZl8IB4oz-mMqZKji4BlkYYAcnOnM4gQ823fc4bJ8KsqG0W7woxcQHCh2Lcxxk7LwB430eNcV-uTxcaNLKS_xS8VC_tuxh2b-2RWoD-SCCPX-SYc8bLBYcvVg3D-lpR0ANNNrFX0I9dgr9keXazX4pg3wCkIl3ArVvZVSdx10uQ"
  },
  {
    id: '86c4466b8c2749ddb454a0e510347036',
    filename: 'todays_menu_desktop',
    title: "Today's Menu — FoodBuddy",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFhZGRkNTZiNmIwMjA3ODQ1MDYxMWEzMjIxEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/AEtjO1X2Lnx0-qt-KuLTh1YwK4pK-poopLlf2CDMugSKLddfzEm7U0eWPI41HSvmhN6pd4wml8A7Lt6H4lFz2c5jO5eCrmuLiXm-qoAGKF-0PtisBUMQGMcm1tRX1bKairbCoacVVi6cuEELZvW8dzRURld9EYQwHpeMHAaqdox9tToJxT5j_H8VIR_Pg_Zv-etphA2cnLSWA7UMi_5YI5kel8kVxwQxVKEpjyUclX42n50vy4GAEjUKcM7ZGqw"
  },
  {
    id: 'b6c81a647ccd41f884db479e6312ae18',
    filename: 'file_complaint_desktop',
    title: "File a Complaint — FoodBuddy",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFhZGM5NjZlNGYwNTIyOWQwNmRjMDg3OGFjEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/AEtjO1XqQD84hU-1gaZNkVfPzbf4DcgLBMayP8FnP8M3W3Lt9Nijue7gZhZeMgFgcZFkQzaZeI-JCF-FcuqxKRIHwcuj8cTqclgl6NXrP5WXm73ukK9w4rn_pjIVybdoVD8B8au5C3ULWoCjP59omQ6KCLNKg70g2Cv2U2uKH6we7RzDzkDeHVeUCkEMu20z45XMSBQAumzvgoaQoWry0D1YlUwsTFxopsPYJ6z5YjXnLcHLkDdLyJJwdwhDRCU"
  },
  {
    id: '6c2e9617d77f41f1bcb8d0e44da33d95',
    filename: 'track_complaints_desktop',
    title: "Track Complaints — FoodBuddy",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFhZGNmZmJiNjkwMWE2Mjk0OThkMWYxY2IxEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/AEtjO1UxFIJD5IvaKibCqYAxRxhMdhxeX9Tz8P3ll9HTcgqMUdseD9jW1FYufdyerMJL9-CuWWPNNqAWv7D0w1TqiIakVmM7M5oF87VW6ZnZ-ScUu85qdRf9y8hjtR8OcBCfOao88K2EqqrfexTV07DkMwFA8XanJgp-iCLFHYX6z-rGnYNab6oCG8FJEzVZMo0_bkCuvWFL2-v9M_k9PV3eV5_qLphecibRjf-AJZFNC17Nqd-2JVPRHK8sNOY"
  },
  {
    id: '8b47a08bfd4248219befa007fdf1b70d',
    filename: 'track_complaints_mobile',
    title: "Track Complaints — FoodBuddy Mobile",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFhZTI4MzE0N2IwN2M0YzJlNTFiMWUyNzI0EgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/AEtjO1WTBvGwk_t7yOm69YpdTU2-mQ3fXvzsAtKmX3EzId4E4eI3hhbcBLaVg1R6cq8QjEjpFFmlWiNoYvRIYPYC4n1gNgcdOhv4RzJYQKnJO1lgY6qzCPxz5OrECKkYaIPZe0325WwAKMhb3mstcxyeY_DX69ohKxcpQcgrBY7IQotO9haUjc0oNg89QgSgZlsQgOCCB1CTcOI41TyTRhqSarSKs5dRm6JCfZVSXkg1q-ikDJB8dfGKfK9KWw"
  },
  {
    id: 'b12c35370bd14ff3b3ed643b7aa61336',
    filename: 'food_improvement_desktop',
    title: "Food Improvement — FoodBuddy",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFhZGQyMTY5NDEwMzM4NWMyYzUxMzI4MTIyEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/AEtjO1WfNj1bo5Z4aWLTi0mA4ULox8okZ0skh_5aW6yE231JN6ebHF6ZCfEqkFUXoL8qYZO-jYZtlAGxtMHKyV38dAxiZaxnB3We5o7NCRizWrmCa_5LlvGlSP5XDZHhGIdUdbGAE5zEWR6DbXF-zCRie7YVbgH3RK6yXKlM0wEoUsnRgqiJK78B6YVEtBbsnqdZSNqcWIsnpm0xUTq0rCm-MiMxme_VZexl5W4R6GrCQ3xFEHbWUDL8VJmQy54"
  },
  {
    id: 'f27b8858528042bbbb9a71bc3cd8cf88',
    filename: 'notices_circulars_desktop',
    title: "Notices & Circulars — FoodBuddy",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFhZTFlMDNhNGYwN2M0ZDU5YjgwMDhjNDgwEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/AEtjO1UH1sPOmkH-_MjYM06ztnkI54uWe0SYnBrommtOjfWVm0HmlmZaNa9sHa7Oftyq3UEr1z7GgNJwtsGrouxbHkT82-xxdaT6WfxJCY-28d5pGUM6-HtYErs9kYiNzMWkROula_QnC7QyYXe4i80ujWdVjS1G24Rf-Gd4fLvJ550RuMmv2gekjcb_HO7XKLVrNq12kuXjUmDgf9SzP--OpzIYIot6wX-ufPcgQjl3S9y38mZAz06VXN9f6g"
  },
  {
    id: 'eca467e5883049c2b4dea4e5132e7421',
    filename: 'qr_attendance_desktop',
    title: "QR Attendance — FoodBuddy",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFhZTI5NjQ4YTkwNTNiNzNkMDg0MjM0NjU4EgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/AEtjO1U9-uDfdJUk5OLgRlvZhTkkbtHQ4eVI2pN09uqZ63uKOu9Menkk-M96ratQF-WVQ0F4Eq3vgRETj36UHznV-T_bcSP0H78mkfBM-L-yXid2ViUqUQ-QUGVl5B_DgG6RTMsWxLPsWe3EwXW8gA92Kj9uBBPUW-piFoix02q47MWCdSMX290QgDfa0SKGPR-swfn9pzvyyA5NWORXwk8tnTlvr641NpMSjE687rfmvtDKUjQS48_60l2auA"
  },
  {
    id: 'd8ce99c6d1074d6187241d4809603abb',
    filename: 'qr_attendance_mobile',
    title: "QR Attendance — FoodBuddy Mobile",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZTFhZTIwNDBmNzQwMWE2M2U5MTBjMzI5N2ZjEgsSBxCE_InQqA8YAZIBIwoKcHJvamVjdF9pZBIVQhM5OTgxODUyMDUwMDY0NzQ2MTU5&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/AEtjO1WJp8243kFYuiKfigSJtCfE6PqueDPXYlxZcA4SgFlbQAI8J39cHiF9FEgpE23PwOR-_KvpkCeU3BdfeZUtko0WFDqP7eSv78a-U3ZnMG6009AGm1Zd-JhZjT31fa_BVzzfpGVVHBmQu01ZU2jg0_wEbOsrU-H0hzyu2mKxvyzs8ZZHQR6YGqxhP-hvac1w9bD2r84YE5C_fQeO84ktl9l7jiVwT6JGe8RYwctDEXP_YzszplT3NZMvaA"
  }
];

const targetDir = path.resolve('design', 'student');
fs.mkdirSync(targetDir, { recursive: true });

async function download() {
  console.log(`Downloading ${screens.length} screens into ${targetDir}...`);
  for (const s of screens) {
    console.log(`-> Fetching ${s.title} (${s.filename})...`);
    
    // Download HTML
    try {
      const htmlRes = await fetch(s.htmlUrl);
      if (htmlRes.ok) {
        const html = await htmlRes.text();
        fs.writeFileSync(path.join(targetDir, `${s.filename}.html`), html);
      } else {
        console.warn(`Failed to fetch HTML for ${s.title}: ${htmlRes.status}`);
      }
    } catch (e) {
      console.error(`Error downloading HTML for ${s.title}:`, e.message);
    }

    // Download Screenshot
    try {
      const imgRes = await fetch(s.screenshotUrl);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        fs.writeFileSync(path.join(targetDir, `${s.filename}.png`), Buffer.from(buffer));
      } else {
        console.warn(`Failed to fetch screenshot for ${s.title}: ${imgRes.status}`);
      }
    } catch (e) {
      console.error(`Error downloading screenshot for ${s.title}:`, e.message);
    }
  }
  console.log('✅ All student design screens and screenshots downloaded successfully!');
}

download();
