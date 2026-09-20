import { chromium } from "playwright";
import fs from "fs";

async function run() {
  console.log("Launching browser...");
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  fs.mkdirSync(".audit-screenshots/baseline", { recursive: true });
  await page.screenshot({ path: ".audit-screenshots/baseline/01-landing.png", fullPage: true });
  console.log("Saved screenshot: .audit-screenshots/baseline/01-landing.png");
  await browser.close();
  console.log("Done!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
