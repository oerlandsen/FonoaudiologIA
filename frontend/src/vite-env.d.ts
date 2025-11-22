/// <reference types="vite/client" />

interface ImportMetaEnv {
  ELEVENLABS_API_KEY: any;
  VITE_ELEVENLABS_API_KEY: any;
  API_URL: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

