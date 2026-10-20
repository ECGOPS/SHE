/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_VAPID_PUBLIC_KEY: string;
  readonly VITE_MAP_TILE_URL: string;

  // Microsoft Entra ID (optional — leave blank to disable SSO)
  readonly VITE_ENTRA_TENANT_ID?: string;
  readonly VITE_ENTRA_CLIENT_ID?: string;
  readonly VITE_ENTRA_AUDIENCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
