/// <reference types="vite/client" />
import type { WhisprApi } from '@shared/api'

declare global {
  interface Window {
    api: WhisprApi
  }
}

export {}
