import type { Api as BaseAPI } from 'nocodb-sdk'
import type { createI18nPlugin } from 'src/plugins/i18n'
import type { GlobalState } from './src/lib/types'
import type en from './lang/en.json'

type MessageSchema = typeof en

declare module '#app/nuxt' {
  interface NuxtApp {
    $api: BaseAPI<any>
    /** {@link import('./plugins/tele') Telemetry} */
    $tele: {
      emit: (event: string, data: any) => void
    }
    /** {@link import('./plugins/tele') Telemetry} Emit telemetry event */
    $e: (event: string, data?: any) => void
    $state: GlobalState
  }
}

declare module '@vue/runtime-core' {
  interface App {
    i18n: ReturnType<typeof createI18nPlugin> extends Promise<infer Return> ? Return : never
  }
}
