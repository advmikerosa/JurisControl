// Removed reference to vite/client as it caused build errors in this environment
// The explicit interfaces below handle the necessary types

interface ImportMetaEnv {
  readonly VITE_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}