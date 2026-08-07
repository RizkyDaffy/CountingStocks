import { defineConfig, loadEnv, type ConfigEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

export default (env: ConfigEnv) => {
  const { command, mode } = env;
  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");

  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadedEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return defineConfig({
    define: envDefine,

    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },

    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart(),
      viteReact(),
      // Cloudflare adapter — build only, opt-in via BUILD_TARGET=cloudflare.
      // Docker / Node SSR builds skip this so TanStack Start emits a Node server.
      ...(command === "build" && process.env.BUILD_TARGET === "cloudflare"
        ? [
            (async () => {
              const { cloudflare } = await import("@cloudflare/vite-plugin");
              return cloudflare({ viteEnvironment: { name: "ssr" } });
            })(),
          ]
        : []),
    ],

    server: {
      allowedHosts: true,
      proxy: {
        "/api": {
          target: "http://localhost:4005",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  });
};
