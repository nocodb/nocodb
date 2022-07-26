import type messages from '@intlify/vite-plugin-vue-i18n/messages'
import type { RemovableRef } from '@vueuse/core'
import type { Api, FormType, GalleryType, GridType, RequestParams } from 'nocodb-sdk'
import type { I18n } from 'vue-i18n'
import type { GlobalState } from './src/lib/types'

declare module '#app/nuxt' {
  interface NuxtApp {
    $api: Api<any>
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

declare module 'nocodb-sdk' {
  interface Api<T> {
    // todo: update swagger to accept correct data type
    gridCreate: (tableId: string, data: GridType & { copy_from_id: string }, params?: RequestParams) => Promise<GridType>
    formCreate: (tableId: string, data: FormType, params?: RequestParams) => Promise<FormType>
    galleryCreate: (tableId: string, data: GalleryType, params?: RequestParams) => Promise<any>
  }
}
