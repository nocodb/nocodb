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
    <div
      class="nc-content-max-w flex-1 max-h-[calc(100vh_-_100px)] overflow-y-auto nc-scrollbar-thin flex flex-col items-center p-6"
    >
      <div class="flex flex-col gap-6 w-150">
        <span class="font-bold text-xl" data-rec="true">{{ $t('general.general') }}</span>
        <div class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-y-4">
          <label class="flex items-center gap-3 cursor-pointer">
            <NcCheckbox
              v-model:checked="settings.invite_only_signup"
              v-e="['c:account:enable-signup']"
              :disabled="settings.restrict_workspace_creation"
              @change="saveSettings"
            />
            <span data-rec="true" :class="{ 'text-nc-content-gray-muted': settings.restrict_workspace_creation }">
              {{ $t('labels.inviteOnlySignup') }}
            </span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <NcCheckbox
              v-model:checked="settings.restrict_workspace_creation"
              v-e="['c:account:restrict-workspace-creation']"
              @change="onRestrictWorkspaceCreationChange"
            />
            <span data-rec="true">
              {{ $t('labels.restrictWorkspaceCreation') }}
            </span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
