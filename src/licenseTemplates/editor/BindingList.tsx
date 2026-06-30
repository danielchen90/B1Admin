// BindingList.tsx — the PRIMARY add path (RESEARCH §Field Binding, locked decision).
//
// Clicking a binding drops a pre-configured boundText element onto the canvas (the
// TemplateEditor handler supplies the default geometry/style and a default dateFormat
// for date bindings). The catalog is grouped by record for scannability; every REQUIRED
// binding (person.lastName, ordinationType.name, campus.name, credentialNumber,
// ordination.grantedDate, ordination.expirationDate, ordination.status) is present, plus
// the justified extensions.

import React from "react";
import { List, ListItemButton, ListItemText, ListSubheader, Typography } from "@mui/material";
import { BINDING_CATALOG } from "../helpers/bindings";

interface Props {
  onAdd: (binding: string) => void;
}

const groupOf = (key: string): string => {
  if (key.startsWith("person.")) return "Person";
  if (key.startsWith("ordinationType.")) return "Ordination Type";
  if (key.startsWith("campus.")) return "Campus";
  if (key.startsWith("church.")) return "Church";
  return "Credential"; // credentialNumber + ordination.*
};

const GROUP_ORDER = ["Person", "Ordination Type", "Campus", "Credential", "Church"];

export const BindingList: React.FC<Props> = ({ onAdd }) => (
  <>
    <Typography variant="subtitle2" sx={{ px: 2, pt: 2 }}>Add a field</Typography>
    <List dense disablePadding subheader={<li />}>
      {GROUP_ORDER.map((group) => {
        const items = BINDING_CATALOG.filter((b) => groupOf(b.key) === group);
        if (items.length === 0) return null;
        return (
          <li key={group}>
            <ul style={{ padding: 0 }}>
              <ListSubheader disableSticky>{group}</ListSubheader>
              {items.map((b) => (
                <ListItemButton key={b.key} onClick={() => onAdd(b.key)}>
                  <ListItemText primary={b.label} secondary={b.key} />
                </ListItemButton>
              ))}
            </ul>
          </li>
        );
      })}
    </List>
  </>
);
