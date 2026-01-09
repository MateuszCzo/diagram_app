import React, { useEffect, useRef } from "react";

function App() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const drawIoReady = useRef(false);
  const lastSentSnapshot = useRef("");

  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const projectId = "chatbot_drawio";

  const initialSnapshot = `<mxfile host="app.diagrams.net"><diagram id="0" name="Page-1"></diagram></mxfile>`;

  const startWebSocket = (cw: Window) => {
    const connectWS = () => {
      console.log("🔌 INIT WebSocket");
      const socket = new WebSocket(`${backendUrl.replace(/^http/, "ws")}/ws/${projectId}`);

      socket.onopen = () => {
        console.log("✅ WS OPEN");
        ws.current = socket;
      };

      socket.onmessage = (event) => {
        const snapshot = event.data;
        if (!snapshot || !snapshot.trim()) {
          console.log("Empty data from ws")
          return;
        }

        if (!drawIoReady.current) {
          console.log("⚠️ Draw.io niegotowe – pomijam snapshot z WS");
          return;
        }

        console.log("⬇ Snapshot z backendu – wysyłam do iframe");
        cw.postMessage(JSON.stringify({ action: "load", xml: snapshot }), "*");
        lastSentSnapshot.current = snapshot;
      };

      socket.onclose = () => {
        console.warn("❌ WS CLOSED – retry za 1s");
        setTimeout(connectWS, 1000);
      };

      socket.onerror = (err) => console.error("❌ WS ERROR", err);
    };

    connectWS();
  };

  const handleMessage = (event: MessageEvent) => {
    if (!event.data || typeof event.data !== "string") return;

    let msg: any;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg.event === "init" && !drawIoReady.current) {
      console.log("✅ Draw.io gotowe – wysyłam initial snapshot");
      const iframe = iframeRef.current;
      if (!iframe) {
        console.log("Iframe not ready");
        return;
      }
      iframe.contentWindow?.postMessage(JSON.stringify({ action: "load", xml: initialSnapshot }), "*");
      lastSentSnapshot.current = initialSnapshot;
      drawIoReady.current = true;

      startWebSocket(iframe.contentWindow!);
    }

    if (msg.event === "save" && typeof msg.xml === "string") {
      if (msg.xml === lastSentSnapshot.current) return;

      lastSentSnapshot.current = msg.xml;

      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(msg.xml);
        console.log("📤 Snapshot wysłany do backendu");
      } else {
        console.warn("⚠️ WS niegotowy – nie wysłano");
      }
    }
  };

  useEffect(() => {
    if (!backendUrl) {
      console.error("❌ Brak VITE_BACKEND_URL");
      return;
    }

    window.addEventListener("message", handleMessage);

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title="drawio"
      src="https://embed.diagrams.net/?embed=1&ui=atlas&spin=1&proto=json"
      style={{ width: "100vw", height: "100vh", border: "none" }}
    />
  );
}

export default App;
