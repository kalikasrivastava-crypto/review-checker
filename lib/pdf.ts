/**
 * A tiny PDF writer, enough for a one-or-two page evidence report: wrapped text, rules, boxes and a table.
 * Latin text uses the PDF standard fonts, so there is nothing to download or install.
 *
 * Text in other scripts (such as Hindi) can't be written with those fonts. If a `Rasterizer` is given,
 * those lines are drawn by the browser, which shapes them correctly, and placed as images. Without one,
 * such characters become "?".
 */

export type FontName = "regular" | "bold" | "italic";
const FONT_KEY: Record<FontName, string> = { regular: "F1", bold: "F2", italic: "F3" };

type Rgb = [number, number, number];

export interface RasterLine {
  jpeg: Uint8Array;
  pxW: number;
  pxH: number;
  widthPt: number;
  heightPt: number;
  baseline: number; // points from the top of the image to the text baseline
}

export interface Rasterizer {
  measure(text: string, size: number, bold: boolean): number;
  render(text: string, size: number, bold: boolean, color: Rgb, bg: Rgb, leading: number): RasterLine;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 52;

// Characters outside plain ASCII that the PDF standard encoding (WinAnsi) can show.
const WIN_ANSI: Record<string, string> = {
  "‘": "\\221",
  "’": "\\222",
  "“": "\\223",
  "”": "\\224",
  "•": "\\225",
  "–": "\\226",
  "—": "\\227",
  "…": "\\205",
  "€": "\\200",
  "£": "\\243",
  "×": "\\327",
  "★": "*",
  "☆": "*",
  "₹": "Rs ",
};

const isStandardChar = (ch: string) => {
  const c = ch.charCodeAt(0);
  return (c >= 32 && c < 127) || (c >= 0xa0 && c <= 0xff) || ch in WIN_ANSI || ch === "\n" || ch === "\t" || ch === "\r";
};

/** True if the text has characters the standard fonts can't draw (Hindi, for example). */
export const needsRaster = (text: string) => [...text].some((ch) => !isStandardChar(ch));

/** Escape text so it can sit inside a PDF string. */
function pdfText(text: string): string {
  let out = "";
  for (const ch of text.replace(/\r/g, "")) {
    if (WIN_ANSI[ch]) out += WIN_ANSI[ch];
    else if (ch === "\\" || ch === "(" || ch === ")") out += `\\${ch}`;
    else if (ch === "\n" || ch === "\t") out += " ";
    else if (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127) out += ch;
    else if (ch.charCodeAt(0) >= 0xa0 && ch.charCodeAt(0) <= 0xff) out += `\\${ch.charCodeAt(0).toString(8)}`; // Latin-1 letters and the middle dot
    else out += "?";
  }
  return out;
}

/** Rough text width in points, from typical Helvetica proportions. Errs a little wide so lines never overflow. */
function textWidth(text: string, size: number, font: FontName): number {
  let units = 0;
  for (const ch of text) {
    if ("iIl.,:;'|!".includes(ch)) units += 0.28;
    else if ("fjrt()[]-/ ".includes(ch)) units += 0.34;
    else if ("mwMW@%".includes(ch)) units += 0.84;
    else if (ch >= "A" && ch <= "Z") units += 0.68;
    else if (ch >= "0" && ch <= "9") units += 0.56;
    else units += 0.52;
  }
  return units * size * (font === "bold" ? 1.07 : 1) * 1.03;
}

function wrapWith(text: string, maxWidth: number, width: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && width(next) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function wrapText(text: string, size: number, font: FontName, maxWidth: number): string[] {
  return wrapWith(text, maxWidth, (s) => textWidth(s, size, font));
}

const rgb = (c: Rgb) => `${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)}`;
const INK: Rgb = [0.12, 0.09, 0.07];
const WHITE: Rgb = [1, 1, 1];

const ascii = (s: string) => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};

export class PdfDoc {
  private pages: string[][] = [[]];
  private images: RasterLine[] = [];
  y = PAGE_H - MARGIN;
  readonly left = MARGIN;
  readonly width = PAGE_W - 2 * MARGIN;

  constructor(private raster: Rasterizer | null = null) {}

  private get ops() {
    return this.pages[this.pages.length - 1];
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN) {
      this.pages.push([]);
      this.y = PAGE_H - MARGIN;
    }
  }

  gap(points: number) {
    this.y -= points;
  }

  private useRaster(text: string) {
    return !!this.raster && needsRaster(text);
  }

  /** Wrap text for the drawing method it will use, so line breaks match what is drawn. */
  private lines(text: string, size: number, font: FontName, width: number): string[] {
    if (this.useRaster(text)) return wrapWith(text, width, (s) => this.raster!.measure(s, size, font === "bold"));
    return wrapText(text, size, font, width);
  }

  /** Draw one line with its baseline at (x, baselineY). */
  private drawLine(line: string, x: number, baselineY: number, size: number, font: FontName, color: Rgb, bg: Rgb, leading: number, raster: boolean) {
    if (raster && this.raster) {
      const img = this.raster.render(line, size, font === "bold", color, bg, leading);
      this.images.push(img);
      const bottom = baselineY - (img.heightPt - img.baseline);
      this.ops.push(
        `q ${img.widthPt.toFixed(2)} 0 0 ${img.heightPt.toFixed(2)} ${x.toFixed(2)} ${bottom.toFixed(2)} cm /Im${this.images.length - 1} Do Q`,
      );
      return;
    }
    this.ops.push(`BT /${FONT_KEY[font]} ${size} Tf ${rgb(color)} rg ${x.toFixed(2)} ${baselineY.toFixed(2)} Td (${pdfText(line)}) Tj ET`);
  }

