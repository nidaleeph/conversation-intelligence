import { useCallback, useEffect, useState } from "react";
import { getWhatsAppWebStatus, type WhatsAppWebStatus } from "@/api/whatsappWeb";
import { useWebSocketEvent } from "@/hooks/useWebSocket";

const POLL_INTERVAL_MS = 3000;

export function useWhatsAppStatus() {
  const [status, setStatus] = useState<WhatsAppWebStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getWhatsAppWebStatus();
      setStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unknown error");
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Real-time updates pushed by the server on every state change
  useWebSocketEvent(
    "whatsapp:status",
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { status, error };
}
