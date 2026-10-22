"use client";

import type { Rasterizer } from "./pdf";

const SCALE = 3; // draw at 3x so printed text stays sharp

/**
 * Draws text with the browser, which knows how to shape Hindi (joined letters, vowel signs) properly.
 * The PDF writer places each drawn line as an image. Latin text in the report stays real text.
 */
export async function createRasterizer(): Promise<Rasterizer | null> {
  if (typeof document === "undefined") return null;
  const css = getComputedStyle(document.documentElement).getPropertyValue("--font-devanagari").trim();
  const family = `${css ? `${css}, ` : ""}"Noto Sans Devanagari", "Kohinoor Devanagari", "Devanagari Sangam MN", "Helvetica Neue", Arial, sans-serif`;

  // Make sure the font has actually loaded before measuring or drawing with it.
  try {
    await Promise.all([
      document.fonts.load(`400 20px ${family}`, "अआक"),
      document.fonts.load(`700 20px ${family}`, "अआक"),
    ]);
  } catch {
    // draw with whatever the browser has
  }

  const measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return null;

  const fontFor = (size: number, bold: boolean, scale: number) => `${bold ? 700 : 400} ${size * scale}px ${family}`;

  return {
    measure(text, size, bold) {
      measureCtx.font = fontFor(size, bold, 1);
      return measureCtx.measureText(text).width;
    },
    render(text, size, bold, color, bg, leading) {
      const widthPt = Math.ceil(textWidthOf(measureCtx, fontFor(size, bold, 1), text)) + 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(widthPt * SCALE);
      canvas.height = Math.ceil(leading * SCALE);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      const css = (c: [number, number, number]) => `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
      ctx.fillStyle = css(bg);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = css(color);
      ctx.font = fontFor(size, bold, SCALE);
      ctx.textBaseline = "alphabetic";
      const baseline = leading * 0.74;
      ctx.fillText(text, SCALE, baseline * SCALE);
      const data = canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
      const bin = atob(data);
      const jpeg = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) jpeg[i] = bin.charCodeAt(i);
      return { jpeg, pxW: canvas.width, pxH: canvas.height, widthPt: canvas.width / SCALE, heightPt: canvas.height / SCALE, baseline };
    },
  };
}

function textWidthOf(ctx: CanvasRenderingContext2D, font: string, text: string): number {
  ctx.font = font;
  return ctx.measureText(text).width;
}
