<script lang="ts" setup>
import { useNuxtApp } from '#app'
import { message } from 'ant-design-vue'
import { extractSdkResponseErrorMsg, useApi, useGlobal } from '#imports'

const { api, isLoading } = useApi()

const { $e } = useNuxtApp()

const { loadAppInfo } = useGlobal()

let css = $ref('')
let js = $ref('')

const loadCustomization = async () => {
  try {
    const response = await api.orgCustomization.get()
    css = response.css!
    js = response.js!
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
const setCustomization = async () => {
  try {
    await api.orgCustomization.set({ css: css, js: js })
    message.success('Customization updated')
    await loadAppInfo()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  $e('a:account:customization')
}

loadCustomization()
</script>

<template>
  <div class="h-full overflow-y-scroll scrollbar-thin-dull">
    <div class="text-xl mt-4 mb-8 text-center font-weight-bold">Custom CSS</div>
    <div class="mx-auto w-150">
      <div>
        <a-textarea v-model:value="css" placeholder="selector{attr:value}" class="!mt-2 !max-w-[600px]"></a-textarea>
      </div>
    </div>
    <div class="text-xl mt-4 mb-8 text-center font-weight-bold">Custom JS</div>
    <div class="mx-auto w-150">
      <div>
        <a-textarea v-model:value="js" placeholder="document.querySelector ..." class="!mt-2 !max-w-[600px]"></a-textarea>
      </div>
    </div>
    <div class="text-center"><a-button class="mt-4" @click="setCustomization" type="primary">Save customization</a-button></div>
  </div>
</template>
