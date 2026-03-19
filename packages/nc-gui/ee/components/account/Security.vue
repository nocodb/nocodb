<script setup lang="ts">
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
const disableCode = ref('')
const disableError = ref('')
const disableCodeInput = ref<HTMLInputElement>()

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
  if (!disableCode.value) return

  isLoading.value = true
  disableError.value = ''

  try {
    await api.instance.post('/api/v2/auth/mfa/disable', {
      code: disableCode.value,
    })
    mfaEnabled.value = false
    showDisableModal.value = false
    disableCode.value = ''
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

function copyBackupCodes(codes: string[]) {
  copy(codes.join('\n'))
  message.success(t('msg.success.copiedToClipboard'))
}

function copySecret() {
  if (setupData.value?.secret) {
    copy(setupData.value.secret)
    message.success(t('msg.success.copiedToClipboard'))
  }
}

function goToVerifyStep() {
  setupStep.value = 'verify'
  nextTick(() => setupCodeInput.value?.focus())
}

watch(showDisableModal, (v) => {
  if (v) {
    disableCode.value = ''
    disableError.value = ''
    nextTick(() => disableCodeInput.value?.focus())
  }
})

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
  <div class="flex flex-col p-6 max-w-[800px]">
    <div class="text-xl font-semibold mb-6">
      {{ $t('labels.security') }}
    </div>

    <!-- 2FA Status Section -->
    <div class="flex flex-col gap-4 p-6 border-1 border-nc-border-gray-medium rounded-lg">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-col gap-1 min-w-0 flex-1">
          <div class="text-base font-semibold">{{ $t('labels.twoFactorAuth') }}</div>
          <div class="text-sm text-nc-content-gray-subtle">
            {{ $t('labels.twoFactorAuthDescription') }}
          </div>
        </div>

        <div class="flex items-center gap-3 flex-shrink-0">
          <NcBadge v-if="mfaEnabled" class="!bg-nc-bg-green !text-nc-content-green">
            {{ $t('general.enabled') }}
          </NcBadge>
          <NcBadge v-else class="!bg-nc-bg-gray-light !text-nc-content-gray-subtle">
            {{ $t('general.disabled') }}
          </NcBadge>

          <NcButton
            v-if="!mfaEnabled"
            v-e="['c:account:security:enable-2fa']"
            type="primary"
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
            @click="showDisableModal = true"
          >
            {{ $t('labels.disableTwoFactor') }}
          </NcButton>
        </div>
      </div>

      <template v-if="mfaEnabled">
        <NcDivider />
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-col gap-1 min-w-0 flex-1">
            <div class="text-sm font-medium">{{ $t('labels.backupCodes') }}</div>
            <div class="text-xs text-nc-content-gray-subtle">
              {{ $t('labels.backupCodesDescription') }}
            </div>
          </div>
          <NcButton
            v-e="['c:account:security:regenerate-backup-codes']"
            type="text"
            size="small"
            class="flex-shrink-0"
            @click="showRegenerateModal = true"
          >
            {{ $t('labels.regenerateBackupCodes') }}
          </NcButton>
        </div>
      </template>
    </div>

    <!-- Setup Modal -->
    <NcModal
      v-model:visible="showSetupModal"
      size="sm"
      :closable="setupStep !== 'verify' && setupStep !== 'backup'"
      :mask-closable="setupStep !== 'verify' && setupStep !== 'backup'"
      @close="closeSetupModal"
    >
      <template #header>
        <div class="flex items-center justify-between w-full">
          <div class="text-base font-semibold">{{ $t('labels.setupTwoFactor') }}</div>
          <div class="text-xs text-nc-content-gray-subtle mr-2">
            {{ $t('labels.stepOf', { current: setupStepNumber, total: 4 }) }}
          </div>
        </div>
      </template>

      <div class="flex flex-col gap-4 p-4">
        <!-- Step 0: Password confirmation -->
        <template v-if="setupStep === 'password'">
          <p class="text-sm text-nc-content-gray-subtle">
            {{ $t('labels.confirmPasswordToSetup') }}
          </p>
          <div class="flex flex-col gap-3">
            <div>
              <div class="text-sm font-medium mb-1">{{ $t('labels.password') }}</div>
              <a-input-password
                ref="setupPasswordInput"
                v-model:value="setupPassword"
                data-testid="nc-2fa-setup-password"
                size="large"
                :placeholder="$t('msg.info.signUp.enterPassword')"
                @pressEnter="confirmPassword"
              />
            </div>
            <div v-if="setupError" class="text-red-500 text-sm">{{ setupError }}</div>
            <NcButton
              type="primary"
              class="w-full"
              :loading="isLoading"
              :disabled="!setupPassword"
              @click="confirmPassword"
            >
              {{ $t('general.next') }}
            </NcButton>
          </div>
        </template>

        <!-- Step 1: QR Code -->
        <template v-if="setupStep === 'qr' && setupData">
          <p class="text-sm text-nc-content-gray-subtle">
            {{ $t('labels.scanQrCode') }}
          </p>
          <div class="flex justify-center">
            <img :src="setupData.qrUrl" alt="QR Code" class="w-48 h-48" />
          </div>
          <div class="flex items-center justify-center gap-2 text-xs text-nc-content-gray-subtle">
            <span>{{ $t('labels.manualEntryCode') }}:</span>
            <code class="bg-nc-bg-gray-light px-2 py-1 rounded text-xs">{{ setupData.secret }}</code>
            <NcButton type="text" size="xxs" @click="copySecret">
              <GeneralIcon icon="copy" class="h-3.5 w-3.5" />
            </NcButton>
          </div>
          <NcButton type="primary" class="w-full" @click="goToVerifyStep">
            {{ $t('general.next') }}
          </NcButton>
        </template>

        <!-- Step 2: Verify -->
        <template v-if="setupStep === 'verify'">
          <p class="text-sm text-nc-content-gray-subtle">
            {{ $t('labels.enterCodeFromApp') }}
          </p>
          <div class="flex flex-col gap-3">
            <div>
              <div class="text-sm font-medium mb-1">{{ $t('labels.verificationCode') }}</div>
              <a-input
                ref="setupCodeInput"
                v-model:value="setupCode"
                data-testid="nc-2fa-setup-code"
                size="large"
                :placeholder="$t('placeholder.enterVerificationCode')"
                autocomplete="one-time-code"
                @pressEnter="confirmSetup"
              />
            </div>
            <div v-if="setupError" class="text-red-500 text-sm">{{ setupError }}</div>
            <NcButton
              type="primary"
              class="w-full"
              :loading="isLoading"
              :disabled="!setupCode"
              @click="confirmSetup"
            >
              {{ $t('general.verify') }}
            </NcButton>
          </div>
        </template>

        <!-- Step 3: Backup Codes -->
        <template v-if="setupStep === 'backup' && setupData">
          <p class="text-sm text-nc-content-gray-subtle">
            {{ $t('labels.saveBackupCodes') }}
          </p>
          <div class="bg-nc-bg-gray-light rounded-lg p-4">
            <div class="grid grid-cols-2 gap-2">
              <code v-for="code in setupData.backupCodes" :key="code" class="text-sm text-center py-1">
                {{ code }}
              </code>
            </div>
          </div>
          <div class="flex gap-2">
            <NcButton
              v-e="['c:account:security:copy-backup-codes']"
              type="secondary"
              class="flex-1"
              @click="copyBackupCodes(setupData.backupCodes)"
            >
              <div class="flex items-center gap-1.5">
                <GeneralIcon icon="copy" class="h-4 w-4" />
                {{ $t('labels.copyAll') }}
              </div>
            </NcButton>
            <NcButton type="primary" class="flex-1" @click="closeSetupModal">
              {{ $t('labels.iHaveSavedTheseCodes') }}
            </NcButton>
          </div>
          <p class="text-xs text-nc-content-gray-subtle">
            {{ $t('labels.backupCodesWarning') }}
          </p>
        </template>
      </div>
    </NcModal>

    <!-- Disable Modal -->
    <NcModal v-model:visible="showDisableModal" size="xs">
      <template #header>
        <div class="text-base font-semibold">{{ $t('labels.disableTwoFactor') }}</div>
      </template>

      <div class="flex flex-col gap-4 p-4">
        <p class="text-sm text-nc-content-gray-subtle">
          {{ $t('labels.enterCodeToDisable') }}
        </p>
        <div class="flex flex-col gap-3">
          <div>
            <div class="text-sm font-medium mb-1">{{ $t('labels.verificationCode') }}</div>
            <a-input
              ref="disableCodeInput"
              v-model:value="disableCode"
              data-testid="nc-2fa-disable-code"
              size="large"
              :placeholder="$t('placeholder.enterVerificationCode')"
              autocomplete="one-time-code"
              @pressEnter="confirmDisable"
            />
          </div>
          <div v-if="disableError" class="text-red-500 text-sm">{{ disableError }}</div>
          <div class="flex gap-2">
            <NcButton type="secondary" class="flex-1" @click="showDisableModal = false">
              {{ $t('general.cancel') }}
            </NcButton>
            <NcButton type="danger" class="flex-1" :loading="isLoading" :disabled="!disableCode" @click="confirmDisable">
              {{ $t('labels.disableTwoFactor') }}
            </NcButton>
          </div>
        </div>
      </div>
    </NcModal>

    <!-- Regenerate Backup Codes Modal -->
    <NcModal v-model:visible="showRegenerateModal" size="sm" @close="closeRegenerateModal">
      <template #header>
        <div class="text-base font-semibold">{{ $t('labels.regenerateBackupCodes') }}</div>
      </template>

      <div class="flex flex-col gap-4 p-4">
        <template v-if="newBackupCodes.length === 0">
          <p class="text-sm text-nc-content-gray-subtle">
            {{ $t('labels.enterCodeToRegenerate') }}
          </p>
          <div class="flex flex-col gap-3">
            <div>
              <div class="text-sm font-medium mb-1">{{ $t('labels.verificationCode') }}</div>
              <a-input
                ref="regenerateCodeInput"
                v-model:value="regenerateCode"
                data-testid="nc-2fa-regenerate-code"
                size="large"
                :placeholder="$t('placeholder.enterVerificationCode')"
                autocomplete="one-time-code"
                @pressEnter="confirmRegenerate"
              />
            </div>
            <div v-if="regenerateError" class="text-red-500 text-sm">{{ regenerateError }}</div>
            <NcButton
              type="primary"
              class="w-full"
              :loading="isLoading"
              :disabled="!regenerateCode"
              @click="confirmRegenerate"
            >
              {{ $t('labels.regenerateBackupCodes') }}
            </NcButton>
          </div>
        </template>

        <template v-else>
          <p class="text-sm text-nc-content-gray-subtle">
            {{ $t('labels.saveBackupCodes') }}
          </p>
          <div class="bg-nc-bg-gray-light rounded-lg p-4">
            <div class="grid grid-cols-2 gap-2">
              <code v-for="code in newBackupCodes" :key="code" class="text-sm text-center py-1">
                {{ code }}
              </code>
            </div>
          </div>
          <div class="flex gap-2">
            <NcButton
              v-e="['c:account:security:copy-backup-codes']"
              type="secondary"
              class="flex-1"
              @click="copyBackupCodes(newBackupCodes)"
            >
              <div class="flex items-center gap-1.5">
                <GeneralIcon icon="copy" class="h-4 w-4" />
                {{ $t('labels.copyAll') }}
              </div>
            </NcButton>
            <NcButton type="primary" class="flex-1" @click="closeRegenerateModal">
              {{ $t('labels.iHaveSavedTheseCodes') }}
            </NcButton>
          </div>
          <p class="text-xs text-nc-content-gray-subtle">
            {{ $t('labels.backupCodesWarning') }}
          </p>
        </template>
      </div>
    </NcModal>
  </div>
</template>
