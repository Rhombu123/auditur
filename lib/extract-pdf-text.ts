export async function extractPdfText(buffer: Buffer): Promise<string> {
  // Dynamic import avoids Vercel's CJS bundler pulling docutext's browser build.
  const { DocuText } = await import("docutext");
  const doc = DocuText.fromBuffer(new Uint8Array(buffer));
  return doc.text;
}
