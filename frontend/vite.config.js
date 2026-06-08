import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import basicSsl from "@vitejs/plugin-basic-ssl";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import {
  VantResolver,
  ElementPlusResolver,
} from "unplugin-vue-components/resolvers";
import { resolve } from "path";

const serverAdds = {
  dev: "http://127.0.0.1:3000",
  prod: "https://astr-lab.gts.huawei.com/",
};

const devServer = serverAdds.dev;
export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return defineConfig({
    base: env.VITE_BASE_URL,
    plugins: [
      vue(),
      basicSsl(),
      AutoImport({
        resolvers: [VantResolver(), ElementPlusResolver()],
      }),
      Components({
        resolvers: [VantResolver(), ElementPlusResolver()],
      }),
    ],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    server: {
      https: false,
      host: "nexus.protal.huawei.com",
      port: 443,
      cros: true,
      open: true,
      proxy: {
        "/wiseoffice/api/agent": {
          target: devServer,
          changeOrigin: true,
          secure: false,
          headers: {
            Referer: devServer,
          },
        },
      },
    },
    build: {
      target: "es2015",
      outDir: "dist/nexus",
    },
  });
};
