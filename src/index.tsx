import { createRoot } from "react-dom/client";
import App from "./App";
import { EnvironmentHelper } from "./helpers";
import { installChunkReloadHandler } from "./helpers/chunkReload";

import * as Sentry from "@sentry/react";

// Auto-recover from stale lazy-chunk references after a redeploy (one guarded reload).
installChunkReloadHandler();

Sentry.init({
  dsn: "https://0fa8dbad4eea6ffc6b2ffc157c43cff2@o4510432524107776.ingest.us.sentry.io/4510432531251200",
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration()
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true
});


EnvironmentHelper.init().then(() => {
  const root = createRoot(document.getElementById("root"));
  //root.render(<React.StrictMode><App /></React.StrictMode>);
  root.render(<App />);
});
