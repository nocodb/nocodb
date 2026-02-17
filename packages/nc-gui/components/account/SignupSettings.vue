<script lang="ts" setup>
const { api } = useApi()

const { t } = useI18n()

const settings = ref<{ invite_only_signup?: boolean; restrict_workspace_creation?: boolean }>({
  invite_only_signup: false,
  restrict_workspace_creation: false,
})

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

const onRestrictWorkspaceCreationChange = () => {
  // When restricting workspace creation, also enable invite-only signup
  // because users without workspace access won't be able to use the app
  if (settings.value.restrict_workspace_creation) {
    settings.value.invite_only_signup = true
  }
  saveSettings()
}

loadSettings()
</script>

<template>
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="settings" class="flex-none text-[20px] h-5 w-5" />
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
              :disabled="settings.restrict_workspace_creation"
              @change="saveSettings"
            />
          </a-form-item>
          <span data-rec="true" :class="{ 'text-gray-400': settings.restrict_workspace_creation }">
            {{ $t('labels.inviteOnlySignup') }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <a-form-item>
            <a-checkbox
              v-model:checked="settings.restrict_workspace_creation"
              v-e="['c:account:restrict-workspace-creation']"
              class="nc-checkbox nc-restrict-workspace-creation-checkbox !mt-6"
              name="virtual"
              @change="onRestrictWorkspaceCreationChange"
            />
          </a-form-item>
          <span data-rec="true">
            {{ $t('labels.restrictWorkspaceCreation') }}
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
