// PropertyPanel.tsx — scaffold (full implementation lands in 05-05 Task 2).
import React from "react";
import { Box } from "@mui/material";
import type { LayoutElement } from "../LicenseTemplateInterface";

interface Props {
  el: LayoutElement | null;
  onChange: (id: string, patch: Record<string, any>) => void;
  onBackgroundChange: (src: string | undefined, fit: "cover" | "contain") => void;
  background?: { src: string; fit: "cover" | "contain" };
  canvas: { widthMm: number; heightMm: number };
}

export const PropertyPanel: React.FC<Props> = () => <Box sx={{ p: 2 }} />;
