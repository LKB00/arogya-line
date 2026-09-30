import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Self-hosted, bundled as a static asset: no runtime request to a third party.
import "@fontsource-variable/figtree";
// Roboto Medium: Android's status bar clock face (sans-serif-medium), for the
// device frame only. Latin, one weight.
import "@fontsource/roboto/latin-500.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/product.css";
import "./styles/asha.css";
import "./styles/voice.css";
import "./styles/phc.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
