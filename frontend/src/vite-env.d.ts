/// <reference types="vite/client" />

interface ImportMetaEnv {
  API_URL: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

