<script lang="ts" setup>
import { encodeOnPremCheckoutState } from '~/lib/onPremCheckoutState'

const { api, isLoading } = useApi()

const { t } = useI18n()

const { $e, $api } = useNuxtApp()

const { appInfo, loadAppInfo, token } = useGlobal()

const key = ref('')

const savedKey = ref('')

const isEEActive = computed(() => appInfo.value.ee === true)

const isPostgresRequired = computed(() => appInfo.value.isOnPrem && appInfo.value.isPostgres === false)

const isLicenseKeySetByEnv = computed(() => !!appInfo.value.isLicenseKeySetByEnv)

const licenseStatus = computed(() => {
  // When key is managed via env var, DB may be empty — derive from appInfo directly
  if (isLicenseKeySetByEnv.value) {
    return isEEActive.value ? 'active' : 'expired'
  }

  if (!savedKey.value) return 'none'

  return isEEActive.value ? 'active' : 'expired'
})

const buildBuyLicenseUrl = (seatCount?: number, instanceId?: string) => {
  // Prefer the backend-computed site URL — it's derived from the actual
  // request headers (incl. X-Forwarded-Host) and is more reliable behind
  // proxies than window.location.origin.
  const instanceUrl = appInfo.value.ncSiteUrl || window.location.origin
  const licenseServerUrl = appInfo.value.licenseServerUrl || NC_CLOUD_URL
  const state = encodeOnPremCheckoutState({
    v: 1,
    instance_url: instanceUrl,
    ...(seatCount && seatCount > 0 ? { seat_count: seatCount } : {}),
    ...(instanceId ? { instance_id: instanceId } : {}),
  })
  return `${licenseServerUrl}/account/self-hosted?state=${state}`
}

const loadLicense = async () => {
  try {
    const response = await api.orgLicense.get()
    key.value = response.key ?? ''
    savedKey.value = key.value
  } catch (e: any) {
    message.toast(await extractSdkResponseErrorMsg(e))
  }
}

const setLicense = async () => {
  try {
    await api.orgLicense.set({ key: key.value })
    savedKey.value = key.value
    message.toast(t('msg.success.licenseKeyUpdated'))
    await loadAppInfo()
  } catch (e: any) {
    message.toast(await extractSdkResponseErrorMsg(e))
  }
  $e('a:account:license')
}

const { showWarningModal } = useNcConfirmModal()

const removeLicense = () => {
  showWarningModal({
    title: t('labels.removeLicense'),
    content: t('labels.removeLicenseConfirm'),
    showCancelBtn: true,
    okText: t('general.remove'),
    okProps: { type: 'danger' },
    okCallback: async () => {
      try {
        await api.orgLicense.set({ key: '' })
        key.value = ''
        savedKey.value = ''
        message.toast(t('title.licenseKeyRemoved'))
        await loadAppInfo()
      } catch (e: any) {
        message.toast(await extractSdkResponseErrorMsg(e))
      }
      $e('a:account:license:remove')
    },
  })
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
      message.toast(t('upgrade.licenseRefreshed'))
      await loadAppInfo()
    } else {
      message.toast(t('upgrade.licenseRefreshFailed'))
    }
  } catch (e: any) {
    message.toast(await extractSdkResponseErrorMsg(e))
  } finally {
    isRefreshing.value = false
  }
  $e('a:account:license:refresh')
}

const isCopied = ref(false)

