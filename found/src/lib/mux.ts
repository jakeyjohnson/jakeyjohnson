import { supabase } from "@/lib/supabase";

export interface MuxUploadTarget {
  uploadUrl: string;
  uploadId: string;
  filmId: string;
}

/**
 * Creates a `films` row and a Mux direct upload URL via the
 * create-mux-upload edge function (Mux tokens never touch the client).
 * The caller then PUTs the raw video file straight to `uploadUrl`.
 */
export async function createUploadTarget(input: {
  title: string;
  synopsis: string;
  genre: string;
}): Promise<MuxUploadTarget> {
  const { data, error } = await supabase.functions.invoke<MuxUploadTarget>("create-mux-upload", {
    body: input,
  });
  if (error) throw error;
  if (!data) throw new Error("create-mux-upload returned no data");
  return data;
}

export async function uploadFileToMux(uploadUrl: string, fileUri: string, onProgress?: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Mux upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error during Mux upload"));
    // React Native's XHR/fetch polyfill accepts { uri } in place of a real
    // Blob and streams the file from disk instead of loading it into memory.
    xhr.send({ uri: fileUri } as unknown as Blob);
  });
}

/** Mux's HLS playback URL for a public playback id. */
export function playbackUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

/** Mux's auto-generated thumbnail for a public playback id. */
export function thumbnailUrl(playbackId: string, timeSeconds = 1): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${timeSeconds}`;
}
