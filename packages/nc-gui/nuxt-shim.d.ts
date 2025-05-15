import type { Api as BaseAPI } from 'nocodb-sdk'
import type { UseGlobalReturn } from './composables/useGlobal/types'
import type { NocoI18n } from './lib'
import type { TabType } from './composables'

declare module '#app' {
  interface NuxtApp {
    $api: BaseAPI<any>
    /** {@link import('./plugins/tele') Telemetry} */
    $tele: {
      emit: (event: string, data: any) => void
    }
    /** {@link import('./plugins/tele') Telemetry} Emit telemetry event */
    $e: (event: string, data?: any) => void
    /** {@link import('./plugins/report') Error reporting} Error reporting */
    $report: (event: Error) => void
    $state: UseGlobalReturn
    $poller: {
      subscribe(
        topic: { id: string },
        cb: (data: {
          id: string
          status?: string
          data?: {
            error?: {
              message: string
            }
            message?: string
            result?: any
          }
        }) => void,
        _mid = 0,
      ): Promise<void>
      unsubscribe(topic: { id: string }): Promise<void>
    }
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
    baseId: string
    baseType: 'base' | 'nc' | string
    type: TabType
    title: string
    viewId: string
    viewTitle: string
    sourceId: string
    token: string
  }
}
