import { okResponse } from "@/lib/http/validate";
import { defaultModelRef, isOfflineMode } from "@/lib/ai/provider";

/**
 * Judges and the clean-room script use this to confirm the app is alive and to
 * see which mode it is running in. Keep it dependency-free and fast.
 */
const startedAt = Date.now();

export async function GET() {
  return okResponse({
    status: "ok",
    version: process.env.APP_VERSION ?? "0.1.0",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    model: { ref: defaultModelRef(), offline: isOfflineMode() },
  });
}
