import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Tab, Tabs } from "@mui/material";
import { ApiHelper } from "@churchapps/apphelper";
import { type PersonInterface } from "@churchapps/helpers";
import { CameraCapture } from "./CameraCapture";
import { PhotoCropper } from "./PhotoCropper";
import { LICENSE_ASPECT, type PhotoCropTransform } from "./LicensePhotoInterfaces";
import { validateImage, exifNormalize, downscale, toPngDataUrl, dataUrlToBlob, PhotoDecodeError } from "./photoHelpers";
import { useLicensePhoto } from "./useLicensePhoto";
import { parseApiError } from "../../../helpers/OrdinationHelper";

// The License Photo dialog — the convergence point of Phase 4. It composes the Plan 03
// capture/crop primitives (CameraCapture + PhotoCropper) with an Upload fallback and the
// Plan 02 photo helpers, acquiring a SINGLE EXIF-corrected source and persisting one image
// (via the existing person.photo seam) plus one normalized crop transform (Plan 01 endpoint).
//
// Pitfall 4 (make-or-break): the source is EXIF-normalized EXACTLY ONCE, up front. That one
// corrected blob feeds BOTH the cropper (so the rect is measured against upright pixels) AND
// the eventual upload (so the stored image matches the rect). We never re-derive the source.
//
// Camera vs Upload acquisition:
//  - Camera: react-webcam screenshots are canvas-rendered PNGs (already upright, no EXIF) — we
//    just convert the data URL to a blob and use it as the single source.
//  - Upload: validateImage (type/size) THEN exifNormalize (rotate to upright) before cropping;
//    a decode failure surfaces the friendly HEIC message inline.
//  - On camera failure (onUnavailable) we switch to the Upload tab and explain why.

