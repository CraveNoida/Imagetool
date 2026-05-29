import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

const apiProxyTarget =
  process.env.API_PROXY_TARGET ??
  process.env.VITE_API_PROXY_TARGET ??
  "http://127.0.0.1:5050";

export default defineConfig(async () => {
  const replitPlugins = [];

  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
    const { default: runtimeErrorOverlay } = await import(
      "@replit/vite-plugin-runtime-error-modal"
    );

    const { cartographer } = await import("@replit/vite-plugin-cartographer");
    const { devBanner } = await import("@replit/vite-plugin-dev-banner");

    replitPlugins.push(
      runtimeErrorOverlay(),
      cartographer({
        root: path.resolve(import.meta.dirname, ".."),
      }),
      devBanner()
    );
  }

  return {
    base: basePath,
    plugins: [react(), tailwindcss(), ...replitPlugins],

    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(
          import.meta.dirname,
          "..",
          "..",
          "attached_assets"
        ),
      },
      dedupe: ["react", "react-dom"],
    },

    root: path.resolve(import.meta.dirname),

    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        onwarn(warning, defaultHandler) {
          if (
            warning.message.includes(
              "Error when using sourcemap for reporting an error"
            )
          ) {
            return;
          }

          defaultHandler(warning);
        },
      },
    },

    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
      },
    },

    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