  /** Wrapped paragraph. Moves the cursor down. */
  text(
    value: string,
    opts: { size?: number; font?: FontName; color?: Rgb; x?: number; width?: number; leading?: number } = {},
  ) {
    const size = opts.size ?? 10.5;
    const font = opts.font ?? "regular";
    const x = opts.x ?? this.left;
    const width = opts.width ?? this.width;
    const leading = opts.leading ?? size * 1.4;
    const raster = this.useRaster(value);
    for (const line of this.lines(value, size, font, width)) {
      this.ensure(leading);
      this.y -= leading;
      this.drawLine(line, x, this.y, size, font, opts.color ?? INK, WHITE, leading, raster);
    }
  }

  rule(color: Rgb = [0.8, 0.76, 0.68]) {
    this.ensure(6);
    this.ops.push(`${rgb(color)} RG 0.8 w ${this.left} ${this.y.toFixed(2)} m ${this.left + this.width} ${this.y.toFixed(2)} l S`);
    this.y -= 6;
  }

  /** A filled box with a coloured border and a single line of bold text, e.g. the verdict stamp. */
  stamp(label: string, color: Rgb, fill: Rgb) {
    const size = 17;
    const w = textWidth(label, size, "bold") + 30;
    const h = 32;
    this.ensure(h + 8);
    const top = this.y;
    this.ops.push(
      `${rgb(fill)} rg ${rgb(color)} RG 2 w ${this.left} ${(top - h).toFixed(2)} ${w.toFixed(2)} ${h} re B`,
      `BT /F2 ${size} Tf ${rgb(color)} rg ${(this.left + 15).toFixed(2)} ${(top - h + 10).toFixed(2)} Td (${pdfText(label.toUpperCase())}) Tj ET`,
    );
    this.y -= h + 8;
  }

  /** A table with a header row. `widths` add up to the page width. */
  table(headers: string[], rows: string[][], widths: number[], opts: { size?: number } = {}) {
    const size = opts.size ?? 9.5;
    const leading = size * 1.35;
    const pad = 5;
    const xs = widths.reduce<number[]>((acc, w, i) => [...acc, i === 0 ? this.left : acc[i - 1] + widths[i - 1]], []);

    const drawRow = (cells: string[], font: FontName, fill?: Rgb) => {
      const wrapped = cells.map((c, i) => this.lines(c, size, font, widths[i] - 2 * pad));
      const lineCount = Math.max(...wrapped.map((w) => w.length));
      const height = lineCount * leading + 2 * pad;
      this.ensure(height);
      const top = this.y;
      if (fill) this.ops.push(`${rgb(fill)} rg ${this.left} ${(top - height).toFixed(2)} ${this.width} ${height.toFixed(2)} re f`);
      this.ops.push(`0.8 0.76 0.68 RG 0.6 w ${this.left} ${(top - height).toFixed(2)} ${this.width} ${height.toFixed(2)} re S`);
      wrapped.forEach((cellLines, i) => {
        const raster = this.useRaster(cells[i]);
        cellLines.forEach((line, n) => {
          const baseline = top - pad - n * leading - leading * (raster ? 0.74 : 0.74);
          this.drawLine(line, xs[i] + pad, baseline, size, font, INK, fill ?? WHITE, leading, raster);
        });
      });
      this.y -= height;
    };

    drawRow(headers, "bold", [0.96, 0.93, 0.86]);
    rows.forEach((r) => drawRow(r, "regular"));
    this.y -= 6;
  }

  /** Assemble the file as bytes (the text parts are ASCII; the images are binary JPEGs). */
  build(title: string): Uint8Array {
    const objects: Uint8Array[] = [];
    const add = (body: string | Uint8Array) => {
      objects.push(typeof body === "string" ? ascii(body) : body);
      return objects.length; // object number
    };
    const concat = (...parts: (string | Uint8Array)[]) => {
      const bytes = parts.map((p) => (typeof p === "string" ? ascii(p) : p));
      const out = new Uint8Array(bytes.reduce((n, b) => n + b.length, 0));
      let at = 0;
      for (const b of bytes) {
        out.set(b, at);
        at += b.length;
      }
      return out;
    };

    add("<< /Type /Catalog /Pages 2 0 R >>"); // 1
    add("PAGES"); // 2, filled in below
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"); // 3
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"); // 4
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"); // 5
    const infoNum = add(`<< /Title (${pdfText(title.replace(/[^\x20-\x7e]/g, "?"))}) /Producer (DineTrust) >>`);

    const imageNums = this.images.map((img) =>
      add(
        concat(
          `<< /Type /XObject /Subtype /Image /Width ${img.pxW} /Height ${img.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>\nstream\n`,
          img.jpeg,
          "\nendstream",
        ),
      ),
    );
    const xobjects = imageNums.length ? `/XObject << ${imageNums.map((n, i) => `/Im${i} ${n} 0 R`).join(" ")} >>` : "";

    const pageNums: number[] = [];
    for (const page of this.pages) {
      const stream = page.join("\n");
      const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      pageNums.push(
        add(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> ${xobjects} >> /Contents ${content} 0 R >>`,
        ),
      );
    }
    objects[1] = ascii(`<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageNums.length} >>`);

    const parts: Uint8Array[] = [ascii("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")];
    let offset = parts[0].length;
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      const head = ascii(`${i + 1} 0 obj\n`);
      const tail = ascii("\nendobj\n");
      offsets.push(offset);
      parts.push(head, body, tail);
      offset += head.length + body.length + tail.length;
    });
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
    xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoNum} 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
    parts.push(ascii(xref));
    return concat(...parts);
  }
}
