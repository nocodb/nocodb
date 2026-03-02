<script lang="ts" setup>
const { api, isLoading } = useApi()

const { t } = useI18n()

const { $e, $api } = useNuxtApp()

const { appInfo, loadAppInfo, token } = useGlobal()

const key = ref('')

const isEEActive = computed(() => appInfo.value.ee === true)

const isPostgresRequired = computed(() => appInfo.value.isOnPrem && appInfo.value.isPostgres === false)

const licenseStatus = computed(() => {
  if (!key.value) return 'none'

  return isEEActive.value ? 'active' : 'expired'
})

const buyLicenseUrl = computed(() => {
  const instanceUrl = window.location.origin
  return `${NC_CLOUD_URL}/#/account/self-hosted?instance_url=${encodeURIComponent(instanceUrl)}`
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

const isRefreshing = ref(false)

const refreshLicense = async () => {
  isRefreshing.value = true
  try {
    const baseURL = $api.instance.defaults.baseURL

    const result = await $fetch<{ success: boolean; status?: string }>('/api/v1/license/refresh', {
      baseURL,
      method: 'POST',
      headers: {
        'xc-auth': token.value as string,
      },
    })

    if (result.success) {
      message.success(t('upgrade.licenseRefreshed'))
      await loadAppInfo()
    } else {
      message.error(t('upgrade.licenseRefreshFailed'))
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isRefreshing.value = false
  }
  $e('a:account:license:refresh')
}

const onBuyLicense = () => {
  $e('c:account:license:buy')
  window.open(buyLicenseUrl.value, '_blank')
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
          <NcButton
            v-if="key && isEEActive"
            v-e="['c:account:license:refresh']"
            type="secondary"
            size="small"
            :loading="isRefreshing"
            data-testid="nc-license-refresh-btn"
            @click="refreshLicense"
          >
            {{ $t('upgrade.refreshLicense') }}
          </NcButton>
        </div>

        <NcDivider class="!my-6" />

        <div class="flex flex-col gap-3">
          <div class="text-sm text-nc-content-gray-subtle">
            {{ licenseStatus === 'none' ? $t('labels.noLicenseYet') : $t('labels.manageLicenseOnCloud') }}
          </div>
          <div>
            <NcButton
              v-e="['c:account:license:buy']"
              type="secondary"
              size="small"
              data-testid="nc-license-buy-btn"
              @click="onBuyLicense"
            >
              {{ licenseStatus === 'none' ? $t('labels.buyLicense') : $t('labels.manageLicense') }}
            </NcButton>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
