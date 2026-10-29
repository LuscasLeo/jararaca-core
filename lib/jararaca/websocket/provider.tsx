import {
  PropsWithChildren,
  Provider,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { Map, Set } from "immutable";

import {
  WebSocketConnectionContext,
  WebSocketConnectionStatus,
  WebSocketLifecycleEvents,
} from "./websocket";
import { recursiveSnakeToCamelCase } from "../app-backend/abc";

export type WebSocketProviderProps<T> = {
  url: string;
  connectionQueryParams: URLSearchParams;
  Provider: Provider<WebSocketConnectionContext<T> | null>;
};

type LifecycleEmit = <E extends keyof WebSocketLifecycleEvents>(
  event: E,
  info: WebSocketLifecycleEvents[E],
) => void;

function useWebsocket({
  url,
  connectionQueryParams,
  onMessage,
  emitLifecycle,
}: {
  url: string;
  connectionQueryParams: URLSearchParams;
  onMessage: (event: MessageEvent) => void;
  emitLifecycle: LifecycleEmit;
}) {
  // Connection history for this provider mount (survives socket re-creation).
  const hasConnectedRef = useRef(false);
  // Sockets that closed before opening since the last successful open.
  const failedAttemptsRef = useRef(0);
  const [connectionStatus, setConnectionStatus] =
    useState<WebSocketConnectionStatus>("idle");

  const [pending, start] = useTransition();

  const [ws, setWs] = useState<[WebSocket, AbortController] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const sws = new WebSocket(`${url}?${connectionQueryParams.toString()}`);
    sws.binaryType = "arraybuffer";
    requestAnimationFrame(() => setConnectionStatus("connecting"));
    let opened = false;

    sws.addEventListener(
      "open",
      () => {
        opened = true;
        const info = {
          isReconnect: hasConnectedRef.current,
          attempt: failedAttemptsRef.current + 1,
        };
        hasConnectedRef.current = true;
        failedAttemptsRef.current = 0;
        setConnectionStatus("connected");
        emitLifecycle("connected", info);
      },
      {
        signal: controller.signal,
      },
    );

    sws.addEventListener(
      "close",
      (event) => {
        setConnectionStatus("closed");
        // Failed reconnect attempts also fire "close"; only report a drop
        // of a connection that was actually open.
        if (!opened) {
          failedAttemptsRef.current += 1;
        } else {
          emitLifecycle("disconnected", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
        }
      },
      {
        signal: controller.signal,
      },
    );

    requestAnimationFrame(() => setWs(() => [sws, controller]));

    return () => {
      controller.abort();
      sws.close();
    };
  }, [connectionQueryParams, url, pending, emitLifecycle]);

  useEffect(() => {
    if (connectionStatus === "closed") {
      const id = setTimeout(() => start(() => {}), 2000);
      return () => clearTimeout(id);
    }
  }, [connectionStatus, start]);

  useEffect(() => {
    if (ws) {
      ws[0].addEventListener("message", onMessage, {
        signal: ws[1].signal,
      });
    }
    return () => {
      if (ws) {
        ws[0].removeEventListener("message", onMessage);
      }
    };
  }, [onMessage, ws]);

  return { connectionStatus };
}

export function WebSocketProvider<T extends { [key: string]: any }>({
  Provider: WebSocketContext,
  children,
  url,
  connectionQueryParams,
}: PropsWithChildren<WebSocketProviderProps<T>>) {
  // const [connectionStatus, setConnectionStatus] =
  //     useState<WebSocketConnectionStatus>("connecting");

  const [eventMap, setEventMap] = useState(() =>
    Map<string | number | symbol, Set<(data: any) => void>>(),
  );

  const onMessage = useCallback(
    (event: MessageEvent) => {
      const text = new TextDecoder().decode(event.data);

      const json = recursiveSnakeToCamelCase(JSON.parse(text));

      const handlers = eventMap.get(json.MESSAGE_ID);

      if (handlers) {
        handlers.forEach((handler) => handler(json.message));
      }
    },
    [eventMap],
  );

  // Lifecycle handlers live in a ref: (un)subscribing never re-renders.
  const lifecycleHandlersRef = useRef<{
    [E in keyof WebSocketLifecycleEvents]: globalThis.Set<
      (info: WebSocketLifecycleEvents[E]) => void
    >;
  }>({ connected: new globalThis.Set(), disconnected: new globalThis.Set() });

  const emitLifecycle = useCallback<LifecycleEmit>((event, info) => {
    const handlers = lifecycleHandlersRef.current[event] as globalThis.Set<
      (info: WebSocketLifecycleEvents[typeof event]) => void
    >;
    [...handlers].forEach((handler) => handler(info));
  }, []);

  const subscribeLifecycle = useCallback(function subscribeLifecycle<
    E extends keyof WebSocketLifecycleEvents,
  >(event: E, handler: (info: WebSocketLifecycleEvents[E]) => void) {
    const handlers = lifecycleHandlersRef.current[event] as globalThis.Set<
      (info: WebSocketLifecycleEvents[E]) => void
    >;
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }, []);

  const { connectionStatus } = useWebsocket(
    useMemo(
      () => ({ url, connectionQueryParams, onMessage, emitLifecycle }),
      [url, connectionQueryParams, onMessage, emitLifecycle],
    ),
  );

  const registerHandler = useCallback(
    function registerHandler<K extends keyof T>(
      event: K,
      handler: (data: T[K]) => void,
    ) {
      setEventMap((eventMap) =>
        eventMap.set(
          event,
          eventMap.get(event)?.add(handler) ?? Set([handler]),
        ),
      );
    },
    [setEventMap],
  );

  const unRegisterHandler = useCallback(
    function unRegisterHandler<K extends keyof T>(
      event: K,
      handler: (data: T[K]) => void,
    ) {
      setEventMap((eventMap) =>
        eventMap.set(event, eventMap.get(event)?.delete(handler) ?? Set()),
      );
    },
    [setEventMap],
  );

  const contextValue = useMemo(
    () => ({
      registerHandler,
      unRegisterHandler,
      connectionStatus,
      subscribeLifecycle,
    }),
    [connectionStatus, registerHandler, unRegisterHandler, subscribeLifecycle],
  );

  return <WebSocketContext value={contextValue}>{children}</WebSocketContext>;
}
