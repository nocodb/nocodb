import type { RemovableRef } from '@vueuse/core'
import type { Api } from 'nocodb-sdk'
import type { VueI18n } from 'vue-i18n'
import type { NuxtApp as BaseApp } from '#app/nuxt'
import type { GlobalState } from '~/lib/types'

declare module '#app/nuxt' {
  interface NuxtApp extends BaseApp {
    $api: Api<any>;
    $tele: {
      emit: (event: string, data: any) => void
    }
    // tele.emit
    $e: (event: string, data?: any) => void
    $state: GlobalState
  }
}

declare module 'vue' {
  interface App {
    i18n: VueI18n
  }
}
