import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import icon from "astro-icon";
import react from "@astrojs/react";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    // Keep the React JSX runtimes prebundled together. This prevents a stale
    // development cache from serving a runtime without jsxDEV after upgrades.
    // Libraries loaded with a dynamic import() are listed too: if Vite first meets
    // them while a page is running, that request fails with a 504 in development.
    optimizeDeps: {
      force: true,
      include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "marked", "@tensorflow/tfjs"],
    },
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  },
  integrations: [icon(), react()],
  devToolbar: { enabled: false },
});
