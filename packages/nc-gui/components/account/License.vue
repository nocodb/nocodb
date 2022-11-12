<script lang="ts" setup>
import { useNuxtApp } from '#app'
import { message } from 'ant-design-vue'
import { extractSdkResponseErrorMsg, useApi } from '#imports'

const { api, isLoading } = useApi()

const {$e} = useNuxtApp()

let key = $ref('')

const loadLicense = async () => {
  try {
    const response = await api.orgLicense.get()

    key = response.key
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
const setLicense = async () => {
  try {
    await api.orgLicense.set({ key: key })
    message.success('License key updated')
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  $e('a:account:license')
}

loadLicense()

</script>

<template>
  <div class="h-full overflow-y-scroll scrollbar-thin-dull">
    <div class="text-xl mt-4 mb-8 text-center font-weight-bold">License</div>
    <div>
      <a-textarea v-model:value="key" placeholder="License key" class="!mt-2 !max-w-[600px]"></a-textarea>
    </div>
    <a-button class="mt-4" @click="setLicense" type="primary">Save license key</a-button>
  </div>
</template>

<style scoped></style>
