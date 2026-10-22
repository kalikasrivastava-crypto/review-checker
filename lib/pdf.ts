/**
 * A tiny PDF writer, enough for a one-or-two page evidence report: wrapped text, rules, boxes and a table.
 * Uses the PDF standard fonts, so there is nothing to download or install. Latin letters only: other
 * scripts are replaced with "?".
 */

export type FontName = "regular" | "bold" | "italic";
const FONT_KEY: Record<FontName, string> = { regular: "F1", bold: "F2", italic: "F3" };

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

export function wrapText(text: string, size: number, font: FontName, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && textWidth(next, size, font) > maxWidth) {
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

type Rgb = [number, number, number];
const rgb = (c: Rgb) => `${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)}`;

export class PdfDoc {
  private pages: string[][] = [[]];
  y = PAGE_H - MARGIN;
  readonly left = MARGIN;
  readonly width = PAGE_W - 2 * MARGIN;

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
    for (const line of wrapText(value, size, font, width)) {
      this.ensure(leading);
      this.y -= leading;
      this.ops.push(
        `BT /${FONT_KEY[font]} ${size} Tf ${rgb(opts.color ?? [0.12, 0.09, 0.07])} rg ${x.toFixed(2)} ${this.y.toFixed(2)} Td (${pdfText(line)}) Tj ET`,
      );
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
      const wrapped = cells.map((c, i) => wrapText(c, size, font, widths[i] - 2 * pad));
      const lines = Math.max(...wrapped.map((w) => w.length));
      const height = lines * leading + 2 * pad;
      this.ensure(height);
      const top = this.y;
      if (fill) this.ops.push(`${rgb(fill)} rg ${this.left} ${(top - height).toFixed(2)} ${this.width} ${height.toFixed(2)} re f`);
      this.ops.push(`0.8 0.76 0.68 RG 0.6 w ${this.left} ${(top - height).toFixed(2)} ${this.width} ${height.toFixed(2)} re S`);
      wrapped.forEach((cellLines, i) => {
        cellLines.forEach((line, n) => {
          const ty = top - pad - size - n * leading + 2;
          this.ops.push(
            `BT /${FONT_KEY[font]} ${size} Tf 0.12 0.09 0.07 rg ${(xs[i] + pad).toFixed(2)} ${ty.toFixed(2)} Td (${pdfText(line)}) Tj ET`,
          );
        });
      });
      this.y -= height;
    };

    drawRow(headers, "bold", [0.96, 0.93, 0.86]);
    rows.forEach((r) => drawRow(r, "regular"));
    this.y -= 6;
  }

  /** Assemble the file. Everything written is ASCII, so character count equals byte count. */
  build(title: string): Uint8Array {
    const objects: string[] = [];
    const add = (body: string) => {
      objects.push(body);
      return objects.length; // object number
    };
    add("<< /Type /Catalog /Pages 2 0 R >>"); // 1
    add("PAGES"); // 2, filled in below
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"); // 3
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"); // 4
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"); // 5
    const infoNum = add(`<< /Title (${pdfText(title)}) /Producer (DineTrust) >>`);

    const pageNums: number[] = [];
    for (const page of this.pages) {
      const stream = page.join("\n");
      const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pageNum = add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${content} 0 R >>`,
      );
      pageNums.push(pageNum);
    }
    objects[1] = `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageNums.length} >>`;

    let out = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoNum} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}
