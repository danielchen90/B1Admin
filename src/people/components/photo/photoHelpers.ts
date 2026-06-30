// Framework-free photo utilities shared by the license capture/crop flow (Plans 03/04).
// NO React import: these are pure browser primitives so the camera, cropper, dialog,
// and save flow all compose the SAME EXIF-corrected, validated source (PHO-03).
//
// Pitfall 4 (RESEARCH): EXIF correction MUST happen ONCE, up front, producing a single
// corrected blob used for BOTH the cropper source AND the uploaded source. If the crop
// rect is computed against an un-rotated source but the stored image is rotated (or vice
// versa), the persisted normalized rect mis-aligns when Phase 6 re-applies it.

/** Raised when a blob cannot be decoded by the browser (e.g. HEIC from iOS). */
export class PhotoDecodeError extends Error {
  code = "decode_failed" as const;
  constructor(message = "Could not read this image. Please use a JPEG, PNG, or WEBP image, or take a photo with the camera.") {
    super(message);
    this.name = "PhotoDecodeError";
  }
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB upload ceiling (Pitfall 3 + storage budget).

/**
 * Rasterize a blob through the browser's EXIF-aware decoder so the returned PNG blob is
 * physically upright. A sideways phone photo (orientation 6/8) becomes a correctly-oriented
 * source whose pixels match what the cropper draws — so any normalized crop rect aligns.
 * Throws PhotoDecodeError on undecodable input (HEIC, corrupt) so callers can show a
 * friendly message instead of a silent blank canvas.
 */
export const exifNormalize = async (blob: Blob): Promise<Blob> => {
  let bmp: ImageBitmap | undefined;
  try {
    bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PhotoDecodeError();
    ctx.drawImage(bmp, 0, 0);
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!out) throw new PhotoDecodeError();
    return out;
  } catch (e) {
    if (e instanceof PhotoDecodeError) throw e;
    throw new PhotoDecodeError();
  } finally {
    bmp?.close?.();
  }
};

/**
 * Pre-decode guard: only allow browser-decodable raster types and a sane size. HEIC and
 * other unsupported types are rejected here with a friendly message BEFORE we attempt a
 * decode that would otherwise fail opaquely (Pitfall 3).
 */
export const validateImage = (file: File): { ok: boolean; error?: string } => {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { ok: false, error: "Please use a JPEG, PNG, or WEBP image, or take a photo with the camera." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "That image is too large (max 10 MB). Please choose a smaller file." };
  }
  return { ok: true };
};

/**
 * Cap the long edge at maxEdge to keep the 1 GB volume in check while retaining enough
 * detail to re-crop later (RESEARCH storage tradeoff). Returns the input unchanged when
 * already within bounds. Always emits PNG so the save flow's data:image/png guard holds.
 */
export const downscale = async (blob: Blob, maxEdge = 1200): Promise<Blob> => {
  let bmp: ImageBitmap | undefined;
  try {
    bmp = await createImageBitmap(blob);
    const longEdge = Math.max(bmp.width, bmp.height);
    if (longEdge <= maxEdge) return blob;
    const scale = maxEdge / longEdge;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PhotoDecodeError();
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!out) throw new PhotoDecodeError();
    return out;
  } catch (e) {
    if (e instanceof PhotoDecodeError) throw e;
    throw new PhotoDecodeError();
  } finally {
    bmp?.close?.();
  }
};

/** Read a blob as a base64 data URL (e.g. to feed react-easy-crop or PersonHelper.savePhoto). */
export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new PhotoDecodeError());
    reader.readAsDataURL(blob);
  });

/** Decode a base64 data URL back into a Blob (mime taken from the URL header). */
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, data] = dataUrl.split(",");
  const mimeMatch = /data:([^;]+)/.exec(header);
  const mime = mimeMatch?.[1] || "application/octet-stream";
  const binary = atob(data);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

/**
 * Convenience: produce a `data:image/png;base64,...` data URL. PersonHelper.savePhoto only
 * fires for a PNG data URL (Pitfall 5), so re-encode through a canvas when the blob is not
 * already PNG. A PNG blob short-circuits straight to blobToDataUrl.
 */
export const toPngDataUrl = async (blob: Blob): Promise<string> => {
  if (blob.type === "image/png") return blobToDataUrl(blob);
  let bmp: ImageBitmap | undefined;
  try {
    bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PhotoDecodeError();
    ctx.drawImage(bmp, 0, 0);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new PhotoDecodeError();
    return blobToDataUrl(png);
  } catch (e) {
    if (e instanceof PhotoDecodeError) throw e;
    throw new PhotoDecodeError();
  } finally {
    bmp?.close?.();
  }
};
