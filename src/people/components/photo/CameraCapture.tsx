import React, { useEffect, useMemo, useRef, useState } from "react";
import Webcam from "react-webcam";
import { Box, Button, Icon, Stack } from "@mui/material";
import { SmallButton } from "@churchapps/apphelper";

// Presentational live-webcam capture for the license photo flow (PHO-01 laptop, PHO-02 phone).
//
// This component owns NO I/O — it only surfaces a PNG data URL via onCapture (the dialog in
// Plan 04 runs it through exifNormalize/downscale and the save flow). react-webcam absorbs the
// easy-to-get-wrong parts: it sets autoPlay/muted, and re-requesting the stream on a facingMode
// change (key remount) stops the old MediaStreamTrack for us — we deliberately do NOT hand-roll
// track.stop() teardown (the classic "camera light stays on" bug).
//
// Mobile-safety contract:
//  - playsInline is REQUIRED on iOS Safari or the video takes over fullscreen (RESEARCH Pitfall 2).
//  - screenshotFormat="image/png" so getScreenshot() yields a PNG data URL — PersonHelper.savePhoto
//    only fires for data:image/png (Pitfall 5), so producing PNG here keeps the whole chain PNG.
//  - facingMode defaults to "user" (front camera for a headshot); a flip control switches to
//    "environment" (rear) for phones.

interface Props {
  onCapture: (pngDataUrl: string) => void;
  onUnavailable?: (reason: string) => void;
}

type FacingMode = "user" | "environment";

// Touch capability hint — the flip control only makes sense where a second (rear) camera exists.
const isTouchDevice = (): boolean =>
  typeof window !== "undefined" && ("ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0);

export const CameraCapture: React.FC<Props> = ({ onCapture, onUnavailable }) => {
  const webcamRef = useRef<Webcam>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>("user");

  // Feature-detect getUserMedia up front. If the browser cannot do live capture we report it
  // ONCE and render nothing — the dialog shows the Upload path instead. Guarded by a ref-less
  // effect so onUnavailable fires a single time on mount, not on every render.
  const supported = useMemo(
    () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
    []
  );
  useEffect(() => {
    if (!supported) onUnavailable?.("unsupported");
  }, [supported, onUnavailable]);

  const videoConstraints = useMemo(
    () => ({ facingMode, width: { ideal: 1280 }, height: { ideal: 960 } }),
    [facingMode]
  );

  if (!supported) return null;

  const handleCapture = () => {
    // getScreenshot() returns null until the stream is live — guard and no-op rather than
    // emitting a blank frame the save flow would reject.
    const shot = webcamRef.current?.getScreenshot();
    if (shot) onCapture(shot);
  };

  const handleFlip = () => setFacingMode((m) => (m === "user" ? "environment" : "user"));

  return (
    <Stack spacing={1} alignItems="center">
      <Box
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          borderRadius: 1,
          overflow: "hidden",
          backgroundColor: "#000"
        }}
      >
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/png"
          playsInline
          mirrored={facingMode === "user"}
          videoConstraints={videoConstraints}
          onUserMediaError={(e) => onUnavailable?.(String((e as DOMException)?.name || e))}
          style={{ width: "100%", display: "block" }}
        />
        {isTouchDevice() && (
          <Box sx={{ position: "absolute", top: 8, right: 8 }}>
            <SmallButton icon="cameraswitch" toolTip="Flip camera" ariaLabel="Flip camera" onClick={handleFlip} />
          </Box>
        )}
      </Box>
      <Button
        variant="contained"
        startIcon={<Icon>photo_camera</Icon>}
        onClick={handleCapture}
        data-testid="camera-capture-button"
      >
        Capture
      </Button>
    </Stack>
  );
};
