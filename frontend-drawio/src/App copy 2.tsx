import React, { useEffect, useRef } from "react";

function App() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const lastSentSnapshot = useRef("");

  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const projectId = "chatbot_drawio";

  const initialSnapshot = `<mxfile host="app.diagrams.net"><diagram id="0" name="Page-1"></diagram></mxfile>`;

  useEffect(() => {
    //działa jeżeli poczekam
    const iframe = iframeRef.current;
    // tutaj trzeba poczekać
    if (!iframe) return;

    // ================= CHECK IFRAME READY =================
    const checkIframeReady = setInterval(() => {
      const cw = iframe.contentWindow;
      if (!cw) return;

      console.log("✅ Iframe gotowe – wysyłam początkowy diagram");

      // Wyślij minimalny diagram
      cw.postMessage(JSON.stringify({ action: "load", xml: initialSnapshot }), "*");
      lastSentSnapshot.current = initialSnapshot;

      clearInterval(checkIframeReady);

      // ================= WEBSOCKET =================
      if (!backendUrl) {
        console.error("❌ Brak VITE_BACKEND_URL");
        return;
      }

      const connectWS = () => {
        console.log("🔌 INIT WebSocket");
        const socket = new WebSocket(`${backendUrl}/ws/${projectId}`);

        socket.onopen = () => {
          console.log("✅ WS OPEN");
          ws.current = socket;
        };

        socket.onmessage = (event) => {
          const snapshot = event.data;
          if (!snapshot || !snapshot.trim()) return;

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

      // ================= DRAW.IO SAVE =================
      const handler = (event: MessageEvent) => {
        if (typeof event.data !== "string") return;

        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.event !== "save" || typeof msg.xml !== "string") return;

        // nie wysyłaj duplikatu
        if (msg.xml === lastSentSnapshot.current) return;

        lastSentSnapshot.current = msg.xml;

        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(msg.xml);
          console.log("📤 Snapshot wysłany do backendu");
        } else {
          console.warn("⚠️ WS niegotowy – nie wysłano");
        }
      };

      window.addEventListener("message", handler);

      // cleanup przy odmontowaniu
      return () => window.removeEventListener("message", handler);
    }, 100); // sprawdzamy co 100ms

    return () => clearInterval(checkIframeReady);
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
