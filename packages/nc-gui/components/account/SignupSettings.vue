<script lang="ts" setup>
import { message } from 'ant-design-vue'
import { extractSdkResponseErrorMsg, useApi } from '#imports'

const { api } = useApi()

let settings = $ref<{ enable_user_signup?: boolean }>({ enable_user_signup: false })

const loadSettings = async () => {
  try {
    const response = await api.orgAppSettings.get()
    settings = response
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const saveSettings = async () => {
  try {
    await api.orgAppSettings.set(settings)
    message.success('Settings ky updated')
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

loadSettings()
</script>

<template>
  <div>
    <div class="text-xl">Settings</div>
    <a-divider class="!my-3" />
    <a-form-item>
      <a-checkbox v-model:checked="settings.enable_user_signup" class="nc-checkbox" name="virtual" @change="saveSettings">
        Enable user signup
      </a-checkbox>
    </a-form-item>
  </div>
</template>

<style scoped>
:deep(.ant-checkbox-wrapper) {
  @apply !flex-row-reverse !flex !justify-start gap-4;
  justify-content: start;
}
</style>
