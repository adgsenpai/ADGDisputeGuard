// Records the DisputeGuard showcase: a narrated end-to-end walkthrough of the
// landing page and the /console flows (open a dispute, drive the role-gated
// lifecycle, upload evidence, run the bounded investigation, read the audit
// trail). Produces an optimised MP4 and GIF under testing/media, plus short
// per-flow GIFs.
//
// Usage:  node testing/record-showcase.mjs
// Requires: a production build of apps/web (next build) and the `chrome`
// channel; ffmpeg on PATH for MP4/GIF conversion.
//
// The investigation is recorded against the deterministic fallback (Ollama URL
// pointed at an unreachable endpoint) so the clip is fast and reproducible on
// any machine; the same UI drives a real Ollama model when one is configured.

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { mkdir, rm, readdir, rename } from "node:fs/promises";
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

function sh(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error(`server at ${url} did not become ready`);
}

// Fixed caption overlay used to narrate the recording.
async function installCaption(page) {
  await page.addStyleTag({
    content: `
      #sc-cap{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;
        font:600 22px/1.4 system-ui,Segoe UI,Roboto,sans-serif;color:#fff;
        padding:18px 28px;background:linear-gradient(0deg,rgba(6,12,24,.92),rgba(6,12,24,0));
        letter-spacing:.2px;transition:opacity .25s;pointer-events:none}
      #sc-cap b{color:#5eead4}
    `,
  });
  await page.evaluate(() => {
    const el = document.createElement("div");
    el.id = "sc-cap";
    document.body.appendChild(el);
  });
}
async function caption(page, html, hold = 1200) {
  await page.evaluate((h) => {
    const el = document.getElementById("sc-cap");
    if (el) el.innerHTML = h;
  }, html);
  await page.waitForTimeout(hold);
}

const UNREACHABLE_OLLAMA = { OLLAMA_BASE_URL: "http://127.0.0.1:9", OLLAMA_TIMEOUT_MS: "800" };

async function ffmpegToMp4(webm, out) {
  await sh("ffmpeg", ["-y", "-i", webm, "-movflags", "+faststart", "-pix_fmt", "yuv420p",
    "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
    "-r", "30", out]);
}
async function ffmpegToGif(webm, out, { width = 900, fps = 12 } = {}) {
  const palette = path.join(RAW, "palette.png");
  const vf = `fps=${fps},scale=${width}:-1:flags=lanczos`;
  await sh("ffmpeg", ["-y", "-i", webm, "-vf", `${vf},palettegen=stats_mode=diff`, palette]);
  await sh("ffmpeg", ["-y", "-i", webm, "-i", palette,
    "-lavfi", `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`, out]);
}

// Record one clip: open a context with video, run `fn`, then return the webm path.
async function record(browser, fn) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: RAW, size: { width: 1280, height: 720 } },
    baseURL: BASE,
  });
  const page = await ctx.newPage();
  await fn(page);
  const video = page.video();
  await ctx.close(); // flush video
  const src = await video.path();
  return src;
}

