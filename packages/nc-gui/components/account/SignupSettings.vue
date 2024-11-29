<script lang="ts" setup>
import { message } from 'ant-design-vue'

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
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="settings" class="flex-none text-[20px] text-gray-700 h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('activity.settings') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="nc-content-max-w p-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
      <div class="flex flex-col items-center">
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
    </div>
  </div>
</template>

<style scoped>
:deep(.ant-checkbox-wrapper) {
  @apply !flex-row-reverse !flex !justify-start gap-4;
  justify-content: flex-start;
}
</style>
