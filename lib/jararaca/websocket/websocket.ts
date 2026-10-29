import { createContext, useContext, useEffect, useRef } from "react";

export type WebSocketConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "closed"
  | "closed_error";

export type WebSocketConnectInfo = {
  /** True when this provider instance had already been connected before. */
  isReconnect: boolean;
  /** Which attempt succeeded since the last disconnect (1 = first try). */
  attempt: number;
};

export type WebSocketDisconnectInfo = {
  code?: number;
  reason?: string;
  wasClean?: boolean;
};

export type WebSocketLifecycleEvents = {
  connected: WebSocketConnectInfo;
  disconnected: WebSocketDisconnectInfo;
};

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
  /**
   * Subscribes to connection lifecycle events. Returns an unsubscribe function.
   * Optional so custom context values written before it existed still type-check.
   */
  subscribeLifecycle?<E extends keyof WebSocketLifecycleEvents>(
    event: E,
    handler: (info: WebSocketLifecycleEvents[E]) => void,
  ): () => void;
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

  function useLifecycleEvent<E extends keyof WebSocketLifecycleEvents>(
    event: E,
    handler: (info: WebSocketLifecycleEvents[E]) => void,
  ) {
    const { subscribeLifecycle } = useWebSocket();
    // Keep the latest handler without re-subscribing on every render.
    const handlerRef = useRef(handler);
    useEffect(() => {
      handlerRef.current = handler;
    });
    useEffect(() => {
      if (!subscribeLifecycle) return;
      return subscribeLifecycle(event, (info) => handlerRef.current(info));
    }, [event, subscribeLifecycle]);
  }

  /** Called on every successful WebSocket open (from the real `open` event). */
  function useOnWebSocketConnect(
    handler: (info: WebSocketConnectInfo) => void,
  ) {
    useLifecycleEvent("connected", handler);
  }

  /** Called when an open WebSocket closes (from the real `close` event). */
  function useOnWebSocketDisconnect(
    handler: (info: WebSocketDisconnectInfo) => void,
  ) {
    useLifecycleEvent("disconnected", handler);
  }

  const WebSocketProvider = WebSocketContext.Provider;

  return {
    WebSocketContext,
    useWebSocket,
    useWebSocketEvent,
    useOnWebSocketConnect,
    useOnWebSocketDisconnect,
    WebSocketProvider,
  };
}
