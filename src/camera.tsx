import { useEffect, useRef, useState } from "react";

// A plain photo — no face matching — with the place and time burned into it:
// ON id + name, site, date/time (IST) and the GPS coordinates with accuracy.
// Ops verify the check-in from this picture on the web portal.

const MAX_SIDE = 1280;

export function stampPhoto(source: CanvasImageSource, w: number, h: number, lines: string[], mirror: boolean): Promise<Blob> {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  if (mirror) {
    ctx.save();
    ctx.translate(cw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(source, 0, 0, cw, ch);
    ctx.restore();
  } else {
    ctx.drawImage(source, 0, 0, cw, ch);
  }
  const font = Math.max(14, Math.round(cw / 34));
  const pad = Math.round(font * 0.6);
  const lineH = Math.round(font * 1.3);
  const band = pad * 2 + lineH * lines.length;
  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(0, ch - band, cw, band);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  lines.forEach((l, i) => {
    ctx.font = `${i === 0 ? "700" : "500"} ${font}px system-ui, -apple-system, Roboto, sans-serif`;
    ctx.fillText(l, pad, ch - band + pad + i * lineH, cw - pad * 2);
  });
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't save the photo"))), "image/jpeg", 0.85));
}

export function CameraSheet({
  title,
  stampLines,
  onCancel,
  onUse,
  busy,
}: {
  title: string;
  stampLines: string[];
  onCancel: () => void;
  onUse: (photo: Blob) => void;
  busy: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    if (shot) return;
    let cancelled = false;
    setError(null);
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => undefined);
        }
      })
      .catch(() => !cancelled && setError("The camera didn't open. Allow camera access for this site, or use “Take with phone camera”."));
    if (!navigator.mediaDevices?.getUserMedia) setError("This browser can't open the camera here — use “Take with phone camera”.");
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [facing, shot]);

  useEffect(() => {
    return () => {
      if (shot) URL.revokeObjectURL(shot.url);
    };
  }, [shot]);

  const capture = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const blob = await stampPhoto(v, v.videoWidth, v.videoHeight, stampLines, facing === "user");
    setShot({ blob, url: URL.createObjectURL(blob) });
  };

  const fromFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const bmp = await createImageBitmap(f);
      const blob = await stampPhoto(bmp, bmp.width, bmp.height, stampLines, false);
      setShot({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError("That photo couldn't be read — please take it again.");
    }
  };

  return (
    <div className="camera">
      <div className="camera-bar">
        <button className="link light" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <span>{title}</span>
        {!shot ? (
          <button className="link light" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}>
            Flip
          </button>
        ) : (
          <span style={{ width: 44 }} />
        )}
      </div>

      <div className="camera-view">
        {shot ? (
          <img src={shot.url} alt="Your photo" />
        ) : (
          <video ref={video} playsInline muted className={facing === "user" ? "mirror" : ""} />
        )}
        {!shot && (
          <div className="stamp-preview">
            {stampLines.map((l, i) => (
              <div key={i} className={i === 0 ? "b" : ""}>
                {l}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="camera-error">{error}</div>}

      <div className="camera-actions">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="user"
          hidden
          onChange={(e) => {
            void fromFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {shot ? (
          <>
            <button className="btn ghost light" onClick={() => setShot(null)} disabled={busy}>
              Retake
            </button>
            <button className="btn primary" onClick={() => onUse(shot.blob)} disabled={busy}>
              {busy ? <span className="spin" /> : null} Use photo
            </button>
          </>
        ) : (
          <>
            <button className="btn ghost light" onClick={() => fileInput.current?.click()}>
              Take with phone camera
            </button>
            <button className="shutter" aria-label="Take photo" onClick={() => void capture()} disabled={!!error} />
          </>
        )}
      </div>
    </div>
  );
}