interface Props {
  person: PersonInterface;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

type TabKey = "camera" | "upload";
type Mode = "choose" | "crop";

const cameraSupported = (): boolean =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

export const LicensePhotoDialog: React.FC<Props> = ({ person, open, onClose, onSaved }) => {
  // Default to Camera when the browser can do live capture, else Upload (no point showing a
  // tab that renders nothing). Recomputed on each open so a denied camera reopens sensibly.
  const [tab, setTab] = useState<TabKey>(cameraSupported() ? "camera" : "upload");
  const [mode, setMode] = useState<Mode>("choose");
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>("");
  const [transform, setTransform] = useState<PhotoCropTransform | null>(null);
  const [error, setError] = useState<string>("");
  const [cameraNotice, setCameraNotice] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-load any saved license crop so re-opening reflects the existing crop (rotation seeds
  // the cropper; the rect is uncontrolled in react-easy-crop so the user re-drags for exact
  // position — the primitive's documented best-effort re-seed).
  const { crop: savedCrop } = useLicensePhoto(open ? person.id : undefined);
  const initialTransform = useMemo<PhotoCropTransform | undefined>(
    () =>
      savedCrop
        ? {
            cropX: savedCrop.cropX,
            cropY: savedCrop.cropY,
            cropWidth: savedCrop.cropWidth,
            cropHeight: savedCrop.cropHeight,
            rotation: savedCrop.rotation
          }
        : undefined,
    [savedCrop]
  );

  // Reset to a clean acquisition state every time the dialog opens.
  useEffect(() => {
    if (open) {
      setTab(cameraSupported() ? "camera" : "upload");
      setMode("choose");
      setSourceBlob(null);
      setTransform(null);
      setError("");
      setCameraNotice("");
      setSaving(false);
    }
  }, [open]);

  // Manage the object URL lifecycle for the cropper source — create on a new blob, revoke the
  // previous one to avoid leaking. Cleanup revokes on unmount/close.
  useEffect(() => {
    if (!sourceBlob) {
      setSourceUrl("");
      return;
    }
    const url = URL.createObjectURL(sourceBlob);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [sourceBlob]);

  // Single entry point for "we now have an upright source" — seeds the transform from any
  // saved crop and advances to the cropper. EVERY acquisition path funnels through here so the
  // EXIF-corrected blob is the one and only source used downstream (cropper + save).
  const acquireSource = (blob: Blob) => {
    setSourceBlob(blob);
    setTransform(initialTransform ?? null);
    setError("");
    setMode("crop");
  };

  const handleCameraCapture = (pngDataUrl: string) => {
    // Webcam screenshots are already upright canvas PNGs — no EXIF rotation needed.
    acquireSource(dataUrlToBlob(pngDataUrl));
  };

  const handleCameraUnavailable = () => {
    setTab("upload");
    setCameraNotice("Camera unavailable — upload a photo instead.");
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after an error
    if (!file) return;
    const check = validateImage(file);
    if (!check.ok) {
      setError(check.error || "That image cannot be used.");
      return;
    }
    try {
      // EXIF-normalize ONCE here — the returned upright PNG blob is the single source.
      const upright = await exifNormalize(file);
      acquireSource(upright);
    } catch (err) {
      setError(err instanceof PhotoDecodeError ? err.message : "Could not read this image.");
    }
  };

  // Two-part save (PHO-04 store-once): persist ONE source image through the EXISTING person
  // photo seam, then ONE normalized crop transform row. No new upload endpoint is introduced —
  // PersonController.savePhoto already writes the single file /{churchId}/membership/people/
  // {personId}.png and stamps photoUpdated. Order matters: source FIRST (stamps photoUpdated),
  // then the crop, so a later stale-crop check (Phase 6) compares against a real photoUpdated.
  const onSave = async () => {
    if (!sourceBlob || !transform) return;
    setSaving(true);
    setError("");
    try {
      // (1) Build the source to persist from the SINGLE EXIF-corrected blob: downscale the long
      //     edge to ~1200px, then re-encode to a PNG data URL (savePhoto only fires for PNG —
      //     Pitfall 5). This is the SAME upright blob the cropper measured against.
      const downscaled = await downscale(sourceBlob, 1200);
      const pngDataUrl = await toPngDataUrl(downscaled);

      // (2) Store ONCE via the existing member-photo seam. Open Q1 (Plan 02) RESOLVED:
      //     PersonAvatar is an MUI Avatar with object-fit:cover, so a wider source-only image is
      //     safe — we deliberately do NOT also persist a centered purpose:'member' crop.
      const updated = { ...person, photo: pngDataUrl };
      await ApiHelper.post("/people/", [updated], "MembershipApi");

      // (3) Persist the normalized license crop transform. Field names byte-match the Plan 01
      //     contract; churchId is server-derived (never sent). BARE path — MembershipApi base
      //     already ends in /membership (the doubled-prefix lesson).
      await ApiHelper.post(
        "/personPhotoCrops",
        [
          {
            personId: person.id,
            purpose: "license",
            cropX: transform.cropX,
            cropY: transform.cropY,
            cropWidth: transform.cropWidth,
            cropHeight: transform.cropHeight,
            rotation: transform.rotation
          }
        ],
        "MembershipApi"
      );

      onSaved?.();
      onClose();
    } catch (err: any) {
      // Surface a friendly message but KEEP the user's crop (do not reset state on failure).
      const code = parseApiError(err);
      setError(code || err?.message || "Could not save the license photo. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!sourceBlob && !!transform && !saving;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm" scroll="body">
      <DialogTitle>License Photo</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mt: 1 }} data-testid="license-photo-error">{error}</Alert>}
        {mode === "choose" ? (
          <>
            <Tabs value={tab} onChange={(_e, v: TabKey) => setTab(v)} sx={{ mb: 2 }}>
              <Tab value="camera" label="Camera" data-testid="license-photo-camera-tab" />
              <Tab value="upload" label="Upload" data-testid="license-photo-upload-tab" />
            </Tabs>
            {tab === "camera" && (
              <CameraCapture onCapture={handleCameraCapture} onUnavailable={handleCameraUnavailable} />
            )}
            {tab === "upload" && (
              <Box sx={{ textAlign: "center", py: 3 }}>
                {cameraNotice && <Alert severity="info" sx={{ mb: 2 }}>{cameraNotice}</Alert>}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={handleFileSelected}
                  data-testid="license-photo-file-input"
                />
                <Button variant="contained" onClick={() => fileInputRef.current?.click()} data-testid="license-photo-choose-file-button">
                  Choose Photo
                </Button>
              </Box>
            )}
          </>
        ) : (
          <Box sx={{ mt: 1 }}>
            <PhotoCropper
              imageUrl={sourceUrl}
              aspect={LICENSE_ASPECT}
              initial={initialTransform}
              onTransformChange={setTransform}
            />
            <Button variant="text" size="small" sx={{ mt: 1 }} onClick={() => setMode("choose")} disabled={saving} data-testid="license-photo-retake-button">
              Retake / choose another
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={saving} data-testid="license-photo-cancel-button">Cancel</Button>
        <Button variant="contained" onClick={onSave} disabled={!canSave} data-testid="license-photo-save-button" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
