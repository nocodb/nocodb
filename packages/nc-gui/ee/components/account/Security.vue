<script setup lang="ts">
import { PlanFeatureTypes } from 'nocodb-sdk'

const { api } = useApi()

const { t } = useI18n()

const { $e } = useNuxtApp()

const { blockMfa, showUpgradeToUseMfa } = useEeConfig()

const { copy } = useCopy()

const mfaEnabled = ref(false)
const isLoading = ref(false)

// Setup wizard state
const showSetupModal = ref(false)
const setupData = ref<{ secret: string; qrUrl: string; backupCodes: string[] } | null>(null)
const setupCode = ref('')
const setupError = ref('')
const setupPassword = ref('')
const setupStep = ref<'password' | 'qr' | 'verify' | 'backup'>('password')
const setupCodeInput = ref<HTMLInputElement>()
const setupPasswordInput = ref<HTMLInputElement>()

// Disable state
const showDisableModal = ref(false)
const disablePassword = ref('')
const disableError = ref('')
const disablePasswordInput = ref<HTMLInputElement>()

// Backup codes state
const showRegenerateModal = ref(false)
const regenerateCode = ref('')
const regenerateError = ref('')
const newBackupCodes = ref<string[]>([])
const regenerateCodeInput = ref<HTMLInputElement>()

const setupStepNumber = computed(() => {
  const steps = { password: 1, qr: 2, verify: 3, backup: 4 }
  return steps[setupStep.value]
})

async function fetchStatus() {
  try {
    const response = await api.instance.get('/api/v2/auth/mfa/status')
    mfaEnabled.value = response.data.enabled
  } catch {
    // ignore
  }
}

function startSetup() {
  if (blockMfa.value) {
    showUpgradeToUseMfa()
    return
  }

  $e('c:account:security:enable-2fa')
  setupStep.value = 'password'
  setupPassword.value = ''
  setupError.value = ''
  showSetupModal.value = true
  nextTick(() => setupPasswordInput.value?.focus())
}

async function confirmPassword() {
  if (!setupPassword.value) return

  isLoading.value = true
  setupError.value = ''

  try {
    const response = await api.instance.post('/api/v2/auth/mfa/setup', {
      password: setupPassword.value,
    })
    setupData.value = response.data
    setupStep.value = 'qr'
  } catch (e: any) {
    setupError.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isLoading.value = false
  }
}

async function confirmSetup() {
  if (!setupCode.value) return

  isLoading.value = true
  setupError.value = ''

  try {
    await api.instance.post('/api/v2/auth/mfa/verify-setup', {
      code: setupCode.value,
    })
    setupStep.value = 'backup'
    mfaEnabled.value = true
    $e('a:account:security:2fa-enabled')
    message.success(t('msg.success.twoFactorEnabled'))
  } catch (e: any) {
    setupError.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isLoading.value = false
  }
}

function closeSetupModal() {
  showSetupModal.value = false
  setupData.value = null
  setupCode.value = ''
  setupPassword.value = ''
  setupError.value = ''
  setupStep.value = 'password'
  isLoading.value = false
}

async function confirmDisable() {
  if (!disablePassword.value) return

  isLoading.value = true
  disableError.value = ''

  try {
    await api.instance.post('/api/v2/auth/mfa/disable', {
      password: disablePassword.value,
    })
    mfaEnabled.value = false
    showDisableModal.value = false
    disablePassword.value = ''
    $e('a:account:security:2fa-disabled')
    message.success(t('msg.success.twoFactorDisabled'))
  } catch (e: any) {
    disableError.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isLoading.value = false
  }
}

async function confirmRegenerate() {
  if (!regenerateCode.value) return

  isLoading.value = true
  regenerateError.value = ''

  try {
    const response = await api.instance.post('/api/v2/auth/mfa/regenerate-backup-codes', {
      code: regenerateCode.value,
    })
    newBackupCodes.value = response.data.backupCodes
    regenerateCode.value = ''
    $e('a:account:security:backup-codes-regenerated')
    message.success(t('msg.success.backupCodesRegenerated'))
  } catch (e: any) {
    regenerateError.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isLoading.value = false
  }
}

function closeRegenerateModal() {
  showRegenerateModal.value = false
  regenerateCode.value = ''
  regenerateError.value = ''
  newBackupCodes.value = []
  isLoading.value = false
}

const recentlyCopied = ref(false)
let copiedTimeout: ReturnType<typeof setTimeout>

function showCopiedFeedback() {
  recentlyCopied.value = true
  clearTimeout(copiedTimeout)
  copiedTimeout = setTimeout(() => {
    recentlyCopied.value = false
  }, 2000)
}

function copyBackupCodes(codes: string[]) {
  copy(codes.join('\n'))
  showCopiedFeedback()
}

