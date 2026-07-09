import React from "react";
import { Alert, AlertTitle } from "@mui/material";
import { ApiHelper } from "@churchapps/apphelper";

// DLV-02 — the PROACTIVE sending-status banner. It is ALWAYS visible in the
// campaigns area whenever the huro.church sending domain is not sendable, so the
// send block (a hard 422 at /send time) is never a surprise (11-CONTEXT: "never a
// surprise at send time").
//
// Data source (Plan-02 EmailCampaignController):
//   GET /campaigns/domain-status
//     -> { sendable, maxSendRate, max24Hour, sentLast24 }   (VerifiedDomainGate.status)
//     -> { sendable:false, reason:"no-email-settings" }      (no from-identity yet)
//
// Path/app-name note: MessagingApi base already ends in "/messaging" so the bare
// "/campaigns/domain-status" hits /messaging/campaigns/domain-status; app key is
// "MessagingApi". (doubled-prefix lesson.)
//
// The dialog (SendConfirmDialog) fetches domain-status independently for safety,
// but a parent that mounts both can reuse this fetch via the onStatus callback to
// avoid a duplicate request.

interface DomainStatus {
  sendable: boolean;
  reason?: string;
  maxSendRate?: number;
  max24Hour?: number;
  sentLast24?: number;
}

interface Props {
  // Called on every successful poll with the live sendable flag, so a parent can
  // reuse the status (e.g. disable a send button) without a second fetch.
  onStatus?: (sendable: boolean, status: DomainStatus) => void;
  // How often to re-check (ms). Light interval — the domain rarely flips.
  pollMs?: number;
}

export function UnverifiedDomainBanner(props: Props) {
  const { onStatus, pollMs = 60000 } = props;
  const [status, setStatus] = React.useState<DomainStatus | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  // Keep the latest onStatus without re-arming the interval when the parent
  // passes a fresh callback identity each render.
  const onStatusRef = React.useRef(onStatus);
  React.useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  React.useEffect(() => {
    let active = true;

    const check = () => {
      ApiHelper.get("/campaigns/domain-status", "MessagingApi")
        .then((data: DomainStatus) => {
          if (!active) return;
          setStatus(data);
          setLoaded(true);
          onStatusRef.current?.(data?.sendable === true, data);
        })
        .catch(() => {
          // A transient fetch failure shouldn't flash a false "unverified"
          // banner — keep the last known status. If we never loaded, stay quiet.
          if (active) setLoaded(true);
        });
    };

    check();
    const timer = window.setInterval(check, pollMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pollMs]);

  // Render nothing until the first result, and nothing when sendable.
  if (!loaded || !status || status.sendable) return null;

  const noSettings = status.reason === "no-email-settings";

  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      <AlertTitle>
        {noSettings ? "Sender identity not set up" : "Sending domain not verified"}
      </AlertTitle>
      {noSettings ? (
        <>
          No from-address is configured yet, so campaigns can&rsquo;t be sent. Set your
          from-name and from-email (on <strong>huro.church</strong>) in Email settings.
        </>
      ) : (
        <>
          Your <strong>huro.church</strong> sending domain isn&rsquo;t verified in Amazon
          SES yet, so campaigns can&rsquo;t be sent. Verify the domain in the SES console
          (or ask your administrator to). Sending is blocked until it&rsquo;s verified.
        </>
      )}
    </Alert>
  );
}
