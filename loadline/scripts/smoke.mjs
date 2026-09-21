/**
 * Browser smoke test.
 *
 * Drives the whole product in a real browser: set branding, upload a logo,
 * create a project, generate its RAMS pack, and confirm the job code register
 * increments across independent series. Exits non-zero on any failure.
 *
 *   npm run build && npm start &
 *   npm run smoke
 *
 * CHROMIUM_PATH pins a specific browser binary where the environment ships one
 * that does not match Playwright's expected build.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3222";
const SHOTS = process.env.SHOTS ?? "./smoke-screenshots";
const LOGO = process.env.LOGO ?? "./scripts/fixtures/logo.png";

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

const fail = [];
const check = (label, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); if (!ok) fail.push(label); };

// 1. Empty state
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
check("projects page loads", await page.getByRole("heading", { name: "Projects" }).isVisible());
check("empty state shown", (await page.locator("text=No projects yet").count()) > 0);
await shot("1-empty");

// 2. Branding: upload logo and set colours BEFORE generating, so documents carry them
await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
await page.locator('input[name="companyName"]').fill("Sculptivate");
await page.locator('input[name="logo"]').setInputFiles(LOGO);
await page.locator('input[name="primary"]').fill("#7a1f3d");
await page.locator('input[name="accent"]').fill("#c8963e");
await page.locator('input[name="documentFooter"]').fill("Sculptivate Ltd — Production Safety Pack 2026 v1.0");
await page.locator('textarea[name="registeredDetails"]').fill("Sculptivate Ltd, registered in England 09876543. Employer's liability insured to £10m.");
await shot("2-branding-form");

await page.getByRole("button", { name: /Save branding/ }).click();
await page.waitForSelector("text=/Branding saved/", { timeout: 15000 });
check("branding saved", true);
await page.reload({ waitUntil: "networkidle" });
const headerLogo = page.locator('header img[alt="Sculptivate"]');
check("logo appears in app header", await headerLogo.count() > 0);
await shot("3-branded");

// 3. Create a project
await page.goto(`${BASE}/projects/new`, { waitUntil: "networkidle" });
await page.locator('input[name="name"]').fill("Winter Gala");
await page.locator('input[name="client"]').fill("Northern Arts Trust");
await page.locator('input[name="productionManager"]').fill("A. Reed");
await page.locator('select[name="status"]').selectOption("confirmed");
await page.locator('input[name="startDate"]').fill("2026-11-02");
await page.locator('input[name="endDate"]').fill("2026-11-14");
await page.locator('input[name="venues"]').fill("Leeds Playhouse, Sheffield Crucible");
await shot("4-new-project");

await page.getByRole("button", { name: /Create project/ }).click();
await page.waitForURL(/\/projects\/PROD2026-001a/, { timeout: 20000 });
check("job code PROD2026-001a issued automatically", page.url().includes("PROD2026-001a"));
check("risk register rendered", (await page.locator("text=Risk register").count()) > 0);
check("HIGH band shown before controls", (await page.locator("text=15 HIGH").count()) > 0);
check("residual risk reduced to LOW", (await page.locator("text=4 LOW").count()) > 0);
await shot("5-project");

// 4. Generate the RAMS pack
await page.getByRole("button", { name: /Generate RAMS pack/ }).click();
await page.waitForSelector("text=/issued as PROD2026-001a/", { timeout: 30000 });
check("RAMS pack generated", true);
await page.reload({ waitUntil: "networkidle" });
check("risk assessment listed", (await page.locator("text=Risk Assessment PROD2026-001a.docx").count()) > 0);
check("method statement listed", (await page.locator("text=Method Statement PROD2026-001a.docx").count()) > 0);
await shot("6-generated");

// 5. Second project proves the register increments rather than repeating
await page.goto(`${BASE}/projects/new`, { waitUntil: "networkidle" });
await page.locator('input[name="name"]').fill("Spring Tour");
await page.locator('select[name="prefix"]').selectOption("SM");
await page.getByRole("button", { name: /Create project/ }).click();
await page.waitForURL(/\/projects\/SM2026-001a/, { timeout: 20000 });
check("independent SM series starts at SM2026-001a", page.url().includes("SM2026-001a"));

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
check("both projects listed", (await page.locator("li").filter({ hasText: /2026-001a/ }).count()) >= 2);
await shot("7-projects-list");

// 6. Mobile layout
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/projects/PROD2026-001a`, { waitUntil: "networkidle" });
const scrollX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
check("no horizontal page scroll at 390px", !scrollX);
await shot("8-mobile");

await browser.close();
console.log(fail.length ? `\n${fail.length} FAILED: ${fail.join(", ")}` : "\nAll checks passed.");
process.exit(fail.length ? 1 : 0);
