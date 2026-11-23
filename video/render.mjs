// Renders video/pitch.html to an MP4: node video/render.mjs <puppeteer-core dir> <ffmpeg path> <output.mp4> [seconds]
// It steps time through the page's window.render(t) at 30 frames a second and pipes the frames to ffmpeg.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const [, , toolsDir, ffmpeg, out, secondsArg] = process.argv;
const require = createRequire(path.join(toolsDir, "package.json"));
const puppeteer = require("puppeteer-core");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FPS = 30;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await page.goto(new URL("./pitch.html", import.meta.url).href);
const duration = secondsArg ? Number(secondsArg) : await page.evaluate(() => window.DURATION);
const frames = Math.round(duration * FPS);

const ff = spawn(ffmpeg, ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
const done = new Promise((resolve, reject) => { ff.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg exited ${c}`)))); });
for (let i = 0; i < frames; i++) {
  const b64 = await page.evaluate((t) => { window.render(t); return document.getElementById("c").toDataURL("image/jpeg", 0.95).split(",")[1]; }, i / FPS);
  if (!ff.stdin.write(Buffer.from(b64, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 150 === 0) console.log(`frame ${i}/${frames}`);
}
ff.stdin.end();
await done;
await browser.close();
console.log("wrote", out);
