import React, { useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Box, Slider, Stack, Typography } from "@mui/material";
import { LICENSE_ASPECT, fromCroppedAreaPercent, type PhotoCropTransform } from "./LicensePhotoInterfaces";

// Aspect-locked crop primitive for the license photo (PHO-01). Presentational + callback-driven:
// it owns NO I/O — the dialog (Plan 04) feeds it a data-URL source and persists the emitted
// transform. react-easy-crop absorbs the touch crop math (pinch-zoom/drag) and gives us a
// PERCENT rect on every change, which we normalize to the 0..1 PhotoCropTransform via the shared
// fromCroppedAreaPercent helper so the client rect and the Plan 01 POST payload cannot drift.
//
// The aspect lock IS the license crop guide overlay — fixing aspect to LICENSE_ASPECT draws the
// guide; there is no separate overlay component to keep in sync.
//
// CONTAINER NOTE (for Plan 04 wiring): react-easy-crop renders the cropper absolutely-filled,
// so it MUST live inside a sized, position:relative box (here height 360). Place it in a dialog
// body that gives it a definite height or the cropper collapses to 0px and shows nothing.

interface Props {
  imageUrl: string;
  aspect?: number;
  initial?: PhotoCropTransform;
  onTransformChange: (t: PhotoCropTransform) => void;
}

export const PhotoCropper: React.FC<Props> = ({ imageUrl, aspect, initial, onTransformChange }) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  // `initial` is a hint only — react-easy-crop owns the rect uncontrolled, so we seed rotation
  // (the one field that round-trips cleanly) and let the user re-drag for exact position.
  const [rotation, setRotation] = useState<number>(initial?.rotation ?? 0);

  // croppedArea is the PERCENT rect (0..100). Normalize to the 0..1 transform here so every
  // consumer (save flow, Phase 6 re-render) reads the identical shape.
  const handleCropComplete = (croppedArea: Area) => {
    onTransformChange(fromCroppedAreaPercent(croppedArea, rotation));
  };

  return (
    <Stack spacing={2}>
      <Box sx={{ position: "relative", width: "100%", height: 360, backgroundColor: "#222", borderRadius: 1 }}>
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect ?? LICENSE_ASPECT}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={handleCropComplete}
        />
      </Box>
      <Box sx={{ px: 1 }}>
        <Typography variant="caption" color="text.secondary">Zoom</Typography>
        <Slider
          value={zoom}
          min={1}
          max={3}
          step={0.05}
          aria-label="Zoom"
          onChange={(_e, v) => setZoom(Array.isArray(v) ? v[0] : v)}
        />
        <Typography variant="caption" color="text.secondary">Rotation</Typography>
        <Slider
          value={rotation}
          min={0}
          max={360}
          step={1}
          aria-label="Rotation"
          onChange={(_e, v) => setRotation(Array.isArray(v) ? v[0] : v)}
        />
      </Box>
    </Stack>
  );
};
