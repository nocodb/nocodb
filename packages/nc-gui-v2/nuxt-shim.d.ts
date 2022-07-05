import type { NuxtApp as BaseApp } from '#app/nuxt'
import type { Api } from 'nocodb-sdk'
import type { GlobalState } from '~/lib/types'

declare module '#app/nuxt' {
  interface NuxtApp extends BaseApp {
    $api: Api<any>;
    $tele: {
      emit: (event: string, data: any) => void
    }
    // tele.emit
    $e: (event: string, data: any) => void
    $state: GlobalState
  }
}
