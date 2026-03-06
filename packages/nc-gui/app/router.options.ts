import type { RouterConfig } from 'nuxt/schema'
import { createWebHistory } from 'vue-router'

export default <RouterConfig>{
  history: () => {
    // Read the <base> tag injected by the backend's GuiMiddleware.
    // It encodes the NC_DASHBOARD_URL subpath (e.g. '/dashboard/').
    // In dev mode (no <base> tag), falls back to '/'.
    let base = '/'
    if (typeof document !== 'undefined') {
      const baseTag = document.querySelector('base')
      if (baseTag?.href) {
        base = new URL(baseTag.href).pathname
      }
    }
    return createWebHistory(base)
  },
}