async function main() {
  await rm(RAW, { recursive: true, force: true });
  await mkdir(RAW, { recursive: true });
  await mkdir(VIDEOS, { recursive: true });
  await mkdir(GIFS, { recursive: true });

  console.log(`[showcase] starting app on ${BASE} ...`);
  const server = spawn("npm", ["run", "start", "--", "--port", PORT], {
    cwd: WEB,
    env: { ...process.env, ...UNREACHABLE_OLLAMA },
    stdio: "ignore",
  });

  let browser;
  try {
    await waitForServer(BASE);
    console.log("[showcase] app ready; launching Chrome");
    browser = await chromium.launch({ channel: "chrome" });

    // ---- Full showcase walkthrough ----
    const showcaseWebm = await record(browser, async (page) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await installCaption(page);
      await caption(page, "<b>DisputeGuard</b> — every dispute deserves clarity", 1800);
      for (const id of ["approach", "workflow", "architecture", "ralph", "documentation"]) {
        await page.locator(`#${id}`).scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(700);
      }

      await page.goto("/console", { waitUntil: "domcontentloaded" });
      await installCaption(page);
      await caption(page, "The working <b>console</b> — real dispute flows", 1400);

      await caption(page, "Open a dispute <b>·</b> ownership &amp; idempotent creation", 1000);
      await page.locator(".row", { hasText: "Takealot" })
        .getByRole("button", { name: "Open dispute" }).click();
      await page.waitForTimeout(1200);

      await caption(page, "Switch role to <b>Analyst</b> — transitions are role-gated", 1200);
      await page.locator("#role").selectOption("9");
      await page.waitForTimeout(900);

      await caption(page, "Drive the <b>authorised lifecycle</b>, server-checked", 900);
      await page.getByRole("button", { name: "begin review" }).click();
      await page.waitForTimeout(900);
      await page.getByRole("button", { name: "begin investigation" }).click();
      await page.waitForTimeout(900);

      await caption(page, "Upload <b>evidence</b> — validated server-side", 900);
      await page.getByRole("button", { name: "Upload sample evidence" }).click();
      await page.waitForTimeout(1100);

      await caption(page, "Run the <b>bounded AI investigation</b> — allowlist &amp; budget enforced", 1000);
      await page.getByRole("button", { name: "Run bounded investigation" }).click();
      await page.locator(".summary").waitFor({ state: "visible", timeout: 15_000 });
      await page.waitForTimeout(1600);

      await caption(page, "Approve the case <b>·</b> full <b>audit trail</b> recorded", 900);
      await page.getByRole("button", { name: "approve", exact: true }).click();
      await page.waitForTimeout(1000);
      await page.locator(".panel", { hasText: "Audit trail" }).scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(1400);

      await caption(page, "<b>Secure · Explainable · Auditable</b> — tested end to end", 2000);
    });

    console.log("[showcase] encoding showcase.mp4 + showcase.gif");
    await ffmpegToMp4(showcaseWebm, path.join(VIDEOS, "showcase.mp4"));
    await ffmpegToGif(showcaseWebm, path.join(GIFS, "showcase.gif"), { width: 960, fps: 12 });

    // ---- Short per-flow clips (GIFs) ----
    const flows = [
      ["landing", async (page) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await installCaption(page);
        await caption(page, "<b>Landing</b>", 700);
        for (const id of ["approach", "workflow", "architecture", "documentation"]) {
          await page.locator(`#${id}`).scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(600);
        }
      }],
      ["dispute-lifecycle", async (page) => {
        await page.goto("/console", { waitUntil: "domcontentloaded" });
        await installCaption(page);
        await caption(page, "Open dispute <b>·</b> analyst lifecycle", 700);
        await page.locator(".row", { hasText: "Checkers Sixty60" })
          .getByRole("button", { name: "Open dispute" }).click();
        await page.waitForTimeout(700);
        await page.locator("#role").selectOption("9");
        await page.waitForTimeout(500);
        await page.getByRole("button", { name: "begin review" }).click();
        await page.waitForTimeout(600);
        await page.getByRole("button", { name: "begin investigation" }).click();
        await page.waitForTimeout(600);
        await page.getByRole("button", { name: "approve", exact: true }).click();
        await page.waitForTimeout(900);
      }],
      ["investigation", async (page) => {
        await page.goto("/console", { waitUntil: "domcontentloaded" });
        await installCaption(page);
        await caption(page, "Bounded <b>AI investigation</b>", 700);
        await page.locator(".row", { hasText: "Mr Price" })
          .getByRole("button", { name: "Open dispute" }).click();
        await page.waitForTimeout(700);
        await page.getByRole("button", { name: "Run bounded investigation" }).click();
        await page.locator(".summary").waitFor({ state: "visible", timeout: 15_000 });
        await page.waitForTimeout(1600);
      }],
    ];
    for (const [name, fn] of flows) {
      console.log(`[showcase] recording flow: ${name}`);
      const webm = await record(browser, fn);
      await ffmpegToGif(webm, path.join(GIFS, `${name}.gif`), { width: 820, fps: 11 });
    }

    console.log("[showcase] done");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await sleep(500);
    await rm(RAW, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
