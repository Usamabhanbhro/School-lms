import { chromium } from "playwright";
import { encode } from "next-auth/jwt";
import path from "path";

const BASE_URL = "http://localhost:3000";
const SECRET = process.env.NEXTAUTH_SECRET || "f598bc819dc74534a703d15dcbb4cf87e148e69d91f215037d046c87349942a7";

const ADMIN_USER = {
  id: "cmt70l6yq000004jl0x4of2sl",
  name: "Muhammad Usama",
  email: "mubhanbhro@gmail.com",
  role: "ADMIN",
};

async function getSessionCookie(user) {
  const token = await encode({
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    secret: SECRET,
  });

  return {
    name: "next-auth.session-token",
    value: token,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  };
}

async function run() {
  const outputDir = path.resolve(".audit-screenshots/post-fix");

  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  const cookie = await getSessionCookie(ADMIN_USER);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies([cookie]);

  // 1. Capture search modal with fixed focus style
  console.log("Capturing search modal...");
  const searchPage = await context.newPage();
  await searchPage.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "domcontentloaded" });
  await searchPage.waitForTimeout(1000);
  await searchPage.keyboard.press("/");
  await searchPage.waitForTimeout(500);
  await searchPage.screenshot({
    path: path.join(outputDir, "desktop-interactive-search.png"),
  });
  await searchPage.close();

  // 2. Capture fee ledger with loaded table
  console.log("Capturing fee ledger table...");
  const ledgerPage = await context.newPage();
  await ledgerPage.goto(`${BASE_URL}/admin/fee-ledger`, { waitUntil: "domcontentloaded" });
  // Wait up to 10s for the table or empty state to render
  await ledgerPage.waitForSelector("table, [data-empty-state]", { timeout: 15000 }).catch(() => {});
  await ledgerPage.waitForTimeout(1500);
  await ledgerPage.screenshot({
    path: path.join(outputDir, "desktop-admin-13-fee-ledger.png"),
    fullPage: true,
  });
  await ledgerPage.close();

  // 3. Capture user management with loaded table
  console.log("Capturing user management table...");
  const usersPage = await context.newPage();
  await usersPage.goto(`${BASE_URL}/admin/teachers`, { waitUntil: "domcontentloaded" });
  await usersPage.waitForSelector("table", { timeout: 15000 }).catch(() => {});
  await usersPage.waitForTimeout(1500);
  await usersPage.screenshot({
    path: path.join(outputDir, "desktop-admin-03-teachers.png"),
    fullPage: true,
  });
  await usersPage.close();

  // 4. Capture templates management page
  console.log("Capturing templates management page...");
  const templatesPage = await context.newPage();
  await templatesPage.goto(`${BASE_URL}/admin/templates`, { waitUntil: "domcontentloaded" });
  await templatesPage.waitForSelector("button:has-text('Upload Template')", { timeout: 15000 }).catch(() => {});
  await templatesPage.waitForTimeout(1000);
  await templatesPage.screenshot({
    path: path.join(outputDir, "desktop-admin-15-templates.png"),
    fullPage: true,
  });
  await templatesPage.close();

  await browser.close();
  console.log("Done capturing updates!");
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
