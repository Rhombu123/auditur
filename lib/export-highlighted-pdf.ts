import { PDFDocument, rgb } from "pdf-lib";

import { parseColorToRgb } from "./zone-colors.js";

export type PdfHighlight = {
  vinSuffix: string;
  fillColor: string;
  strokeColor: string;
  zoneName?: string;
};

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

async function loadPdfJs() {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

export async function buildHighlightedAuditPdf(
  pdfBuffer: Buffer,
  highlights: PdfHighlight[],
): Promise<Uint8Array> {
  const bySuffix = new Map(
    highlights.map((entry) => [entry.vinSuffix.toUpperCase(), entry]),
  );

  const pdfjs = await loadPdfJs();
  const pdfjsDoc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
  }).promise;

  const output = await PDFDocument.load(pdfBuffer);

  for (let pageIndex = 1; pageIndex <= pdfjsDoc.numPages; pageIndex++) {
    const page = await pdfjsDoc.getPage(pageIndex);
    const textContent = await page.getTextContent();
    const drawPage = output.getPage(pageIndex - 1);
    const drawnRows = new Set<string>();

    for (const rawItem of textContent.items) {
      const item = rawItem as TextItem;
      if (!item.str?.trim()) continue;

      const lineText = item.str.toUpperCase();
      for (const [suffix, highlight] of bySuffix) {
        if (!lineText.includes(suffix)) continue;

        const x = item.transform[4] ?? 0;
        const y = item.transform[5] ?? 0;
        const fontHeight = Math.abs(item.transform[3] ?? item.height ?? 10);
        const rowKey = `${pageIndex}:${Math.round(y)}:${suffix}`;
        if (drawnRows.has(rowKey)) continue;
        drawnRows.add(rowKey);

        const fill = parseColorToRgb(highlight.fillColor);
        const stroke = parseColorToRgb(highlight.strokeColor);
        const rowWidth = Math.max(item.width ?? suffix.length * 7, 280);

        drawPage.drawRectangle({
          x: Math.max(18, x - 6),
          y: y - 3,
          width: rowWidth + 40,
          height: fontHeight + 6,
          color: rgb(fill.r, fill.g, fill.b),
          opacity: Math.min(0.55, fill.a + 0.15),
          borderColor: rgb(stroke.r, stroke.g, stroke.b),
          borderWidth: 1.2,
        });
        break;
      }
    }
  }

  return output.save();
}
