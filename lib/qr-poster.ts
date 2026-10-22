import QRCode from "qrcode";

/** A QR code as a PNG data URL. */
export function qrDataUrl(url: string, width = 520): Promise<string> {
  return QRCode.toDataURL(url, { width, margin: 1, errorCorrectionLevel: "M", color: { dark: "#2b170d", light: "#ffffff" } });
}

/** A print-ready poster: restaurant name, a short invitation and the QR code. Returns a PNG data URL. */
export async function qrPoster(url: string, restaurantName: string): Promise<string> {
  const W = 1200;
  const H = 1700;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available");

  ctx.fillStyle = "#fffdf6";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#c8431f";
  ctx.lineWidth = 12;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  ctx.textAlign = "center";
  ctx.fillStyle = "#2b170d";
  ctx.font = "700 92px Georgia, 'Times New Roman', serif";
  wrap(ctx, restaurantName, W / 2, 250, W - 240, 104);

  ctx.font = "600 64px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("How was your visit?", W / 2, 560);
  ctx.font = "400 40px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#6f5642";
  ctx.fillText("Scan to tell us. It takes under a minute.", W / 2, 630);

  const img = new Image();
  img.src = await qrDataUrl(url, 760);
  await new Promise<void>((ok, fail) => {
    img.onload = () => ok();
    img.onerror = () => fail(new Error("QR image failed"));
  });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(200, 700, 800, 800);
  ctx.drawImage(img, 220, 720, 760, 760);

  ctx.fillStyle = "#6f5642";
  ctx.font = "400 30px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText(url.replace(/^https?:\/\//, ""), W / 2, 1580);
  return canvas.toDataURL("image/png");
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/);
  let line = "";
  let cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = w;
      cy += lineHeight;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, cy);
}
