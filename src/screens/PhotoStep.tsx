import { useEffect, useState } from "react";
import { IoCamera, IoRefresh } from "react-icons/io5";
import { CameraScreen } from "../camera";
import { fmtStamp, getFix, message, type Fix } from "../lib";
import { Button, ErrorBanner, LocationSummary } from "../ui";

export type Photo = { blob: Blob; url: string; fix: Fix };

/** Stamp burned into every photo: ON id + name, site, IST time, GPS ± accuracy. */
export function stampLines(code: string | null, name: string | null, siteName: string, f: Fix): string[] {
  return [`${code ?? ""} · ${name ?? ""}`, siteName, fmtStamp(new Date(f.at)), `${f.lat.toFixed(6)}, ${f.lng.toFixed(6)}  ±${f.acc} m`];
}

/**
 * A fresh location fix is taken right before the camera opens, so the stamp on the photo
 * and the point sent with the check-in/out are the same.
 */
export function usePhoto(stampFor: (f: Fix) => string[]) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [camFix, setCamFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  const take = async () => {
    setLocating(true);
    setError(null);
    try {
      setCamFix(await getFix());
    } catch (e) {
      setError(message(e, "Couldn't get your location."));
    } finally {
      setLocating(false);
    }
  };

  const camera = camFix ? (
    <CameraScreen
      title="Take photo"
      stampLines={stampFor(camFix)}
      onCancel={() => setCamFix(null)}
      onShot={(blob) => {
        setPhoto({ blob, url: URL.createObjectURL(blob), fix: camFix });
        setCamFix(null);
      }}
    />
  ) : null;

  const reset = () => setPhoto(null);

  return { photo, take, reset, locating, error, setError, camera };
}

export function PhotoStep({ photo, locating, error, onTake, intro }: { photo: Photo | null; locating: boolean; error: string | null; onTake: () => void; intro: string }) {
  return (
    <>
      <div className="step-intro">
        <h2>{photo ? "Check your photo" : "Take a photo"}</h2>
        <p className="muted">{intro}</p>
      </div>
      {photo ? (
        <>
          <div className="selfie-preview">
            <img src={photo.url} alt="Your photo" />
          </div>
          <LocationSummary title={`Location accurate to ±${photo.fix.acc} m`} sub={`${photo.fix.lat.toFixed(5)}, ${photo.fix.lng.toFixed(5)}`} />
          <Button variant="secondary" icon={<IoRefresh size={18} />} loading={locating} onClick={onTake}>
            Retake photo
          </Button>
        </>
      ) : (
        <button className="photo-placeholder" onClick={onTake} disabled={locating}>
          <div className="ph-icon">{locating ? <span className="spin" /> : <IoCamera size={34} />}</div>
          <b>{locating ? "Getting your location…" : "Open camera"}</b>
          <span>The time, site and your location are printed on the photo.</span>
        </button>
      )}
      {error && <ErrorBanner>{error}</ErrorBanner>}
    </>
  );
}
