// Template picker dialog (Plan 12-05, BLD-02 reload side).
//
// Offers TWO sources of a starting design and, on pick, hands a ready Unlayer
// design back via onPick({design}) — the page routes it into builder.loadDesign:
//   1. The four bundled Huro STARTER_TEMPLATES (12-06) — always available.
//   2. The user's SAVED reusable templates (campaignApi.listTemplates, 12-03/04).
//      Builder designs (hasBlockJson) are pickable "Load into builder"; legacy
//      HTML-only templates (blockJson NULL) are shown DISABLED so the picker
//      never crashes on a NULL design (BLD-02 back-compat). Picking a saved
//      template lazily fetches its blockJson via getTemplate → JSON.parse.
//
// Reachable both on /email/new ("start from template") AND from the editor
// toolbar ("replace design"), so a saved template can seed ANOTHER campaign.

import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, Card, CardActionArea,
  CardContent, Typography, Tabs, Tab, Box, CircularProgress, Alert, Chip,
} from "@mui/material";
import { STARTER_TEMPLATES } from "./starterTemplates";
import { listTemplates, getTemplate } from "./campaignApi";
import { parseApiError } from "./apiError";
import { type TemplateInterface } from "./emailTypes";
import { type UnlayerDesignJson } from "./UnlayerBuilder";

export interface TemplatePickerDialogProps {
  open: boolean;
  onClose: () => void;
  // Called with a ready-to-load design once the user picks a source.
  onPick: (design: UnlayerDesignJson) => void;
  // Bumped by the parent (e.g. after Save-as-template) to force a list refresh.
  refreshToken?: number;
}

export const TemplatePickerDialog: React.FC<TemplatePickerDialogProps> = ({
  open, onClose, onPick, refreshToken,
}) => {
  const [tab, setTab] = React.useState<"starters" | "saved">("starters");
  const [saved, setSaved] = React.useState<TemplateInterface[]>([]);
  const [loadingList, setLoadingList] = React.useState(false);
  const [pickingId, setPickingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");

  // Load the saved-template list whenever the dialog opens (or a refresh fires).
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingList(true);
    setError("");
    listTemplates()
      .then((rows) => {
        if (active) setSaved(Array.isArray(rows) ? rows : []);
      })
      .catch((err: unknown) => {
        if (active) setError(parseApiError(err).error || "Couldn't load your saved templates.");
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });
    return () => {
      active = false;
    };
  }, [open, refreshToken]);

  const pickStarter = (design: UnlayerDesignJson) => {
    onPick(design);
    onClose();
  };

  const pickSaved = async (tpl: TemplateInterface) => {
    if (!tpl.id || tpl.hasBlockJson === false) return; // legacy HTML-only → not loadable
    setPickingId(tpl.id);
    setError("");
    try {
      const full = await getTemplate(tpl.id);
      if (!full.blockJson) {
        setError("This template has no builder design to load.");
        return;
      }
      onPick(JSON.parse(full.blockJson) as UnlayerDesignJson);
      onClose();
    } catch (err) {
      setError(parseApiError(err).error || "Couldn't load that template.");
    } finally {
      setPickingId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Start from a template</DialogTitle>
      <DialogContent dividers>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="starters" label="Huro starters" />
          <Tab value="saved" label="Your saved templates" />
        </Tabs>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

        {tab === "starters" && (
          <Grid container spacing={2}>
            {STARTER_TEMPLATES.map((t) => (
              <Grid key={t.id} size={{ xs: 12, sm: 6 }}>
                <Card variant="outlined">
                  <CardActionArea
                    onClick={() => pickStarter(t.design as unknown as UnlayerDesignJson)}
                    data-testid={`starter-${t.id}`}
                  >
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{t.description}</Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {tab === "saved" && (
          loadingList ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={26} /></Box>
          ) : saved.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              You haven’t saved any reusable templates yet. Design one, then “Save as template”.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {saved.map((t) => {
                const loadable = t.hasBlockJson !== false;
                const busy = pickingId === t.id;
                return (
                  <Grid key={t.id} size={{ xs: 12, sm: 6 }}>
                    <Card variant="outlined" sx={{ opacity: loadable ? 1 : 0.55 }}>
                      <CardActionArea
                        disabled={!loadable || busy}
                        onClick={() => pickSaved(t)}
                        data-testid={`saved-template-${t.id}`}
                      >
                        <CardContent>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t.name}</Typography>
                            {busy && <CircularProgress size={14} />}
                            {!loadable && <Chip size="small" label="HTML only" />}
                          </Box>
                          {t.subject && (
                            <Typography variant="body2" color="text.secondary">{t.subject}</Typography>
                          )}
                          {t.category && (
                            <Typography variant="caption" color="text.secondary">{t.category}</Typography>
                          )}
                          {!loadable && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                              A legacy template without a builder design — can’t be loaded into the block editor.
                            </Typography>
                          )}
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TemplatePickerDialog;
