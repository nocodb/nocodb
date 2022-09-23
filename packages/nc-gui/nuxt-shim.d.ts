import type { Api as BaseAPI } from 'nocodb-sdk'
import type { UseGlobalReturn } from './composables/useGlobal/types'
import type { NocoI18n } from './lib'
import type { TabType } from './composables'

declare module '#app/nuxt' {
  interface NuxtApp {
    $api: BaseAPI<any>
    /** {@link import('./plugins/tele') Telemetry} */
    $tele: {
      emit: (event: string, data: any) => void
    }
    /** {@link import('./plugins/tele') Telemetry} Emit telemetry event */
    $e: (event: string, data?: any) => void
    $state: UseGlobalReturn
  }
}

declare module '@vue/runtime-core' {
  interface App {
    i18n: NocoI18n
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    public?: boolean
    hideHeader?: boolean
    title?: string
    allowedRoles?: Role[]
  }

  interface RouteParams {
    projectId: string
    projectType: 'base' | 'nc' | string
    type: TabType
    title: string
    viewId: string
    viewTitle: string
    baseId: string
    token: string
  }
}
