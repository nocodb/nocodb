<script lang="ts" setup>
const { api } = useApi()

const { t } = useI18n()

const { $e } = useNuxtApp()

const { appInfo } = useGlobal()

const settings = ref<{
  invite_only_signup?: boolean
  restrict_workspace_creation?: boolean
  allow_reporting_abuse?: boolean
  abuse_contact_email?: string
}>({
  invite_only_signup: false,
  restrict_workspace_creation: false,
  allow_reporting_abuse: true,
  abuse_contact_email: '',
})

// Cloud reports always go to NocoDB and cloud has no app-settings endpoint.
const isSelfHosted = computed(() => !appInfo.value.isCloud || appInfo.value.isOnPrem)

const savedAbuseContactEmail = ref('')

const abuseContactEmailError = ref('')

const loadSettings = async () => {
  try {
    const response = await api.orgAppSettings.get()
    settings.value = response
    savedAbuseContactEmail.value = response.abuse_contact_email ?? ''
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

type Settings = typeof settings.value

// Send only the changed keys, so an unsaved draft in another field is never posted.
const saveSettings = async (patch: Settings) => {
  try {
    await api.orgAppSettings.set(patch)
    message.success(t('msg.success.settingsSaved'))
    return true
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    return false
  }
}

const onRestrictWorkspaceCreationChange = () => {
  // When restricting workspace creation, also enable invite-only signup
  // because users without workspace access won't be able to use the app
  if (settings.value.restrict_workspace_creation) {
    settings.value.invite_only_signup = true
  }
  saveSettings({
    restrict_workspace_creation: settings.value.restrict_workspace_creation,
    invite_only_signup: settings.value.invite_only_signup,
  })
}

const onAllowReportingAbuseChange = async () => {
  if (await saveSettings({ allow_reporting_abuse: settings.value.allow_reporting_abuse })) {
    appInfo.value.allowReportingAbuse = settings.value.allow_reporting_abuse !== false
  }
}

const saveAbuseContactEmail = async () => {
  const email = (settings.value.abuse_contact_email ?? '').trim()
  settings.value.abuse_contact_email = email
  abuseContactEmailError.value = ''

  if (email === savedAbuseContactEmail.value) return

  if (email && !validateEmail(email)) {
    abuseContactEmailError.value = t('msg.error.invalidEmail')
    return
  }

  if (!(await saveSettings({ abuse_contact_email: email }))) return
  savedAbuseContactEmail.value = email
  $e('c:account:abuse-contact:save', { cleared: !email })
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
              @change="saveSettings({ invite_only_signup: settings.invite_only_signup })"
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

        <template v-if="isSelfHosted">
          <span class="font-bold text-xl" data-rec="true">{{ $t('labels.security') }}</span>
          <div class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-y-4">
            <label class="flex items-center gap-3 cursor-pointer">
              <NcCheckbox
                v-model:checked="settings.allow_reporting_abuse"
                v-e="['c:account:abuse-report:toggle', { enabled: settings.allow_reporting_abuse }]"
                data-testid="nc-allow-reporting-abuse"
                @change="onAllowReportingAbuseChange"
              />
              <span data-rec="true">
                {{ $t('labels.allowReportingAbuse') }}
              </span>
            </label>
            <div class="flex flex-col gap-2">
              <span class="text-sm font-semibold text-nc-content-gray" data-rec="true">
                {{ $t('labels.abuseContactEmail') }}
              </span>
              <a-input
                v-model:value="settings.abuse_contact_email"
                class="nc-input-sm nc-input-shadow !max-w-100"
                type="email"
                placeholder="abuse@example.com"
                :disabled="settings.allow_reporting_abuse === false"
                data-testid="nc-abuse-contact-email"
                @blur="saveAbuseContactEmail"
                @press-enter="saveAbuseContactEmail"
              />
              <span v-if="abuseContactEmailError" class="text-xs text-nc-content-red-dark">{{ abuseContactEmailError }}</span>
              <span v-else class="text-xs text-nc-content-gray-muted">{{ $t('msg.info.abuseReport.contactEmailHint') }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
