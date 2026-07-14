/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TURTLEBACK_DIAGNOSTICS?: '1'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
