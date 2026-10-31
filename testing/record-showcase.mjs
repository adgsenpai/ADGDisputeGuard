// Records the DisputeGuard showcase: a narrated walkthrough of the SaaS console
// — passwordless persona sign-in, the dashboard, the transactions tab, the
// dispute case workspace (role-gated lifecycle, evidence, bounded investigation)
// and the audit log. Produces an optimised MP4 and GIF under testing/media,
// plus short per-flow GIFs.
//
// Usage:  node testing/record-showcase.mjs
// Requires: a production build of apps/web (next build), the `chrome` channel,
// and ffmpeg on PATH.
//
// The investigation is recorded against the deterministic fallback (Ollama URL
// pointed at an unreachable endpoint) so the clip is fast and reproducible; the
// same UI drives a real Ollama model when one is configured.

import { chromium } from "@playwright/test";
import { spawn, execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WEB = path.join(ROOT, "apps", "web");
const PORT = process.env.SHOWCASE_PORT || "3123";
const BASE = `http://localhost:${PORT}`;
const MEDIA = path.join(__dirname, "media");
const RAW = path.join(MEDIA, ".raw");
const VIDEOS = path.join(MEDIA, "videos");
const GIFS = path.join(MEDIA, "gifs");
const UNREACHABLE_OLLAMA = { OLLAMA_BASE_URL: "http://127.0.0.1:9", OLLAMA_TIMEOUT_MS: "800" };

function killPort(port) {
  // Kill whatever is listening on the port (next-server renames its process,
  // so match by port, not command line).
  try {
    execSync(
      `bash -c 'p=$(ss -ltnp 2>/dev/null | grep ":${port} " | grep -oP "pid=\\K[0-9]+" | head -1); [ -n "$p" ] && kill "$p" 2>/dev/null || true'`,
      { stdio: "ignore" },
    );
  } catch {}
}

function sh(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}
async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`server at ${url} not ready`);
}
function api(p, uid, role, body) {
  return fetch(BASE + p, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-user-id": uid, "x-user-role": role },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function installCaption(page) {
  await page.addStyleTag({
    content: `#sc-cap{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;
      font:600 22px/1.4 system-ui,Segoe UI,Roboto,sans-serif;color:#fff;padding:18px 28px;
      background:linear-gradient(0deg,rgba(6,12,24,.92),rgba(6,12,24,0));pointer-events:none}
      #sc-cap b{color:#5eead4}`,
  });
  await page.evaluate(() => {
    if (!document.getElementById("sc-cap")) {
      const el = document.createElement("div");
      el.id = "sc-cap";
      document.body.appendChild(el);
    }
  });
}
async function caption(page, html, hold = 1200) {
  await page.evaluate((h) => {
    const el = document.getElementById("sc-cap");
    if (el) el.innerHTML = h;
  }, html);
  await page.waitForTimeout(hold);
}

async function ffmpegToMp4(webm, out) {
  await sh("ffmpeg", ["-y", "-i", webm, "-movflags", "+faststart", "-pix_fmt", "yuv420p",
    "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2", "-r", "30", out]);
}
async function ffmpegGifFrom(src, out, { width = 960, fps = 12 } = {}) {
  const palette = path.join(RAW, "palette.png");
  const vf = `fps=${fps},scale=${width}:-1:flags=lanczos`;
  await sh("ffmpeg", ["-y", "-i", src, "-vf", `${vf},palettegen=stats_mode=diff`, palette]);
  await sh("ffmpeg", ["-y", "-i", src, "-i", palette, "-lavfi", `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`, out]);
}

async function record(browser, fn) {
  const ctx = await browser.newContext({
    viewport: { width: 1360, height: 820 },
    recordVideo: { dir: RAW, size: { width: 1360, height: 820 } },
    baseURL: BASE,
  });
  const page = await ctx.newPage();
  await fn(page);
  const video = page.video();
  await ctx.close();
  return video.path();
}

async function signIn(page, name) {
  await page.getByRole("button", { name: `Sign in as ${name}` }).click();
  await page.getByTestId("console-shell").waitFor({ state: "visible" });
}
async function nav(page, key) {
  await page.locator(`[data-nav="${key}"]`).click();
  await page.waitForTimeout(500);
}

async function seed() {
  // Portfolio data so the dashboard and registers are populated.
  const d1 = await (await api("/api/disputes", "1", "customer", { transactionId: 42, reason: "x", idempotencyKey: "sc1" })).json();
  let v = d1.dispute.version;
  for (const ev of ["begin_review", "begin_investigation", "approve"]) {
    v = (await (await api(`/api/disputes/${d1.dispute.id}/transition`, "9", "analyst", { event: ev, expectedVersion: v })).json()).dispute.version;
  }
  await api("/api/disputes", "2", "customer", { transactionId: 70, reason: "x", idempotencyKey: "sc2" });
  const d3 = await (await api("/api/disputes", "3", "customer", { transactionId: 82, reason: "x", idempotencyKey: "sc3" })).json();
  await api(`/api/disputes/${d3.dispute.id}/transition`, "9", "analyst", { event: "begin_review", expectedVersion: d3.dispute.version });
  const d4 = await (await api("/api/disputes", "4", "customer", { transactionId: 90, reason: "x", idempotencyKey: "sc4" })).json();
  await api(`/api/disputes/${d4.dispute.id}/evidence`, "4", "customer", { upload: { name: "statement.pdf", declaredType: "application/pdf", detectedType: "application/pdf", sizeBytes: 20480 }, scan: "clean" });
  await api(`/api/disputes/${d4.dispute.id}/investigate`, "4", "customer");
}

async function main() {
  await rm(RAW, { recursive: true, force: true });
  await mkdir(RAW, { recursive: true });
  await mkdir(VIDEOS, { recursive: true });
  await mkdir(GIFS, { recursive: true });

  // Kill any leftover server holding the port so we start from fresh state.
  killPort(PORT);
  await sleep(700);

  console.log(`[showcase] starting app on ${BASE}`);
  const server = spawn("npm", ["run", "start", "--", "--port", PORT], {
    cwd: WEB,
    env: { ...process.env, ...UNREACHABLE_OLLAMA },
    stdio: "ignore",
    detached: true,
  });

  let browser;
  try {
    await waitForServer(BASE);
    await seed();
    console.log("[showcase] seeded; launching Chrome");
    browser = await chromium.launch({ channel: "chrome" });

    const showcaseWebm = await record(browser, async (page) => {
      await page.goto("/console", { waitUntil: "domcontentloaded" });
      await installCaption(page);
      await caption(page, "<b>DisputeGuard</b> — passwordless sign-in, your <b>RBAC role</b> from your persona", 1900);

      // Customer: browse and open a dispute.
      await signIn(page, "Thabo Nkosi");
      await installCaption(page);
      await caption(page, "Signed in as a <b>Customer</b>", 1100);
      await nav(page, "transactions");
      await caption(page, "<b>Transactions</b> — search, filter, advisory risk", 1400);
      await page.getByLabel("Search transactions").fill("Takealot");
      await page.waitForTimeout(1000);
      await page.getByLabel("Search transactions").fill("");
      await caption(page, "Open a <b>dispute</b> — ownership &amp; idempotency checked", 1000);
      await page.locator(".trow", { hasText: "Checkers Sixty60" }).getByRole("button", { name: "Open dispute" }).click();
      await page.waitForTimeout(1000);

      // Switch to the analyst.
      await page.getByRole("button", { name: "Sign out" }).first().click();
      await page.waitForTimeout(400);
      await signIn(page, "Nomsa Mahlangu");
      await installCaption(page);
      await caption(page, "Now an <b>Analyst</b> — the portfolio <b>dashboard</b>: KPIs &amp; charts", 1900);
      await page.waitForTimeout(900);

      await nav(page, "disputes");
      await caption(page, "The <b>dispute queue</b> and case workspace", 1200);
      await page.locator('.trow:has-text("(tx 43)")').getByRole("button", { name: "Inspect" }).click();
      await page.waitForTimeout(900);
      await caption(page, "Drive the <b>authorised lifecycle</b>, server-checked", 900);
      await page.getByRole("button", { name: "begin review" }).click();
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: "begin investigation" }).click();
      await page.waitForTimeout(800);
      await caption(page, "Run the <b>bounded AI investigation</b> — allowlist &amp; budget enforced", 1000);
      await page.getByRole("button", { name: "Run bounded investigation" }).click();
      await page.locator(".summary").waitFor({ state: "visible", timeout: 15_000 });
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: "approve", exact: true }).click();
      await page.waitForTimeout(1000);

      await nav(page, "audit");
      await caption(page, "Every change recorded in the <b>audit log</b>", 1600);

      await nav(page, "dashboard");
      await caption(page, "<b>Secure · Explainable · Auditable</b> — tested end to end", 2000);
    });

    console.log("[showcase] encoding showcase.mp4 + showcase.gif");
    await ffmpegToMp4(showcaseWebm, path.join(VIDEOS, "showcase.mp4"));
    await ffmpegGifFrom(path.join(VIDEOS, "showcase.mp4"), path.join(GIFS, "showcase.gif"), { width: 760, fps: 10 });

    const flows = [
      ["login", async (page) => {
        await page.goto("/console", { waitUntil: "domcontentloaded" });
        await installCaption(page);
        await caption(page, "Passwordless <b>persona sign-in</b>", 1600);
        await page.waitForTimeout(600);
      }],
      ["dashboard", async (page) => {
        await page.goto("/console", { waitUntil: "domcontentloaded" });
        await signIn(page, "Nomsa Mahlangu");
        await installCaption(page);
        await caption(page, "Portfolio <b>dashboard</b>", 1500);
        await page.waitForTimeout(900);
      }],
      ["case-workspace", async (page) => {
        await page.goto("/console", { waitUntil: "domcontentloaded" });
        await signIn(page, "Nomsa Mahlangu");
        await nav(page, "disputes");
        await installCaption(page);
        await caption(page, "Case <b>workspace</b>", 900);
        await page.locator('.trow:has-text("Dispute #")').first().getByRole("button", { name: "Inspect" }).click();
        await page.waitForTimeout(1600);
      }],
    ];
    for (const [name, fn] of flows) {
      console.log(`[showcase] recording flow: ${name}`);
      const webm = await record(browser, fn);
      await ffmpegGifFrom(webm, path.join(GIFS, `${name}.gif`), { width: 820, fps: 11 });
    }

    console.log("[showcase] done");
  } finally {
    if (browser) await browser.close().catch(() => {});
    try { process.kill(-server.pid, "SIGTERM"); } catch {}
    killPort(PORT);
    await sleep(500);
    await rm(RAW, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
