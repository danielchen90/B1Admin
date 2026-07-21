import React from "react";
import { type DomainInterface } from "@churchapps/helpers";
import { ArrayHelper, ApiHelper, Locale } from "@churchapps/apphelper";
import { TextField, TableCell, TableBody, TableRow, Table, TableHead, Alert, Box, Typography, Chip } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import LinkIcon from "@mui/icons-material/Link";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { AppIconButton } from "../../components/ui/AppIconButton";

// The membership /domains payload carries readiness columns (isStale / lastChecked)
// that the upstream DomainInterface type omits. Extend locally so the readiness
// chip can read them without introducing new type errors.
interface DomainRow extends DomainInterface {
  isStale?: boolean;
  lastChecked?: string | Date | null;
}

interface Props {
  churchId: string;
  saveTrigger: Date | null;
}

// A domain is "live" once a health probe has checked it and found it reachable
// (lastChecked set and NOT stale). Anything else — never checked, or flagged
// stale (which the server sets when a Caddy push fails) — reads as not-live-yet.
const isDomainLive = (d: DomainRow): boolean => !!d.lastChecked && d.isStale !== true;

export const DomainSettingsEdit: React.FC<Props> = (props) => {
  const [domains, setDomains] = React.useState<DomainRow[]>([]);
  const [originalDomains, setOriginalDomains] = React.useState<DomainRow[]>([]);
  const [addDomainName, setAddDomainName] = React.useState("");
  const [error, setError] = React.useState("");

  const validateDomainName = (domain: string): string => {
    if (!domain || domain.trim() === "") {
      return Locale.label("settings.domain.errorInvalid");
    }

    let cleanDomain = domain.trim().toLowerCase();

    // Remove protocol if present
    if (cleanDomain.startsWith("http://") || cleanDomain.startsWith("https://")) {
      return Locale.label("settings.domain.errorInvalid");
    }

    // Remove trailing slash if present
    if (cleanDomain.endsWith("/")) {
      cleanDomain = cleanDomain.slice(0, -1);
    }

    // Check for path or other invalid characters
    if (cleanDomain.includes("/")) {
      return Locale.label("settings.domain.errorInvalid");
    }

    // Domain must have at least one dot (e.g., example.com)
    if (!cleanDomain.includes(".")) {
      return Locale.label("settings.domain.errorInvalid");
    }

    // Basic domain format validation
    const domainRegex = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
    if (!domainRegex.test(cleanDomain)) {
      return Locale.label("settings.domain.errorInvalid");
    }

    // Check for duplicate
    if (domains.some(d => d.domainName?.toLowerCase() === cleanDomain)) {
      return Locale.label("settings.domain.errorInvalid");
    }

    return "";
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.preventDefault();
    switch (e.target.name) {
      case "domainName":
        setAddDomainName(e.target.value);
        setError("");
        break;
    }
  };

  // One-step save: deleting removed rows and posting new domains. The server
  // auto-pushes the Caddy route as part of POST /domains (no separate Relink).
  // If that push fails the server returns a structured { pushFailed } error with
  // the record persisted-but-not-live — surface it loudly and keep the field
  // editable so the admin can simply re-save to retry.
  const save = async () => {
    setError("");
    try {
      for (const d of originalDomains) {
        if (!ArrayHelper.getOne(domains, "id", d.id)) await ApiHelper.delete("/domains/" + d.id, "MembershipApi");
      }

      const toAdd: DomainRow[] = domains.filter((d) => !d.id);
      if (toAdd.length > 0) await ApiHelper.post("/domains", toAdd, "MembershipApi");

      // Reload so readiness chips reflect the server's post-save state.
      await loadData();
    } catch (e: any) {
      // ApiHelper throws on non-2xx and stuffs the JSON error body into the
      // message. Detect the server's fail-loud push-failure signal.
      const raw = e?.message ?? "";
      let pushFailed = false;
      try {
        const parsed = JSON.parse(raw);
        pushFailed = parsed?.pushFailed === true || parsed?.savedNotLive === true;
      } catch {
        pushFailed = /pushFailed|savedNotLive|Caddy/i.test(raw);
      }
      if (pushFailed) {
        setError(Locale.label("settings.domainSettingsEdit.pushFailed"));
      } else {
        setError(raw || Locale.label("settings.domain.errorInvalid"));
      }
      // Reload regardless: the record is persisted (flagged not-live) and the
      // add field stays editable, so the admin can re-save to retry the push.
      await loadData();
    }
  };

  const checkSave = () => {
    if (props.saveTrigger !== null) save();
  };

  const loadData = async () => {
    const data = await ApiHelper.get("/domains", "MembershipApi");
    setOriginalDomains(data);
    setDomains(data);
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    const validationError = validateDomainName(addDomainName);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Clean the domain name before adding
    let cleanDomain = addDomainName.trim().toLowerCase();
    if (cleanDomain.endsWith("/")) {
      cleanDomain = cleanDomain.slice(0, -1);
    }

    const doms: DomainRow[] = [...domains];
    doms.push({ domainName: cleanDomain });
    setDomains(doms);
    setAddDomainName("");
    setError("");
  };

  const handleDelete = (index: number) => {
    const doms: DomainRow[] = [...domains];
    doms.splice(index, 1);
    setDomains(doms);
  };

  // Lightweight live / not-live-yet readiness chip derived from the health probe
  // state (isStale / lastChecked). This is deliberately minimal — not a rich
  // DNS-record / cert-status dashboard (that is deferred TEN-05 work).
  const getReadinessChip = (d: DomainRow) => {
    if (!d.id) return null; // unsaved rows have no readiness yet
    if (isDomainLive(d)) {
      return <Chip size="small" color="success" variant="outlined" icon={<CheckCircleOutlineIcon />} label={Locale.label("settings.domainSettingsEdit.live")} />;
    }
    return <Chip size="small" color="warning" variant="outlined" icon={<HourglassEmptyIcon />} label={Locale.label("settings.domainSettingsEdit.notLive")} />;
  };

  const getRows = () => {
    const result: JSX.Element[] = [];
    let idx = 0;
    domains.forEach((d) => {
      const index = idx;
      result.push(
        <TableRow key={index} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
          <TableCell sx={{ py: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <LinkIcon sx={{ color: "text.disabled", fontSize: 18 }} />
              <Typography variant="body2">{d.domainName}</Typography>
            </Box>
          </TableCell>
          <TableCell sx={{ py: 1.5 }}>
            {getReadinessChip(d)}
          </TableCell>
          <TableCell sx={{ py: 1.5, width: 50 }}>
            <AppIconButton label={Locale.label("common.delete")} icon={<DeleteOutlineIcon />} intent="remove" onClick={() => handleDelete(index)} />
          </TableCell>
        </TableRow>
      );
      idx++;
    });
    return result;
  };

  React.useEffect(() => {
    if (props.churchId) loadData();
  }, [props.churchId]);
  React.useEffect(checkSave, [props.saveTrigger]);

  return (
    <Box>
      <Box sx={{
        p: 2,
        mb: 2,
        bgcolor: "action.hover",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider"
      }}>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
          {Locale.label("settings.domainSettingsEdit.domMsg")} <code style={{ backgroundColor: "rgba(0,0,0,0.08)", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>CNAME: proxy.huro.church</code>
          {Locale.label("settings.domainSettingsEdit.domMsg2")} <code style={{ backgroundColor: "rgba(0,0,0,0.08)", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>A: 3.23.251.61</code>
          {Locale.label("settings.domainSettingsEdit.domMsg3")}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      <Table size="small" sx={{ "& .MuiTableCell-root": { borderColor: "divider" } }}>
        <TableHead>
          <TableRow sx={{ bgcolor: "action.hover" }}>
            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>{Locale.label("settings.domainSettingsEdit.domain")}</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>{Locale.label("settings.domainSettingsEdit.status")}</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1.5, width: 50 }}></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {getRows()}
          <TableRow>
            <TableCell sx={{ py: 1 }} colSpan={2}>
              <TextField
                fullWidth
                name="domainName"
                size="small"
                value={addDomainName}
                onChange={handleChange}
                placeholder={Locale.label("settings.domain.domainPlaceholder")}
                error={!!error}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
              />
            </TableCell>
            <TableCell sx={{ py: 1 }}>
              <AppIconButton label={Locale.label("common.add")} icon={<AddCircleOutlineIcon />} tone="card" intent="add" onClick={handleAdd} />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
};
