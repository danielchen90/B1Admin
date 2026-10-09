import React from "react";
import { Alert, Box, Button, Chip, CircularProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { ApiHelper, DateHelper, DisplayBox, Locale } from "@churchapps/apphelper";

// Chat reports (App Store guideline 1.2): messages reported from livestream chat, group chat
// and private messages. Staff remove the message (deleted for everyone) or dismiss the report.

interface ChatReport {
  id: string;
  messageId: string;
  kind: string;
  reason: string;
  note?: string;
  messageSnapshot?: string;
  senderDisplayName?: string;
  anonymousReporter?: boolean;
  createdAt?: string;
  resolvedAt?: string;
  action?: string;
}

export const ChatReports: React.FC = () => {
  const [status, setStatus] = React.useState<"open" | "resolved">("open");
  const [reports, setReports] = React.useState<ChatReport[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setReports(null);
    setError(null);
    ApiHelper.get("/messageReports?status=" + status, "MessagingApi")
      .then((data: ChatReport[]) => setReports(Array.isArray(data) ? data : []))
      .catch(() => { setReports([]); setError(Locale.label("sermons.chatReports.loadFailed")); });
  }, [status]);

  React.useEffect(() => { load(); }, [load]);

  const resolve = async (r: ChatReport, action: "remove" | "dismiss") => {
    if (action === "remove" && !window.confirm(Locale.label("sermons.chatReports.confirmRemove"))) return;
    setBusyId(r.id);
    try {
      await ApiHelper.post("/messageReports/" + r.id + "/resolve", { action }, "MessagingApi");
      load();
    } catch {
      setError(Locale.label("sermons.chatReports.actionFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const reasonLabel = (reason: string) => Locale.label("sermons.chatReports.reasons." + reason);
  const actionLabel = (action?: string) => (action === "removed" ? Locale.label("sermons.chatReports.removed") : Locale.label("sermons.chatReports.dismissed"));
  const when = (d?: string) => (d ? DateHelper.prettyDateTime(new Date(d)) : "");

  const filter = (
    <ToggleButtonGroup size="small" exclusive value={status} onChange={(_, v) => v && setStatus(v)}>
      <ToggleButton value="open">{Locale.label("sermons.chatReports.open")}</ToggleButton>
      <ToggleButton value="resolved">{Locale.label("sermons.chatReports.resolved")}</ToggleButton>
    </ToggleButtonGroup>
  );

  const getRows = () => (reports || []).map((r) => (
    <TableRow key={r.id}>
      <TableCell sx={{ whiteSpace: "nowrap" }}>{when(r.createdAt)}</TableCell>
      <TableCell>{r.kind}</TableCell>
      <TableCell>
        <Chip size="small" label={reasonLabel(r.reason)} color={r.reason === "spam" ? "default" : "warning"} />
        {r.note && <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>{r.note}</Typography>}
      </TableCell>
      <TableCell>{r.senderDisplayName || Locale.label("sermons.chatReports.unknownSender")}</TableCell>
      <TableCell sx={{ maxWidth: 360, wordBreak: "break-word" }}>{r.messageSnapshot}</TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        {status === "open" ? (
          <Stack direction="row" spacing={1}>
            <Button size="small" color="error" variant="contained" disabled={busyId === r.id} onClick={() => resolve(r, "remove")} data-testid="chat-report-remove">
              {Locale.label("sermons.chatReports.remove")}
            </Button>
            <Button size="small" variant="outlined" disabled={busyId === r.id} onClick={() => resolve(r, "dismiss")} data-testid="chat-report-dismiss">
              {Locale.label("sermons.chatReports.dismiss")}
            </Button>
          </Stack>
        ) : (
          <Typography variant="body2">{actionLabel(r.action)} {when(r.resolvedAt)}</Typography>
        )}
      </TableCell>
    </TableRow>
  ));

  return (
    <DisplayBox headerIcon="flag" headerText={Locale.label("sermons.chatReports.title")} editContent={filter}>
      <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>{Locale.label("sermons.chatReports.help")}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {reports === null ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}><CircularProgress size={28} /></Box>
      ) : reports.length === 0 ? (
        <Typography sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>
          {status === "open" ? Locale.label("sermons.chatReports.noneOpen") : Locale.label("sermons.chatReports.noneResolved")}
        </Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{Locale.label("sermons.chatReports.reported")}</TableCell>
                <TableCell>{Locale.label("sermons.chatReports.where")}</TableCell>
                <TableCell>{Locale.label("sermons.chatReports.reason")}</TableCell>
                <TableCell>{Locale.label("sermons.chatReports.sender")}</TableCell>
                <TableCell>{Locale.label("sermons.chatReports.message")}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>{getRows()}</TableBody>
          </Table>
        </Box>
      )}
    </DisplayBox>
  );
};
