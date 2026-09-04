/**
 * Host telemetry. Never logs document text (AD-14).
 * Amplitude is a no-op without AMPLITUDE_API_KEY — morph does not init a quiet client.
 */
const opened = new Set<string>();

export function noteFirstOpen(sessionId: string): void {
  if (opened.has(sessionId)) return;
  opened.add(sessionId);
  if (!process.env.AMPLITUDE_API_KEY) return;
  // Event name is frozen for the existing dashboard. Payload is identity only.
  console.info(
    JSON.stringify({
      event: "SuperDoc Document Opened",
      sessionId,
      source: "morph",
    }),
  );
}
