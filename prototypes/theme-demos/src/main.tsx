import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import WorldApp from "./WorldApp";
import "./styles.css";

// The 3D journey is the default; the earlier 2.5D side-scroller stays at ?view=classic.
const classic = new URLSearchParams(window.location.search).get("view") === "classic";

createRoot(document.getElementById("root")!).render(
  <StrictMode>{classic ? <App /> : <WorldApp />}</StrictMode>,
);
