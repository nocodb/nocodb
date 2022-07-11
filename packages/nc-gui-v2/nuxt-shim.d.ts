import type { RemovableRef } from '@vueuse/core'
import type { Api } from 'nocodb-sdk'
import type { I18n } from 'vue-i18n'
import type { GlobalState } from '~/lib/types'

import type messages from '@intlify/vite-plugin-vue-i18n/messages'

declare module '#app/nuxt' {
  interface NuxtApp {
    $api: Api<any>;
    $tele: {
      emit: (event: string, data: any) => void
    }
    // tele.emit
    $e: (event: string, data?: any) => void
    $state: GlobalState
  }
}

declare module '@vue/runtime-core' {
  interface App {
    i18n: I18n<messages, unknown, unknown, false>['global']
  }
}
