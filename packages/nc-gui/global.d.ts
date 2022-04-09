import {Api} from "nocodb-sdk"
import {Context} from "@nuxt/types";

declare module "vue/types/options" {

  interface ComponentOptions<V extends Vue> {
    $tele: {
      emit: (event: string, data?) => void
    },
    $api: Api<any>,
    $nuxt:Context
  }
}
