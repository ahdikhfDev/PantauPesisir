const { chromium } = require("C:/Users/Thirty/AppData/Local/Temp/node_modules/playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + "/ms-playwright/chromium-1248/chrome-win64/chrome.exe" });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0,100)); });
  await p.goto("https://pantaupesisir.vercel.app/", { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "C:/Users/Thirty/Documents/LOMBA/docs/screenshots/green_home.png" });
  await p.goto("https://pantaupesisir.vercel.app/cek", { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: "C:/Users/Thirty/Documents/LOMBA/docs/screenshots/green_cek.png" });
  console.log("ERRORS:", errs.length, JSON.stringify(errs.slice(0,3)));
  await b.close();
})();
