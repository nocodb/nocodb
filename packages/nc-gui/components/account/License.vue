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
  <div class="flex flex-col h-full">
    <NcPageHeader>
      <template #icon>
        <div class="flex justify-center items-center h-5 w-5">
          <GeneralIcon icon="ncKey2" class="flex-none text-[20px]" />
        </div>
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('title.license') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="flex-1 overflow-y-auto nc-scrollbar-thin flex flex-col items-center p-6">
      <div class="flex flex-col gap-6 w-150">
        <template v-if="isPostgresRequired">
          <NcAlert visible type="warning" background>
            <template #description>
              {{ $t('msg.info.licenseRequiresPostgres') }}
            </template>
          </NcAlert>
        </template>

        <template v-else>
          <!-- Activate License card -->
          <div class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-5">
            <div class="flex flex-col gap-1">
              <span class="font-bold text-base text-nc-content-gray">{{ $t('title.licenseKey') }}</span>
              <span class="text-sm text-nc-content-gray-subtle2">
                {{ $t('labels.licenseKeyDescription') }}
              </span>
            </div>

            <div
              class="flex items-center gap-3 p-3 rounded-lg border-1"
              :class="
                licenseStatus === 'active'
                  ? 'bg-nc-bg-green-light border-nc-border-green'
                  : licenseStatus === 'expired'
                    ? 'bg-nc-bg-red-light border-nc-border-red'
                    : 'bg-nc-bg-gray-light border-nc-border-gray-medium'
              "
            >
              <GeneralIcon
                :icon="licenseStatus === 'active' ? 'ncCheck' : licenseStatus === 'expired' ? 'ncAlertCircle' : 'ncInfo'"
                class="h-4.5 w-4.5 flex-none"
                :class="
                  licenseStatus === 'active'
                    ? 'text-nc-content-green-dark'
                    : licenseStatus === 'expired'
                      ? 'text-nc-content-red-dark'
                      : 'text-nc-content-gray-subtle'
                "
              />
              <span class="text-sm font-medium">
                {{
                  licenseStatus === 'active'
                    ? $t('title.licenseActive')
                    : licenseStatus === 'expired'
                      ? $t('title.licenseInvalid')
                      : $t('title.licenseNone')
                }}
              </span>
            </div>

            <a-textarea
              v-model:value="key"
              :placeholder="$t('labels.enterLicenseKey')"
              :rows="2"
              class="!rounded-lg"
              data-testid="nc-license-key-input"
            />

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
          </div>

          <!-- Buy / Manage License card -->
          <div class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-4">
            <div class="flex flex-col gap-1">
              <span class="font-bold text-base text-nc-content-gray">
                {{ licenseStatus === 'none' ? $t('labels.buyLicense') : $t('labels.manageLicense') }}
              </span>
              <span class="text-sm text-nc-content-gray-subtle2">
                {{ licenseStatus === 'none' ? $t('labels.noLicenseYet') : $t('labels.manageLicenseOnCloud') }}
              </span>
            </div>

            <div>
              <NcButton
                v-e="['c:account:license:buy']"
                type="secondary"
                size="small"
                data-testid="nc-license-buy-btn"
                @click="onBuyLicense"
              >
                <div class="flex gap-2 items-center">
                  {{ licenseStatus === 'none' ? $t('labels.buyLicense') : $t('labels.manageLicense') }}
                  <GeneralIcon icon="ncExternalLink" />
                </div>
              </NcButton>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
