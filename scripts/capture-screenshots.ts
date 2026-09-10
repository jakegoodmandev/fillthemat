import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { readEnvFile } from "./local-env";

const BASE =
  readEnvFile(".env.local").NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
const OUT = ".director/screenshots";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const ROUTES: Array<{ name: string; path: string; mobile?: boolean }> = [
  { name: "overview", path: "/dashboard" },
  { name: "bookings", path: "/dashboard/bookings" },
  { name: "bookings-all", path: "/dashboard/bookings?filter=all" },
  { name: "bookings-past", path: "/dashboard/bookings?filter=past" },
  { name: "leads", path: "/dashboard/leads" },
  { name: "settings-school", path: "/dashboard/settings" },
  {
    name: "settings-trial-classes",
    path: "/dashboard/settings?section=offerings",
  },
  { name: "settings-schedule", path: "/dashboard/settings?section=schedule" },
  { name: "settings-pricing", path: "/dashboard/settings?section=pricing" },
  { name: "settings-faqs", path: "/dashboard/settings?section=faqs" },
  { name: "settings-agent", path: "/dashboard/settings?section=agent" },
  { name: "settings-branding", path: "/dashboard/settings?section=branding" },
];

async function signIn(page: import("@playwright/test").Page) {
  await page.goto(`${BASE}/sign-in`);
  const form = page.locator("form", { hasText: "Local email auth" });
  await form.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    await signIn(page);

    for (const route of ROUTES) {
      await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle" });
      // Force a stable settle for client-side hydration and images.
      await page.waitForTimeout(250);
      const filename = `${OUT}/${viewport.name}-${route.name}.png`;
      await page.screenshot({ path: filename, fullPage: false });
      // eslint-disable-next-line no-console
      console.log(filename);
    }

    await context.close();
  }

  // Narrow-width overflow check at 320px.
  const narrow = await browser.newContext({
    viewport: { width: 320, height: 700 },
  });
  const page = await narrow.newPage();
  await signIn(page);
  for (const path of [
    "/dashboard",
    "/dashboard/bookings",
    "/dashboard/leads",
    "/dashboard/settings?section=schedule",
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `${OUT}/narrow-${path.replaceAll("/", "_")}.png`,
    });
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    // eslint-disable-next-line no-console
    console.log(`overflow(${path}): ${overflow}px`);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
