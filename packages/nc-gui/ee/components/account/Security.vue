<script setup lang="ts">
const { api } = useApi()

const { t } = useI18n()

const { blockMfa, showUpgradeToUseMfa } = useEeConfig()

const mfaEnabled = ref(false)
const isLoading = ref(false)

// Setup wizard state
const showSetupModal = ref(false)
const setupData = ref<{ secret: string; qrUrl: string; backupCodes: string[] } | null>(null)
const setupCode = ref('')
const setupError = ref('')
const setupPassword = ref('')
const setupStep = ref<'password' | 'qr' | 'verify' | 'backup'>('password')

// Disable state
const showDisableModal = ref(false)
const disableCode = ref('')
const disableError = ref('')

// Backup codes state
const showRegenerateModal = ref(false)
const regenerateCode = ref('')
const regenerateError = ref('')
const newBackupCodes = ref<string[]>([])

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

  setupStep.value = 'password'
  setupPassword.value = ''
  setupError.value = ''
  showSetupModal.value = true
}

async function confirmPassword() {
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
  setupError.value = ''

  try {
    await api.instance.post('/api/v2/auth/mfa/verify-setup', {
      code: setupCode.value,
    })
    setupStep.value = 'backup'
    mfaEnabled.value = true
    message.success(t('msg.success.twoFactorEnabled'))
  } catch (e: any) {
    setupError.value = await extractSdkResponseErrorMsg(e)
  }
}

function closeSetupModal() {
  showSetupModal.value = false
  setupData.value = null
  setupCode.value = ''
  setupPassword.value = ''
  setupError.value = ''
  setupStep.value = 'password'
}

async function confirmDisable() {
  disableError.value = ''

  try {
    await api.instance.post('/api/v2/auth/mfa/disable', {
      code: disableCode.value,
    })
    mfaEnabled.value = false
    showDisableModal.value = false
    disableCode.value = ''
    message.success(t('msg.success.twoFactorDisabled'))
  } catch (e: any) {
    disableError.value = await extractSdkResponseErrorMsg(e)
  }
}

async function confirmRegenerate() {
  regenerateError.value = ''

  try {
    const response = await api.instance.post('/api/v2/auth/mfa/regenerate-backup-codes', {
      code: regenerateCode.value,
    })
    newBackupCodes.value = response.data.backupCodes
    regenerateCode.value = ''
    message.success(t('msg.success.backupCodesRegenerated'))
  } catch (e: any) {
    regenerateError.value = await extractSdkResponseErrorMsg(e)
  }
}

function closeRegenerateModal() {
  showRegenerateModal.value = false
  regenerateCode.value = ''
  regenerateError.value = ''
  newBackupCodes.value = []
}

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
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-1">
          <div class="text-base font-semibold">{{ $t('labels.twoFactorAuth') }}</div>
          <div class="text-sm text-nc-content-gray-subtle">
            {{ $t('labels.twoFactorAuthDescription') }}
          </div>
        </div>

        <div class="flex items-center gap-3">
          <NcBadge v-if="mfaEnabled" class="!bg-green-100 !text-green-700">
            {{ $t('general.enabled') }}
          </NcBadge>
          <NcBadge v-else class="!bg-nc-bg-gray-light !text-nc-content-gray-subtle">
            {{ $t('general.disabled') }}
          </NcBadge>

          <NcButton v-if="!mfaEnabled" type="primary" size="small" :loading="isLoading" @click="startSetup">
            {{ $t('labels.enableTwoFactor') }}
          </NcButton>
          <NcButton v-else type="secondary" size="small" @click="showDisableModal = true">
            {{ $t('labels.disableTwoFactor') }}
          </NcButton>
        </div>
      </div>

      <template v-if="mfaEnabled">
        <NcDivider />
        <div class="flex items-center justify-between">
          <div class="flex flex-col gap-1">
            <div class="text-sm font-medium">{{ $t('labels.backupCodes') }}</div>
            <div class="text-xs text-nc-content-gray-subtle">
              {{ $t('labels.backupCodesDescription') }}
            </div>
          </div>
          <NcButton type="text" size="small" @click="showRegenerateModal = true">
            {{ $t('labels.regenerateBackupCodes') }}
          </NcButton>
        </div>
      </template>
    </div>

    <!-- Setup Modal -->
    <NcModal v-model:visible="showSetupModal" size="sm" :closable="setupStep !== 'verify'" @close="closeSetupModal">
      <template #header>
        <div class="text-base font-semibold">{{ $t('labels.setupTwoFactor') }}</div>
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
                v-model:value="setupPassword"
                data-testid="nc-2fa-setup-password"
                size="large"
                :placeholder="$t('msg.info.signUp.enterPassword')"
                @pressEnter="confirmPassword"
              />
            </div>
            <div v-if="setupError" class="text-red-500 text-sm">{{ setupError }}</div>
            <NcButton type="primary" class="w-full" :loading="isLoading" @click="confirmPassword">
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
          <div class="text-xs text-nc-content-gray-subtle text-center">
            {{ $t('labels.manualEntryCode') }}:
            <code class="bg-nc-bg-gray-light px-2 py-1 rounded text-xs select-all">{{ setupData.secret }}</code>
          </div>
          <NcButton type="primary" class="w-full" @click="setupStep = 'verify'">
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
                v-model:value="setupCode"
                data-testid="nc-2fa-setup-code"
                size="large"
                :placeholder="$t('placeholder.enterVerificationCode')"
                autocomplete="one-time-code"
                @pressEnter="confirmSetup"
              />
            </div>
            <div v-if="setupError" class="text-red-500 text-sm">{{ setupError }}</div>
            <NcButton type="primary" class="w-full" @click="confirmSetup">
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
          <p class="text-xs text-nc-content-gray-subtle">
            {{ $t('labels.backupCodesWarning') }}
          </p>
          <NcButton type="primary" class="w-full" @click="closeSetupModal">
            {{ $t('general.done') }}
          </NcButton>
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
            <NcButton type="danger" class="flex-1" @click="confirmDisable">
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
                v-model:value="regenerateCode"
                data-testid="nc-2fa-regenerate-code"
                size="large"
                :placeholder="$t('placeholder.enterVerificationCode')"
                autocomplete="one-time-code"
                @pressEnter="confirmRegenerate"
              />
            </div>
            <div v-if="regenerateError" class="text-red-500 text-sm">{{ regenerateError }}</div>
            <NcButton type="primary" class="w-full" @click="confirmRegenerate">
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
          <p class="text-xs text-nc-content-gray-subtle">
            {{ $t('labels.backupCodesWarning') }}
          </p>
          <NcButton type="primary" class="w-full" @click="closeRegenerateModal">
            {{ $t('general.done') }}
          </NcButton>
        </template>
      </div>
    </NcModal>
  </div>
</template>
