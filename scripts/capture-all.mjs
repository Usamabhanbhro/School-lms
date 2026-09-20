import { chromium } from "playwright";
import { encode } from "next-auth/jwt";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";
const SECRET = process.env.NEXTAUTH_SECRET || "f598bc819dc74534a703d15dcbb4cf87e148e69d91f215037d046c87349942a7";

const ADMIN_USER = {
  id: "cmt70l6yq000004jl0x4of2sl",
  name: "Muhammad Usama",
  email: "mubhanbhro@gmail.com",
  role: "ADMIN",
};

const TEACHER_USER = {
  id: "cmt70qyzq000204l76idkw5n6",
  name: "Usama Bhanbhro",
  email: "mubhanbhro1@gmail.com",
  role: "TEACHER",
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

async function capture() {
  const targetDirName = process.env.OUTPUT_DIR || process.argv[2] || ".audit-screenshots/post-fix";
  const outputDir = path.resolve(targetDirName);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log("Launching Edge browser...");
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  const adminCookie = await getSessionCookie(ADMIN_USER);
  const teacherCookie = await getSessionCookie(TEACHER_USER);

  // Desktop Context (Admin)
  const adminDesktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await adminDesktopContext.addCookies([adminCookie]);

  // Mobile Context (Admin)
  const adminMobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  await adminMobileContext.addCookies([adminCookie]);

  // Desktop Context (Public / Unauth)
  const publicDesktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Mobile Context (Public / Unauth)
  const publicMobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });

  // Desktop Context (Teacher)
  const teacherDesktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await teacherDesktopContext.addCookies([teacherCookie]);

  // List of public pages
  const publicPages = [
    { name: "01-landing", path: "/" },
    { name: "02-login", path: "/login" },
    { name: "03-recover", path: "/admin/recover" },
    { name: "04-signup-notice", path: "/admin/signup" },
  ];

  for (const item of publicPages) {
    console.log(`Capturing public desktop: ${item.name}`);
    const page = await publicDesktopContext.newPage();
    await page.goto(`${BASE_URL}${item.path}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(outputDir, `desktop-${item.name}.png`), fullPage: true });

    console.log(`Capturing public mobile: ${item.name}`);
    const mPage = await publicMobileContext.newPage();
    await mPage.goto(`${BASE_URL}${item.path}`, { waitUntil: "networkidle" });
    await mPage.screenshot({ path: path.join(outputDir, `mobile-${item.name}.png`), fullPage: true });

    await page.close();
    await mPage.close();
  }

  // List of admin pages
  const adminPages = [
    { name: "admin-01-dashboard", path: "/admin/dashboard" },
    { name: "admin-02-students", path: "/admin/students" },
    { name: "admin-03-teachers", path: "/admin/teachers" },
    { name: "admin-04-classes", path: "/admin/classes" },
    { name: "admin-05-subjects", path: "/admin/subjects" },
    { name: "admin-06-attendance", path: "/admin/attendance" },
    { name: "admin-07-teacher-attendance", path: "/admin/teacher-attendance" },
    { name: "admin-08-tests", path: "/admin/tests" },
    { name: "admin-09-report-cards", path: "/admin/report-cards" },
    { name: "admin-10-agenda", path: "/admin/agenda" },
    { name: "admin-11-certificates", path: "/admin/certificates" },
    { name: "admin-12-fees", path: "/admin/fees" },
    { name: "admin-13-fee-ledger", path: "/admin/fee-ledger" },
    { name: "admin-14-salary-slips", path: "/admin/salary-slips" },
    { name: "admin-15-templates", path: "/admin/templates" },
    { name: "admin-16-settings", path: "/admin/settings" },
  ];

  for (const item of adminPages) {
    console.log(`Capturing admin desktop: ${item.name}`);
    const page = await adminDesktopContext.newPage();
    await page.goto(`${BASE_URL}${item.path}`, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, `desktop-${item.name}.png`), fullPage: true });

    console.log(`Capturing admin mobile: ${item.name}`);
    const mPage = await adminMobileContext.newPage();
    await mPage.goto(`${BASE_URL}${item.path}`, { waitUntil: "load", timeout: 60000 });
    await mPage.waitForTimeout(1000);
    await mPage.screenshot({ path: path.join(outputDir, `mobile-${item.name}.png`), fullPage: true });

    await page.close();
    await mPage.close();
  }

  // Capture interactive states
  console.log("Capturing interactive: global search");
  const searchPage = await adminDesktopContext.newPage();
  await searchPage.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "networkidle" });
  await searchPage.keyboard.press("/");
  await searchPage.waitForTimeout(300);
  await searchPage.screenshot({ path: path.join(outputDir, "desktop-interactive-search.png") });
  await searchPage.close();

  console.log("Capturing interactive: mobile drawer");
  const drawerPage = await adminMobileContext.newPage();
  await drawerPage.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "networkidle" });
  const menuButton = drawerPage.locator("button[aria-label='Open menu']");
  if (await menuButton.isVisible()) {
    await menuButton.click();
    await drawerPage.waitForTimeout(300);
    await drawerPage.screenshot({ path: path.join(outputDir, "mobile-interactive-drawer.png") });
  }
  await drawerPage.close();

  // Teacher pages
  const teacherPages = [
    { name: "teacher-01-dashboard", path: "/teacher" },
    { name: "teacher-02-attendance", path: "/teacher/attendance" },
    { name: "teacher-03-tests", path: "/teacher/tests" },
    { name: "teacher-04-report-cards", path: "/teacher/report-cards" },
    { name: "teacher-05-agenda", path: "/teacher/agenda" },
  ];

  for (const item of teacherPages) {
    console.log(`Capturing teacher desktop: ${item.name}`);
    const page = await teacherDesktopContext.newPage();
    await page.goto(`${BASE_URL}${item.path}`, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, `desktop-${item.name}.png`), fullPage: true });
    await page.close();
  }

  await browser.close();
  console.log("All screenshots captured successfully!");
}

capture().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
