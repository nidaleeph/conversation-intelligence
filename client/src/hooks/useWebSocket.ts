import { useContext, useEffect } from "react";
import { WebSocketContext } from "@/contexts/WebSocketContext";

export function useWebSocket() {
  return useContext(WebSocketContext);
}

export function useWebSocketEvent(
  eventType: string,
  handler: (data: any) => void
) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(eventType, handler);
    return unsubscribe;
  }, [eventType, handler, subscribe]);
}
