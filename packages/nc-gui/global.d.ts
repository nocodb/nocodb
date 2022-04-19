import {Api} from "nocodb-sdk"

declare module "vue/types/options" {

  interface ComponentOptions<V extends Vue> {
    $tele: {
      emit: (event: string, data?) => void
    },
    $api: Api<any>
  }
}
