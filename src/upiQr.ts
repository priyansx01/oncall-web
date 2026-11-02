// Reads a UPI "receive money" QR (GPay / PhonePe / Paytm / BHIM …) on the phone — free, no
// network: the QR is `upi://pay?pa=<upi id>&pn=<payee name>&…`.

export type UpiQr = { upiId: string; payee: string | null };

export const UPI_RE = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/;

/** `upi://pay?pa=…&pn=…` → { upiId, payee }; null for anything that isn't a UPI payment QR. */
export function parseUpiUri(text: string): UpiQr | null {
  const raw = text.trim();
  if (!/^upi:\/\/pay\?/i.test(raw)) return null;
  const params = new URLSearchParams(raw.slice(raw.indexOf("?") + 1));
  const pa = (params.get("pa") ?? "").trim().toLowerCase();
  if (!UPI_RE.test(pa)) return null;
  const pn = (params.get("pn") ?? "").replace(/\s+/g, " ").trim();
  return { upiId: pa, payee: pn || null };
}

/** Decode the QR in a photo or screenshot. Tries a few sizes: a phone photo is huge and a
 *  screenshot QR is small, and jsQR does best when the code is a few hundred pixels across. */
export async function readUpiQr(file: Blob): Promise<UpiQr | "not_upi" | null> {
  // Loaded only when someone picks a QR — keeps the app's first load small.
  const { default: jsQR } = await import("jsqr");
  const bmp = await createImageBitmap(file);
  let sawOtherQr = false;
  try {
    for (const side of [1000, 1600, 700, 2200]) {
      const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(bmp, 0, 0, w, h);
      const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "attemptBoth" });
      if (code?.data) {
        const upi = parseUpiUri(code.data);
        if (upi) return upi;
        sawOtherQr = true;
      }
      if (scale === 1) break;
    }
  } finally {
    bmp.close?.();
  }
  return sawOtherQr ? "not_upi" : null;
}
