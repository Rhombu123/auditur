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
        const suffixIndex = lineText.indexOf(suffix);
        if (suffixIndex < 0) continue;

        const x = item.transform[4] ?? 0;
        const y = item.transform[5] ?? 0;
        const fontHeight = Math.abs(item.transform[3] ?? item.height ?? 10);
        const rowKey = `${pageIndex}:${Math.round(y)}:${suffix}`;
        if (drawnRows.has(rowKey)) continue;
        drawnRows.add(rowKey);

        const fill = parseColorToRgb(highlight.fillColor);
        const stroke = parseColorToRgb(highlight.strokeColor);
        const textLength = Math.max(item.str.length, 1);
        const itemWidth = Math.max(item.width ?? suffix.length * fontHeight * 0.55, 1);
        const characterWidth = itemWidth / textLength;
        drawPage.drawRectangle({
          x: x + characterWidth * suffixIndex,
          y: y - 1,
          width: characterWidth * suffix.length,
          height: fontHeight + 2,
          color: rgb(fill.r, fill.g, fill.b),
          opacity: 0.5,
          borderColor: rgb(stroke.r, stroke.g, stroke.b),
          borderWidth: 0.6,
        });
        break;
      }
    }
  }

  return output.save();
}
