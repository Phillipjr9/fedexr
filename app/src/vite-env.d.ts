/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKSPACE_MODE?: string;
  readonly VITE_ADMIN_ACCESS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}