function copySecret() {
  if (setupData.value?.secret) {
    copy(setupData.value.secret)
    showCopiedFeedback()
  }
}

function goToVerifyStep() {
  setupStep.value = 'verify'
  nextTick(() => setupCodeInput.value?.focus())
}

watch(showRegenerateModal, (v) => {
  if (v) {
    regenerateCode.value = ''
    regenerateError.value = ''
    newBackupCodes.value = []
    nextTick(() => regenerateCodeInput.value?.focus())
  }
})

onMounted(() => {
  fetchStatus()
})
</script>

<template>
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon class="flex-none !h-5 !w-5" icon="ncShield" />
      </template>
      <template #title>
        {{ $t('labels.security') }}
      </template>
    </NcPageHeader>
    <div class="h-[calc(100vh_-_100px)] overflow-auto nc-scrollbar-thin">
      <div class="h-full nc-content-max-w p-6">
        <div class="flex flex-col w-150 mx-auto">
          <!-- 2FA Section -->
          <div class="nc-settings-item-card-wrapper mt-5">
            <div class="nc-settings-item-heading text-nc-content-gray-emphasis">
              {{ $t('labels.twoFactorAuth') }}
            </div>

            <div class="nc-settings-item-card p-6">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <div class="text-sm font-semibold text-nc-content-gray">{{ $t('labels.twoFactorAuth') }}</div>
                    <NcBadge v-if="mfaEnabled" class="!bg-green-100 !text-green-600 !border-green-200 flex items-center gap-1">
                      <GeneralIcon icon="circleCheck" class="h-4 w-4" />
                      {{ $t('general.enabled') }}
                    </NcBadge>
                    <div
                      v-else
                      class="text-nc-content-gray-muted text-xs font-medium bg-nc-bg-gray-light px-2 py-0.5 rounded-full"
                    >
                      {{ $t('general.disabled') }}
                    </div>
                    <PaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_MFA" />
                  </div>
                  <div class="text-small text-nc-content-gray-subtle leading-5">
                    {{ $t('labels.twoFactorAuthDescription') }}
                  </div>
                </div>

                <div class="flex-shrink-0">
                  <NcButton
                    v-if="!mfaEnabled"
                    v-e="['c:account:security:enable-2fa']"
                    :type="blockMfa ? 'secondary' : 'primary'"
                    size="small"
                    :loading="isLoading"
                    @click="startSetup"
                  >
                    {{ $t('labels.enableTwoFactor') }}
                  </NcButton>
                  <NcButton
                    v-else
                    v-e="['c:account:security:disable-2fa']"
                    type="secondary"
                    size="small"
                    class="!text-nc-content-red-dark"
                    @click="showDisableModal = true"
                  >
                    {{ $t('labels.disableTwoFactor') }}
                  </NcButton>
                </div>
              </div>

              <template v-if="mfaEnabled">
                <NcDivider class="!my-4" />
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex flex-col gap-1 min-w-0 flex-1">
                    <div class="text-sm font-medium text-nc-content-gray">{{ $t('labels.backupCodes') }}</div>
                    <div class="text-small text-nc-content-gray-subtle">
                      {{ $t('labels.backupCodesDescription') }}
                    </div>
                  </div>
                  <NcButton
                    v-e="['c:account:security:regenerate-backup-codes']"
                    type="secondary"
                    size="small"
                    class="flex-shrink-0"
                    @click="showRegenerateModal = true"
                  >
                    {{ $t('labels.regenerateBackupCodes') }}
                  </NcButton>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Setup Modal -->
    <GeneralModal
      v-model:visible="showSetupModal"
      size="small"
      centered
      :closable="setupStep !== 'verify' && setupStep !== 'backup'"
      :mask-closable="setupStep !== 'verify' && setupStep !== 'backup'"
    >
      <div class="flex flex-col gap-2 p-4 md:!p-6">
        <div class="text-lg font-semibold mb-3">{{ $t('labels.setupTwoFactor') }}</div>

        <!-- Step 0: Password confirmation -->
        <template v-if="setupStep === 'password'">
          <span class="text-sm text-nc-content-gray-subtle">
            {{ $t('labels.confirmPasswordToSetup') }}
          </span>

          <div class="flex flex-col gap-2 mt-2">
            <span class="text-sm">{{ $t('labels.password') }}</span>
            <a-input-password
              ref="setupPasswordInput"
              v-model:value="setupPassword"
              data-testid="nc-2fa-setup-password"
              class="w-full nc-input-sm nc-input-shadow"
              :placeholder="$t('msg.info.signUp.enterPassword')"
              @pressEnter="confirmPassword"
            />
          </div>

          <div v-if="setupError" class="text-red-500 text-sm">{{ setupError }}</div>

          <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
            <NcButton type="secondary" size="small" @click="closeSetupModal">
              {{ $t('general.cancel') }}
            </NcButton>
            <NcButton type="primary" size="small" :loading="isLoading" :disabled="!setupPassword" @click="confirmPassword">
              {{ $t('general.next') }}
            </NcButton>
          </div>
        </template>

        <!-- Step 1: QR Code -->
        <template v-if="setupStep === 'qr' && setupData">
          <span class="text-sm text-nc-content-gray-subtle">
            {{ $t('labels.scanQrCodeDescription') }}
          </span>

          <div class="flex flex-col items-center gap-3 py-3">
            <img :src="setupData.qrUrl" alt="QR Code" class="w-60 h-60" />
            <div class="bg-nc-bg-gray-light rounded-lg px-3 py-2 flex items-center justify-center gap-2">
              <code class="text-xs break-all text-nc-content-gray select-all">{{ setupData.secret }}</code>
              <NcTooltip :visible="recentlyCopied ? true : undefined">
                <template #title>{{ recentlyCopied ? $t('general.copied') : $t('general.copy') }}</template>
                <NcButton type="text" size="xxs" class="flex-shrink-0" @click="copySecret">
                  <GeneralIcon :icon="recentlyCopied ? 'check' : 'copy'" class="h-3.5 w-3.5" />
                </NcButton>
              </NcTooltip>
            </div>
            <span class="text-xs text-nc-content-gray-muted text-center">{{ $t('labels.manualEntryHint') }}</span>
          </div>

          <div class="flex flex-row gap-x-2 pt-2 justify-end">
            <NcButton type="primary" size="small" @click="goToVerifyStep">
              {{ $t('general.next') }}
            </NcButton>
          </div>
        </template>

        <!-- Step 2: Verify -->
        <template v-if="setupStep === 'verify'">
          <span class="text-sm text-nc-content-gray-subtle">
            {{ $t('labels.enterCodeFromApp') }}
          </span>

          <div class="flex flex-col gap-2 mt-2">
            <span class="text-sm">{{ $t('labels.verificationCode') }}</span>
            <a-input
              ref="setupCodeInput"
              v-model:value="setupCode"
              data-testid="nc-2fa-setup-code"
              class="w-full nc-input-sm nc-input-shadow"
              :placeholder="$t('placeholder.enterVerificationCode')"
              autocomplete="one-time-code"
              @pressEnter="confirmSetup"
            />
          </div>

          <div v-if="setupError" class="text-red-500 text-sm">{{ setupError }}</div>

          <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
            <NcButton type="primary" size="small" :loading="isLoading" :disabled="!setupCode" @click="confirmSetup">
              {{ $t('general.verify') }}
            </NcButton>
          </div>
        </template>

        <!-- Step 3: Backup Codes -->
        <template v-if="setupStep === 'backup' && setupData">
          <span class="text-sm text-nc-content-gray-subtle">
            {{ $t('labels.saveBackupCodes') }}
          </span>
          <div class="bg-nc-bg-gray-light rounded-lg p-3 mt-1 relative">
            <NcTooltip class="absolute top-2 right-2" :visible="recentlyCopied ? true : undefined">
              <template #title>{{ recentlyCopied ? $t('general.copied') : $t('general.copy') }}</template>
              <NcButton type="text" size="xxs" @click="copyBackupCodes(setupData.backupCodes)">
                <GeneralIcon :icon="recentlyCopied ? 'check' : 'copy'" class="h-3.5 w-3.5" />
              </NcButton>
            </NcTooltip>
            <div class="grid grid-cols-2 gap-x-2 gap-y-1.5 max-w-[220px] mx-auto">
              <code v-for="code in setupData.backupCodes" :key="code" class="text-sm text-center py-0.5">
                {{ code }}
              </code>
            </div>
          </div>
          <p class="text-xs text-nc-content-gray-subtle">
            {{ $t('labels.backupCodesWarning') }}
          </p>
          <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
            <NcButton
              v-e="['c:account:security:copy-backup-codes']"
              type="secondary"
              size="small"
              @click="copyBackupCodes(setupData.backupCodes)"
            >
              <div class="flex items-center gap-1.5">
                <GeneralIcon :icon="recentlyCopied ? 'check' : 'copy'" class="h-3.5 w-3.5" />
                {{ recentlyCopied ? $t('general.copied') : $t('labels.copyAll') }}
              </div>
            </NcButton>
            <NcButton type="primary" size="small" @click="closeSetupModal">
              {{ $t('labels.iHaveSavedTheseCodes') }}
            </NcButton>
          </div>
        </template>
      </div>
    </GeneralModal>

    <!-- Disable Modal -->
    <GeneralModal
      v-model:visible="showDisableModal"
      size="small"
      centered
      @after-enter="disablePasswordInput?.focus()"
      @after-leave="
        () => {
          disablePassword = ''
          disableError = ''
        }
      "
    >
      <div class="flex flex-col gap-2 p-4 md:!p-6">
        <div class="text-lg font-semibold mb-3">{{ $t('labels.disableTwoFactor') }}</div>

        <NcAlert type="warning" background>
          <template #description>
            {{ $t('labels.disableTwoFactorWarningPrefix') }}
            <span class="font-semibold">{{ $t('labels.disableTwoFactorWarningBold') }}</span
            >{{ $t('labels.disableTwoFactorWarningSuffix') }}
          </template>
        </NcAlert>

        <div class="mt-2">
          <div class="text-sm font-medium mb-1">{{ $t('msg.enterPassword') }}</div>
          <a-input-password
            ref="disablePasswordInput"
            v-model:value="disablePassword"
            :placeholder="$t('labels.password')"
            size="large"
            class="!rounded-lg"
            @keyup.enter="confirmDisable"
          />
          <div v-if="disableError" class="text-red-500 text-sm mt-1">{{ disableError }}</div>
        </div>

        <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
          <NcButton type="secondary" size="small" @click="showDisableModal = false">
            {{ $t('general.cancel') }}
          </NcButton>
          <NcButton type="danger" size="small" :loading="isLoading" :disabled="!disablePassword" @click="confirmDisable">
            {{ $t('labels.disableTwoFactor') }}
          </NcButton>
        </div>
      </div>
    </GeneralModal>

    <!-- Regenerate Backup Codes Modal -->
    <GeneralModal
      v-model:visible="showRegenerateModal"
      size="small"
      centered
      :mask-closable="newBackupCodes.length === 0"
      :closable="newBackupCodes.length === 0"
    >
      <div class="flex flex-col gap-2 p-4 md:!p-6">
        <div class="text-lg font-semibold mb-3">{{ $t('labels.regenerateBackupCodes') }}</div>

        <template v-if="newBackupCodes.length === 0">
          <span class="text-sm text-nc-content-gray-subtle">
            {{ $t('labels.enterCodeToRegenerate') }}
          </span>

          <div class="flex flex-col gap-2 mt-2">
            <span class="text-sm">{{ $t('labels.verificationCode') }}</span>
            <a-input
              ref="regenerateCodeInput"
              v-model:value="regenerateCode"
              data-testid="nc-2fa-regenerate-code"
              class="w-full nc-input-sm nc-input-shadow"
              :placeholder="$t('placeholder.enterVerificationCode')"
              autocomplete="one-time-code"
              @pressEnter="confirmRegenerate"
            />
          </div>

          <div v-if="regenerateError" class="text-red-500 text-sm">{{ regenerateError }}</div>

          <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
            <NcButton type="secondary" size="small" @click="closeRegenerateModal">
              {{ $t('general.cancel') }}
            </NcButton>
            <NcButton type="primary" size="small" :loading="isLoading" :disabled="!regenerateCode" @click="confirmRegenerate">
              {{ $t('labels.regenerateBackupCodes') }}
            </NcButton>
          </div>
        </template>

        <template v-else>
          <span class="text-sm text-nc-content-gray-subtle">
            {{ $t('labels.saveBackupCodes') }}
          </span>
          <div class="bg-nc-bg-gray-light rounded-lg p-3 mt-1 relative">
            <NcTooltip class="absolute top-2 right-2" :visible="recentlyCopied ? true : undefined">
              <template #title>{{ recentlyCopied ? $t('general.copied') : $t('general.copy') }}</template>
              <NcButton type="text" size="xxs" @click="copyBackupCodes(newBackupCodes)">
                <GeneralIcon :icon="recentlyCopied ? 'check' : 'copy'" class="h-3.5 w-3.5" />
              </NcButton>
            </NcTooltip>
            <div class="grid grid-cols-2 gap-x-2 gap-y-1.5 max-w-[220px] mx-auto">
              <code v-for="code in newBackupCodes" :key="code" class="text-sm text-center py-0.5">
                {{ code }}
              </code>
            </div>
          </div>
          <p class="text-xs text-nc-content-gray-subtle">
            {{ $t('labels.backupCodesWarning') }}
          </p>
          <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
            <NcButton
              v-e="['c:account:security:copy-backup-codes']"
              type="secondary"
              size="small"
              @click="copyBackupCodes(newBackupCodes)"
            >
              <div class="flex items-center gap-1.5">
                <GeneralIcon :icon="recentlyCopied ? 'check' : 'copy'" class="h-3.5 w-3.5" />
                {{ recentlyCopied ? $t('general.copied') : $t('labels.copyAll') }}
              </div>
            </NcButton>
            <NcButton type="primary" size="small" @click="closeRegenerateModal">
              {{ $t('labels.iHaveSavedTheseCodes') }}
            </NcButton>
          </div>
        </template>
      </div>
    </GeneralModal>
  </div>
</template>
