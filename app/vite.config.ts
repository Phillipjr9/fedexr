import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { inspectAttr } from 'kimi-plugin-inspect-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const accountsTarget = env.ACCOUNTS_API_TARGET || 'http://127.0.0.1:3001';
  if (!['browser', 'server'].includes(env.VITE_WORKSPACE_MODE || 'browser'))
    throw new Error('VITE_WORKSPACE_MODE must explicitly be browser or server.');
  return {
    envDir: path.resolve(__dirname, '..'),
    base: '/',
    cacheDir: `.cache/vite/${mode}`,
    plugins: [inspectAttr(), react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: ['.e2b.app'],
      proxy: {
        '/api/upload-tracking-image': { target: accountsTarget, changeOrigin: false },
        '/api/get-tracking-image': { target: accountsTarget, changeOrigin: false },
        '/api/auth': { target: accountsTarget, changeOrigin: false },
        '/api/workspace': { target: accountsTarget, changeOrigin: false },
        '/api/tracking': { target: accountsTarget, changeOrigin: false },
        '/api/carrier': { target: accountsTarget, changeOrigin: false },
        '/api/account': { target: accountsTarget, changeOrigin: false },
      },
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: ['.e2b.app'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
