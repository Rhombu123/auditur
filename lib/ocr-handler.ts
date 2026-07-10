import { extractVin, extractVinSuffix } from "./vin.js";

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_char_whitelist: "ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
        tessedit_pageseg_mode: 7 as never,
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function runOcrBuffer(buffer: Buffer): Promise<{
  rawText: string;
  vin: string | null;
  vinSuffix: string | null;
}> {
  if (buffer.length === 0) {
    throw new Error("The selected image is empty.");
  }

  const worker = await getWorker();
  const result = await worker.recognize(buffer);
  const rawText = result.data.text ?? "";

  const vin = extractVin(rawText);
  const vinSuffix = vin ? vin.slice(-6) : extractVinSuffix(rawText);

  return {
    rawText,
    vin,
    vinSuffix,
  };
}
