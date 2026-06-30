// Single source of truth for the license crop geometry + transform shape. The cropper
// (Plan 03), the guide overlay, any preview, and the save flow (Plan 04) ALL reference
// these — so the client crop rect and the Plan 01 API payload cannot drift.

// Portrait headshot default. RESEARCH Open Q2: the exact CR80 minister-photo sub-region
// geometry is fixed by Phase 5's template work; this is the SINGLE constant to update then
// (coordinated with Phase 6's render). Named so the cropper aspect, the guide overlay, and
// any preview all derive from one value.
export const LICENSE_ASPECT = 3 / 4;

// Normalized 0..1 crop rect + rotation. Field names are byte-identical to the Plan 01
// POST /personPhotoCrops payload (cropX/cropY/cropWidth/cropHeight/rotation) so the client
// can send this shape straight through and Phase 6 can re-apply it without a translation.
export interface PhotoCropTransform {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  rotation: number;
}

// Mirrors a personPhotoCrops row as the API returns it (the transform plus row metadata).
export interface LicensePhotoCropInterface extends PhotoCropTransform {
  id?: string;
  personId?: string;
  purpose?: string;
  sourceUpdated?: string;
}

// react-easy-crop's onCropComplete gives `croppedArea` in PERCENT (x/y/width/height 0..100).
// Convert to the normalized 0..1 transform here so the cropper and the save flow agree on
// the one conversion (divide by 100). rotation passes through in degrees.
export const fromCroppedAreaPercent = (
  croppedArea: { x: number; y: number; width: number; height: number },
  rotation: number
): PhotoCropTransform => ({
  cropX: croppedArea.x / 100,
  cropY: croppedArea.y / 100,
  cropWidth: croppedArea.width / 100,
  cropHeight: croppedArea.height / 100,
  rotation
});
