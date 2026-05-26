import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { setUpdateSW } from "@/components/common/UpdateBanner";

const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent("sw-need-refresh"));
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent("sw-offline-ready"));
  },
});

setUpdateSW(updateSW);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
