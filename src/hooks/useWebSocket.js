import { useEffect, useRef, useCallback } from 'react';

/**
 * Manages a WebSocket connection with auto-reconnect.
 * Closes on 'complete' or 'error' message types.
 */
export default function useWebSocket(caseId, onMessage, pathPrefix = 'cases') {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const closed = useRef(false);

  const connect = useCallback(() => {
    if (!caseId || closed.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const token = localStorage.getItem('secnd_token') || '';
    const url = `${protocol}://${window.location.host}/ws/${pathPrefix}/${caseId}/status?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      clearTimeout(reconnectTimer.current);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
        if (data.type === 'complete' || data.type === 'error') {
          closed.current = true;
          ws.close();
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      if (!closed.current) {
        reconnectTimer.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [caseId, onMessage, pathPrefix]);

  useEffect(() => {
    closed.current = false;
    connect();
    return () => {
      closed.current = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
