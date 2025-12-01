
// Removed reference to vite/client to fix type error
interface ImportMetaEnv {
  readonly VITE_API_KEY: string;
  // Add your own backend URL variables here when ready
  // readonly VITE_BACKEND_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
