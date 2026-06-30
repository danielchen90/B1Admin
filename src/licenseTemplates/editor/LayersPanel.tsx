// LayersPanel.tsx — scaffold (full implementation lands in 05-05 Task 3).
import React from "react";
import { Box } from "@mui/material";
import type { LayoutElement } from "../LicenseTemplateInterface";

interface Props {
  elements: LayoutElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onBringToFront: (id: string) => void;
}

export const LayersPanel: React.FC<Props> = () => <Box sx={{ p: 2 }} />;
