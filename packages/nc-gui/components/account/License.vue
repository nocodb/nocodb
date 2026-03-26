<script lang="ts" setup>
const { api, isLoading } = useApi()

const { t } = useI18n()

const { $e } = useNuxtApp()

const { appInfo, loadAppInfo } = useGlobal()

const key = ref('')

const isEEActive = computed(() => appInfo.value.ee === true)

const isPostgresRequired = computed(() => appInfo.value.isOnPrem && appInfo.value.isPostgres === false)

const licenseStatus = computed(() => {
  if (!key.value) return 'none'

  return isEEActive.value ? 'active' : 'expired'
})

const loadLicense = async () => {
  try {
    const response = await api.orgLicense.get()
    key.value = response.key ?? ''
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const setLicense = async () => {
  try {
    await api.orgLicense.set({ key: key.value })
    message.success(t('msg.success.licenseKeyUpdated'))
    await loadAppInfo()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  $e('a:account:license')
}

const removeLicense = async () => {
  try {
    await api.orgLicense.set({ key: '' })
    key.value = ''
    message.success(t('title.licenseKeyRemoved'))
    await loadAppInfo()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  $e('a:account:license:remove')
}

loadLicense()
</script>

<template>
  <div class="h-full overflow-y-auto nc-scrollbar-thin">
    <div class="max-w-[600px] mx-auto mt-8 px-4">
      <div class="text-xl font-semibold mb-6">{{ $t('title.license') }}</div>

      <template v-if="isPostgresRequired">
        <NcAlert visible type="warning" background>
          <template #description>
            {{ $t('msg.info.licenseRequiresPostgres') }}
          </template>
        </NcAlert>
      </template>

      <template v-else>
        <NcAlert
          visible
          :type="licenseStatus === 'active' ? 'success' : licenseStatus === 'expired' ? 'warning' : 'info'"
          background
          class="mb-6"
        >
          <template #description>
            {{
              licenseStatus === 'active'
                ? $t('title.licenseActive')
                : licenseStatus === 'expired'
                ? $t('title.licenseInvalid')
                : $t('title.licenseNone')
            }}
          </template>
        </NcAlert>

        <div class="flex flex-col gap-2 mb-4">
          <label class="text-sm font-medium text-nc-content-gray-subtle">{{ $t('title.licenseKey') }}</label>
          <a-textarea
            v-model:value="key"
            :placeholder="$t('labels.enterLicenseKey')"
            :rows="4"
            class="!rounded-lg"
            data-testid="nc-license-key-input"
          />
        </div>

        <div class="flex gap-3">
          <NcButton type="primary" size="small" :loading="isLoading" data-testid="nc-license-save-btn" @click="setLicense">
            {{ $t('general.save') }}
          </NcButton>
          <NcButton v-if="key" type="secondary" size="small" data-testid="nc-license-remove-btn" @click="removeLicense">
            {{ $t('general.remove') }}
          </NcButton>
        </div>
      </template>
    </div>
  </div>
</template>
