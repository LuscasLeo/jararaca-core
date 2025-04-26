import {
  PropsWithChildren,
  Provider,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import { Map, Set } from "immutable";

import {
  WebSocketConnectionContext,
  WebSocketConnectionStatus,
} from "./websocket";
import { recursiveSnakeToCamelCase } from "../app-backend/abc";

export type WebSocketProviderProps<T> = {
  url: string;
  connectionQueryParams: URLSearchParams;
  Provider: Provider<WebSocketConnectionContext<T> | null>;
};

function useWebsocket({
  url,
  connectionQueryParams,
  onMessage,
}: {
  url: string;
  connectionQueryParams: URLSearchParams;
  onMessage: (event: MessageEvent) => void;
}) {
  const [connectionStatus, setConnectionStatus] =
    useState<WebSocketConnectionStatus>("idle");

  const [pending, start] = useTransition();

  const [ws, setWs] = useState<[WebSocket, AbortController] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const sws = new WebSocket(`${url}?${connectionQueryParams.toString()}`);
    sws.binaryType = "arraybuffer";
    requestAnimationFrame(() => setConnectionStatus("connecting"));

    sws.addEventListener(
      "open",
      () => {
        setConnectionStatus("connected");
      },
      {
        signal: controller.signal,
      },
    );

    sws.addEventListener(
      "close",
      () => {
        setConnectionStatus("closed");
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
  }, [connectionQueryParams, url, pending]);

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

  const { connectionStatus } = useWebsocket(
    useMemo(
      () => ({ url, connectionQueryParams, onMessage }),
      [url, connectionQueryParams, onMessage],
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
    () => ({ registerHandler, unRegisterHandler, connectionStatus }),
    [connectionStatus, registerHandler, unRegisterHandler],
  );

  return <WebSocketContext value={contextValue}>{children}</WebSocketContext>;
}
