/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_WS_BASE_URL: string
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_DESCRIPTION: string
  readonly VITE_APP_VERSION: string
  readonly VITE_DEV_TOOLS: string
  readonly VITE_ENABLE_LOGGING: string
  readonly VITE_LOG_LEVEL: string
  readonly VITE_WS_RECONNECT_ATTEMPTS: string
  readonly VITE_WS_RECONNECT_INTERVAL: string
  readonly VITE_CHART_UPDATE_INTERVAL: string
  readonly VITE_CHART_MAX_DATA_POINTS: string
  readonly VITE_ENABLE_PERFORMANCE_MONITORING: string
  readonly VITE_BUNDLE_ANALYSIS: string
  readonly VITE_ENABLE_E2E_TESTING: string
  readonly VITE_ENABLE_ANALYTICS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    __APP_VERSION__?: string
    __BUILD_TIME__?: string
  }
}
