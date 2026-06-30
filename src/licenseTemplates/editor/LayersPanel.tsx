// LayersPanel.tsx — explicit z-order (RESEARCH §Layering, locked decision).
//
// Elements are listed front-to-back (highest z at the top). Up/down buttons reorder by
// rewriting z (TemplateEditor.reorder maps each id to its index in the supplied
// BACK→FRONT array), and "bring to front" bumps one element above the rest. The named
// background slot is NOT listed here — it always renders at the back (locked decision).
// Selecting a row syncs the canvas selection + the property panel.

import React from "react";
import { IconButton, List, ListItemButton, ListItemText, Stack, Typography } from "@mui/material";
import { ArrowUpward, ArrowDownward, VerticalAlignTop } from "@mui/icons-material";
import type { LayoutElement } from "../LicenseTemplateInterface";

interface Props {
  elements: LayoutElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onBringToFront: (id: string) => void;
}

const labelOf = (e: LayoutElement): string => {
  switch (e.type) {
    case "boundText": return `Field: ${e.binding}`;
    case "staticText": return `Text: ${e.text || "(empty)"}`;
    case "image": return "Logo";
    case "photo": return "Photo";
  }
};

export const LayersPanel: React.FC<Props> = ({ elements, selectedId, onSelect, onReorder, onBringToFront }) => {
  // Front-first display order (highest z at top).
  const display = [...elements].sort((a, b) => b.z - a.z);

  const move = (id: string, dir: "up" | "down") => {
    const order = [...display]; // front-first
    const i = order.findIndex((e) => e.id === id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    // reorder expects BACK→FRONT (z = array index), so reverse the front-first order.
    onReorder(order.map((e) => e.id).reverse());
  };

  return (
    <>
      <Typography variant="subtitle2" sx={{ px: 2, pt: 2 }}>Layers</Typography>
      {display.length === 0 && <Typography variant="caption" sx={{ px: 2 }} color="text.secondary">No elements yet.</Typography>}
      <List dense disablePadding>
        {display.map((e, i) => (
          <ListItemButton key={e.id} selected={e.id === selectedId} onClick={() => onSelect(e.id)}>
            <ListItemText primary={labelOf(e)} />
            <Stack direction="row" spacing={0.25} onClick={(ev) => ev.stopPropagation()}>
              <IconButton size="small" disabled={i === 0} onClick={() => move(e.id, "up")} aria-label="Move forward"><ArrowUpward fontSize="inherit" /></IconButton>
              <IconButton size="small" disabled={i === display.length - 1} onClick={() => move(e.id, "down")} aria-label="Move backward"><ArrowDownward fontSize="inherit" /></IconButton>
              <IconButton size="small" onClick={() => onBringToFront(e.id)} aria-label="Bring to front"><VerticalAlignTop fontSize="inherit" /></IconButton>
            </Stack>
          </ListItemButton>
        ))}
      </List>
    </>
  );
};
