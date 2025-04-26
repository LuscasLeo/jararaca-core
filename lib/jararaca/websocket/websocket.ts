import { createContext, useContext, useEffect } from "react";

export type WebSocketConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "closed"
  | "closed_error";

export type WebSocketConnectionContext<T> = {
  registerHandler<K extends keyof T>(
    event: K,
    handler: (data: T[K]) => void,
  ): void;
  unRegisterHandler<K extends keyof T>(
    event: K,
    handler: (data: T[K]) => void,
  ): void;
  connectionStatus: WebSocketConnectionStatus;
};

export function createWebSocketContext<T>() {
  const WebSocketContext = createContext<WebSocketConnectionContext<T> | null>(
    null,
  );

  const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
      throw new Error("useWebSocket must be used within a WebSocketProvider");
    }
    return context;
  };

  function useWebSocketEvent<K extends keyof T>(
    event: K,
    handler: (data: T[K]) => void,
  ) {
    const { registerHandler, unRegisterHandler } = useWebSocket();
    useEffect(() => {
      registerHandler(event, handler);
      return () => {
        unRegisterHandler(event, handler);
      };
    }, [event, handler, registerHandler, unRegisterHandler]);
  }

  const WebSocketProvider = WebSocketContext.Provider;

  return {
    WebSocketContext,
    useWebSocket,
    useWebSocketEvent,
    WebSocketProvider,
  };
}
