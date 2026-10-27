"use client";

import { useEffect } from "react";
import { datadogRum } from "@datadog/browser-rum";

const APPLICATION_ID = process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID;
const CLIENT_TOKEN = process.env.NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN;

/**
 * Starts Datadog RUM so the download section's custom actions (installer clicks, install-command copies)
 * are counted. Only those explicit actions are recorded: no automatic click capture and no session replay.
 * Does nothing until both env vars are set, so local dev and previews without them stay untracked.
 */
export default function DatadogRum() {
  useEffect(() => {
    if (!APPLICATION_ID || !CLIENT_TOKEN || datadogRum.getInitConfiguration()) return;
    datadogRum.init({
      applicationId: APPLICATION_ID,
      clientToken: CLIENT_TOKEN,
      site: "us5.datadoghq.com",
      service: "postcompass-web",
      env: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
      sessionSampleRate: 100,
      sessionReplaySampleRate: 0,
      trackUserInteractions: false,
      trackResources: false,
      trackLongTasks: false,
      defaultPrivacyLevel: "mask",
    });
  }, []);

  return null;
}
