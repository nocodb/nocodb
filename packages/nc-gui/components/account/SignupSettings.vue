<script lang="ts" setup>
import { message } from 'ant-design-vue'
import { extractSdkResponseErrorMsg, useApi } from '#imports'

const { api } = useApi()

const { t } = useI18n()

const settings = ref<{ invite_only_signup?: boolean }>({ invite_only_signup: false })

const loadSettings = async () => {
  try {
    const response = await api.orgAppSettings.get()
    settings.value = response
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const saveSettings = async () => {
  try {
    await api.orgAppSettings.set(settings.value)
    message.success(t('msg.success.settingsSaved'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

loadSettings()
</script>

<template>
  <div class="p-7 flex flex-col items-center">
    <h1 class="text-2xl mt-4 mb-5 pl-3.5 font-bold">{{ t('activity.settings') }}</h1>
    <div class="flex items-center gap-2">
      <a-form-item>
        <a-checkbox
          v-model:checked="settings.invite_only_signup"
          v-e="['c:account:enable-signup']"
          class="nc-checkbox nc-invite-only-signup-checkbox !mt-6"
          name="virtual"
          @change="saveSettings"
        />
      </a-form-item>
      <span data-rec="true">
        {{ $t('labels.inviteOnlySignup') }}
      </span>
    </div>
  </div>
</template>

<style scoped>
:deep(.ant-checkbox-wrapper) {
  @apply !flex-row-reverse !flex !justify-start gap-4;
  justify-content: flex-start;
}
</style>
