import "./App.css";
import React, { useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";

function App() {
  const [elements, setElements] = useState([]);

  const ws = useRef(null);
  const ignoreNextChange = useRef(false);
  const lastSentElementsRef = useRef("");
  const excalidrawRef = useRef(null);

  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  const projectId = "chatbot";

  useEffect(() => {
    if (!backendUrl) {
      console.log("❌ Brak REACT_APP_BACKEND_URL");
      return;
    }

    if (ws.current) {
      console.log("ℹ️ WebSocket już istnieje – nie tworzę nowego");
      return;
    }

    console.log("🔌 INIT WebSocket");
    ws.current = new WebSocket(`${backendUrl}/ws/${projectId}`);

    ws.current.onopen = () => {
      console.log("✅ WebSocket OPEN");
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data || !Array.isArray(data.elements)) {
          console.warn("⚠️ Nieprawidłowy snapshot z backendu:", data);
          return;
        }

        console.log("⬇ Snapshot z backendu | elements:", data.elements.length);

        ignoreNextChange.current = true;
        lastSentElementsRef.current = JSON.stringify(data.elements);
        setElements(data.elements);
        excalidrawRef.current?.updateScene({ elements: data.elements });
      } catch (e) {
        console.error("❌ Błąd parsowania WS:", e);
      }
    };

    ws.current.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
    };

    ws.current.onclose = () => {
      console.warn("❌ WebSocket CLOSED");
      ws.current = null;
    };

    // ❌ NIE zamykamy ws w clean-up
    return () => {};
  }, []); // tylko raz

  const onChange = (newElements) => {
    if (ignoreNextChange.current) {
      ignoreNextChange.current = false;
      return;
    }

    const serialized = JSON.stringify(newElements);
    if (serialized === lastSentElementsRef.current) {
      console.log("⏭ Brak zmian w elements – nie wysyłam");
      return;
    }

    console.log("⬆ Zmiana od użytkownika | elements:", newElements.length);
    lastSentElementsRef.current = serialized;
    setElements(newElements);

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ elements: newElements }));
      console.log("📤 Wysłano snapshot do backendu");
    } else {
      console.warn("⚠️ WebSocket niegotowy – nie wysłano");
    }
  };

  return (
    <div className="App" style={{ height: "100vh" }}>
      <Excalidraw
        ref={excalidrawRef}
        initialData={{ elements: [] }}
        onChange={onChange}
      />
    </div>
  );
}

export default App;
