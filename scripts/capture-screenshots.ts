import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3020";
const SCREENSHOT_DIR = join(process.cwd(), ".director", "screenshots");

mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function run() {
  console.log(`Connecting to ${BASE_URL}...`);
  const browser = await chromium.launch({ headless: true });

  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  // Authenticate desktop
  const page = await desktopContext.newPage();
  await page.goto(`${BASE_URL}/sign-in`);
  await page.fill('input[type="email"]', "owner@local.test");
  await page.fill('input[type="password"]', "local-dev-password");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);

  const routes = [
    { path: "/dashboard", name: "overview" },
    { path: "/dashboard/bookings", name: "bookings" },
    { path: "/dashboard/leads", name: "leads" },
    { path: "/dashboard/settings?section=profile", name: "settings-profile" },
    {
      path: "/dashboard/settings?section=offerings",
      name: "settings-offerings",
    },
    { path: "/dashboard/settings?section=schedule", name: "settings-schedule" },
    { path: "/dashboard/settings?section=pricing", name: "settings-pricing" },
    { path: "/dashboard/settings?section=faqs", name: "settings-faqs" },
    { path: "/dashboard/settings?section=agent", name: "settings-agent" },
    { path: "/dashboard/settings?section=branding", name: "settings-branding" },
  ];

  for (const { path, name } of routes) {
    console.log(`Capturing desktop: ${name}...`);
    await page.goto(`${BASE_URL}${path}`);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `desktop-${name}.png`),
      fullPage: true,
    });
  }

  // Authenticate mobile
  const mPage = await mobileContext.newPage();
  await mPage.goto(`${BASE_URL}/sign-in`);
  await mPage.fill('input[type="email"]', "owner@local.test");
  await mPage.fill('input[type="password"]', "local-dev-password");
  await mPage.click('button[type="submit"]');
  await mPage.waitForURL(`${BASE_URL}/dashboard`);

  for (const { path, name } of routes) {
    console.log(`Capturing mobile: ${name}...`);
    await mPage.goto(`${BASE_URL}${path}`);
    await mPage.waitForTimeout(500);
    await mPage.screenshot({
      path: join(SCREENSHOT_DIR, `mobile-${name}.png`),
      fullPage: true,
    });
  }

  await browser.close();
  console.log("Screenshots captured successfully.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
