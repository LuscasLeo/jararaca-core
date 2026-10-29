import { useState } from "react";

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WebSocketProvider } from "./provider";
import {
  createWebSocketContext,
  WebSocketConnectInfo,
  WebSocketDisconnectInfo,
} from "./websocket";

class MockWebSocket extends EventTarget {
  static instances: MockWebSocket[] = [];
  binaryType = "blob";
  constructor(public url: string) {
    super();
    MockWebSocket.instances.push(this);
  }
  close() {}
  serverOpen() {
    this.dispatchEvent(new Event("open"));
  }
  serverClose(code = 1006, reason = "", wasClean = false) {
    const event = new Event("close") as CloseEvent;
    Object.assign(event, { code, reason, wasClean });
    this.dispatchEvent(event);
  }
}

const latest = () => MockWebSocket.instances.at(-1)!;

type Events = { ping: { n: number } };
const ctx = createWebSocketContext<Events>();
const params = new URLSearchParams();

function Listener({
  onConnect,
  onDisconnect,
}: {
  onConnect: (info: WebSocketConnectInfo) => void;
  onDisconnect: (info: WebSocketDisconnectInfo) => void;
}) {
  ctx.useOnWebSocketConnect(onConnect);
  ctx.useOnWebSocketDisconnect(onDisconnect);
  return null;
}

function App(props: {
  onConnect: (info: WebSocketConnectInfo) => void;
  onDisconnect: (info: WebSocketDisconnectInfo) => void;
  showListener?: boolean;
}) {
  return (
    <WebSocketProvider<Events>
      url="ws://test"
      connectionQueryParams={params}
      Provider={ctx.WebSocketProvider}
    >
      {props.showListener !== false && <Listener {...props} />}
    </WebSocketProvider>
  );
}

async function flush() {
  await act(async () => {
    vi.advanceTimersByTime(20); // requestAnimationFrame
  });
}

// Wait out the provider's 2s reconnect delay.
async function waitReconnect() {
  await act(async () => {
    vi.advanceTimersByTime(2100);
  });
  await flush();
}

describe("WebSocket lifecycle hooks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("first connection emits connect with isReconnect=false", async () => {
    const onConnect = vi.fn();
    render(<App onConnect={onConnect} onDisconnect={vi.fn()} />);
    await flush();
    act(() => latest().serverOpen());
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith({ isReconnect: false, attempt: 1 });
  });

  it("a drop emits disconnect with close details", async () => {
    const onDisconnect = vi.fn();
    render(<App onConnect={vi.fn()} onDisconnect={onDisconnect} />);
    await flush();
    act(() => latest().serverOpen());
    act(() => latest().serverClose(1011, "boom", false));
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(onDisconnect).toHaveBeenCalledWith({
      code: 1011,
      reason: "boom",
      wasClean: false,
    });
  });

  it("reconnecting emits connect with isReconnect=true and counts attempts", async () => {
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    render(<App onConnect={onConnect} onDisconnect={onDisconnect} />);
    await flush();
    act(() => latest().serverOpen());
    act(() => latest().serverClose());

    // First retry fails before opening: no extra disconnect event.
    await waitReconnect();
    act(() => latest().serverClose());
    expect(onDisconnect).toHaveBeenCalledTimes(1);

    // Second retry succeeds.
    await waitReconnect();
    act(() => latest().serverOpen());

    expect(onConnect).toHaveBeenCalledTimes(2);
    expect(onConnect).toHaveBeenLastCalledWith({
      isReconnect: true,
      attempt: 2,
    });
  });

  it("unmounted handlers are not called", async () => {
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    const { rerender } = render(
      <App onConnect={onConnect} onDisconnect={onDisconnect} />,
    );
    await flush();
    rerender(
      <App
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        showListener={false}
      />,
    );
    act(() => latest().serverOpen());
    act(() => latest().serverClose());
    expect(onConnect).not.toHaveBeenCalled();
    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it("uses the latest handler without re-subscribing", async () => {
    const calls: string[] = [];
    function Changing() {
      const [label, setLabel] = useState("first");
      ctx.useOnWebSocketConnect(() => calls.push(label));
      return (
        <button type="button" onClick={() => setLabel("second")}>
          change
        </button>
      );
    }
    const { getByRole } = render(
      <WebSocketProvider<Events>
        url="ws://test"
        connectionQueryParams={params}
        Provider={ctx.WebSocketProvider}
      >
        <Changing />
      </WebSocketProvider>,
    );
    await flush();
    act(() => getByRole("button").click());
    act(() => latest().serverOpen());
    expect(calls).toEqual(["second"]);
  });

  it("keeps connectionStatus working", async () => {
    let status = "";
    function Status() {
      status = ctx.useWebSocket().connectionStatus;
      return null;
    }
    render(
      <WebSocketProvider<Events>
        url="ws://test"
        connectionQueryParams={params}
        Provider={ctx.WebSocketProvider}
      >
        <Status />
      </WebSocketProvider>,
    );
    await flush();
    act(() => latest().serverOpen());
    expect(status).toBe("connected");
    act(() => latest().serverClose());
    expect(status).toBe("closed");
  });
});
