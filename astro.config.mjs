import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import icon from "astro-icon";
import react from "@astrojs/react";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    // Keep the React JSX runtimes prebundled together. This prevents a stale
    // development cache from serving a runtime without jsxDEV after upgrades.
    optimizeDeps: {
      force: true,
      include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  },
  integrations: [icon(), react()],
  devToolbar: { enabled: false },
});
