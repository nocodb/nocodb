<script lang="ts" setup>
import { message } from 'ant-design-vue'

const { api, isLoading } = useApi()

const { t } = useI18n()

const { $e } = useNuxtApp()

const { loadAppInfo } = useGlobal()

let key = ref('')

const loadLicense = async () => {
  try {
    const response = await api.orgLicense.get()
    key.value = response.key!
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
const setLicense = async () => {
  try {
    await api.orgLicense.set({ key: key.value })
    message.success(t('success.licenseKeyUpdated'))
    await loadAppInfo()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  $e('a:account:license')
}

loadLicense()
</script>

<template>
  <div class="h-full overflow-y-auto scrollbar-thin-dull">
    <!--    <div class="text-xl mt-4 mb-8 text-center font-weight-bold">License</div>-->
    <!--    <div class="mx-auto w-150">-->
    <!--      <div>-->
    <!--        <a-textarea v-model:value="key" placeholder="License key" class="!mt-2 !max-w-[600px]"></a-textarea>-->
    <!--      </div>-->
    <!--      <div class="text-center">-->
    <!--        <a-button class="mt-4 !h-[2.2rem] !rounded-md" @click="setLicense" type="primary">Save license key</a-button>-->
    <!--      </div>-->
    <!--    </div>-->
  </div>
</template>
