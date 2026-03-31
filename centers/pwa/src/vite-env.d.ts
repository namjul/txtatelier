/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly BASE_URL: string;
  /** Injected in CI (GitHub Actions); unset locally → settings shows fallback. */
  readonly VITE_COMMIT_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
