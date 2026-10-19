import { useRef } from "react";
import { api } from "../api";

/**
 * Uploads a check-in/out photo once: a retry after a failed submit reuses the stored object
 * instead of uploading the same photo again (and leaving the first copy behind).
 */
export function useUploadOnce(kind: "selfie_in" | "selfie_out") {
  const last = useRef<{ blob: Blob; key: string } | null>(null);
  return async (blob: Blob): Promise<string> => {
    if (last.current?.blob === blob) return last.current.key;
    const key = await api.uploadPhoto(kind, blob);
    last.current = { blob, key };
    return key;
  };
}
