import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react({
      // 启用React快速刷新
      fastRefresh: true,
      // 启用React开发工具
      include: "**/*.{jsx,tsx}",
    }),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      "@services": path.resolve(import.meta.dirname, "client", "src", "services"),
      "@components": path.resolve(import.meta.dirname, "client", "src", "components"),
      "@hooks": path.resolve(import.meta.dirname, "client", "src", "hooks"),
      "@lib": path.resolve(import.meta.dirname, "client", "src", "lib"),
      "@pages": path.resolve(import.meta.dirname, "client", "src", "pages"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // 生产构建优化
    sourcemap: process.env.NODE_ENV !== "production",
    rollupOptions: {
      output: {
        // 代码分割优化
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          query: ['@tanstack/react-query'],
          router: ['wouter'],
          utils: ['date-fns', 'clsx', 'tailwind-merge'],
        },
        // 优化chunk文件名
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId 
            ? chunkInfo.facadeModuleId.split('/').pop() 
            : 'chunk';
          return `js/${facadeModuleId}-[hash].js`;
        },
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name?.split('.').pop();
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType ?? '')) {
            return `images/[name]-[hash][extname]`;
          }
          if (/css/i.test(extType ?? '')) {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
    // 构建目标优化
    target: 'es2020',
    // 压缩优化
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production',
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: "ws://localhost:5001",
        ws: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*", "**/node_modules/**"],
    },
  },
  preview: {
    port: 4173,
    host: true,
  },
  // 依赖优化
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'wouter',
      '@tanstack/react-query',
      'date-fns',
      'clsx',
      'tailwind-merge',
      'sonner',
    ],
    exclude: ['@replit/vite-plugin-runtime-error-modal'],
  },
  // 环境变量
  define: {
    __DEV__: process.env.NODE_ENV !== 'production',
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },
  // CSS优化
  css: {
    devSourcemap: true,
    postcss: './postcss.config.js',
  },
});
