/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deployed RescueRun contract address on Diana (0x...). Empty = demo mode. */
  readonly VITE_RESCUE_RUN_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