const copyLicenseKey = async () => {
  try {
    await navigator.clipboard.writeText(key.value)
    isCopied.value = true
    message.toast(t('general.copied'))
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch {
    message.toast(t('msg.error.copyToClipboardError'))
  }
}

const onBuyLicense = async () => {
  $e('c:account:license:buy')

  // Manage license: skip state and go straight to the cloud self-hosted page.
  if (licenseStatus.value !== 'none') {
    const licenseServerUrl = appInfo.value.licenseServerUrl || NC_CLOUD_URL
    window.open(`${licenseServerUrl}/account/self-hosted`, '_blank')
    return
  }

  // Best-effort: fetch the seat-consuming user count (editor+, matching how
  // billing reseats) and a stable instance_id so the cloud checkout can
  // pre-fill seats and bind the resulting license to this instance.
  let seatCount: number | undefined
  let instanceId: string | undefined
  try {
    const baseURL = $api.instance.defaults.baseURL
    const status = await $fetch<{ seatCount?: number; instanceId?: string }>('/api/v1/license/status', {
      baseURL,
      method: 'GET',
      headers: { 'xc-auth': token.value as string },
    })
    if (typeof status?.seatCount === 'number' && status.seatCount > 0) {
      seatCount = status.seatCount
    }
    if (typeof status?.instanceId === 'string' && status.instanceId) {
      instanceId = status.instanceId
    }
  } catch {
    // Ignore — fall back to the URL without instance hints.
  }

  window.open(buildBuyLicenseUrl(seatCount, instanceId), '_blank')
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
                <a
                  href="https://nocodb.com/docs/product-docs/cloud-enterprise-edition/community-vs-paid-editions"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="!text-nc-content-brand !no-underline hover:underline"
                  >{{ $t('msg.learnMore') }}</a
                >
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
                <template v-if="licenseStatus === 'active'">
                  {{
                    appInfo.onPremPlanTitle
                      ? $t('title.licenseActiveWithPlan', { plan: appInfo.onPremPlanTitle })
                      : $t('title.licenseActive')
                  }}
                </template>
                <template v-else-if="licenseStatus === 'expired'">
                  {{ $t('title.licenseInvalid') }}
                </template>
                <template v-else>
                  {{ $t('title.licenseNone') }}
                </template>
              </span>
            </div>

            <template v-if="isLicenseKeySetByEnv">
              <NcAlert visible type="warning" background>
                <template #description>
                  {{ $t('labels.licenseKeySetByEnv') }}
                  <a
                    href="https://nocodb.com/docs/self-hosting/license-activation"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="!text-nc-content-brand !no-underline hover:underline"
                    >{{ $t('msg.learnMore') }}</a
                  >
                </template>
              </NcAlert>
            </template>

            <template v-else>
              <a-input
                v-model:value="key"
                :placeholder="$t('labels.enterLicenseKey')"
                class="!rounded-lg nc-license-key-input"
                spellcheck="false"
                size="large"
                data-testid="nc-license-key-input"
              >
                <template v-if="key" #suffix>
                  <NcTooltip :title="$t('general.copy')">
                    <NcButton type="text" size="xs" @click="copyLicenseKey">
                      <GeneralIcon :icon="isCopied ? 'ncCheck' : 'ncCopy'" class="h-4 w-4" />
                    </NcButton>
                  </NcTooltip>
                </template>
              </a-input>

              <div class="flex gap-3">
                <NcButton
                  type="primary"
                  size="small"
                  :disabled="!key?.trim() || key.trim() === savedKey.trim()"
                  :loading="isLoading"
                  data-testid="nc-license-save-btn"
                  @click="setLicense"
                >
                  {{ $t('general.save') }}
                </NcButton>
                <NcTooltip v-if="savedKey" :title="$t('labels.removeLicenseTooltip')">
                  <NcButton type="secondary" size="small" data-testid="nc-license-remove-btn" @click="removeLicense">
                    {{ $t('labels.removeLicense') }}
                  </NcButton>
                </NcTooltip>
                <NcTooltip v-if="savedKey && isEEActive" :title="$t('labels.refreshLicenseTooltip')">
                  <NcButton
                    v-e="['c:account:license:refresh']"
                    type="secondary"
                    size="small"
                    :loading="isRefreshing"
                    data-testid="nc-license-refresh-btn"
                    @click="refreshLicense"
                  >
                    {{ $t('upgrade.refreshLicense') }}
                  </NcButton>
                </NcTooltip>
              </div>
            </template>
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

<style lang="scss">
.nc-license-key-input,
.nc-license-key-input .ant-input {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace !important;
  font-size: 14px !important;
}
</style>
