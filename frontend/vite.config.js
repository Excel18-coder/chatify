import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  // Use relative asset paths so the built files work when loaded from the
  // Android WebView (assets served from android/app/src/main/assets/public).
  // Default Vite base is '/', which makes asset URLs absolute and breaks
  // loading inside Capacitor apps. './' makes them relative to index.html.
  base: "./",
  plugins: [react()],
});
