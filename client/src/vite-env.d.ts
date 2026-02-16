/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API URL for backend requests
  // Empty string = same-origin (works when Express serves the client)
  readonly VITE_API_URL: string
  
  // Socket.io server URL
  // Empty string = same-origin (works when Express serves the client)
  readonly VITE_SOCKET_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
