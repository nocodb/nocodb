<script lang="ts" setup>
import {
  ApiTokenPermissionLevel,
  BASE_SCOPED_PERMISSION_CATEGORIES,
} from 'nocodb-sdk'
import type { ApiTokenScopeEntry } from 'nocodb-sdk'

const emit = defineEmits(['created', 'cancel'])

const { api } = useApi()
const { copy } = useCopy()
const { t } = useI18n()

const currentStep = ref(1)
const isCreating = ref(false)

// Step 1 — Name & Expiry
const tokenName = ref('')
const expiryOption = ref('90d')
const customExpiry = ref('')

// Step 2 — Scopes
const scopes = ref<ApiTokenScopeEntry[]>([])

// Step 3 — Permissions (applied to all scopes, or global if no scopes)
const permissions = ref<Record<string, string>>({})

// Result
const createdToken = ref<string | null>(null)
const tokenCopied = ref(false)

const expiryOptions = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '60d', label: '60 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
  { value: 'custom', label: 'Custom date' },
  { value: 'none', label: 'No expiration' },
]

const stepLabels = ['Name & Expiry', 'Scope', 'Permissions']

const computedExpiry = computed(() => {
  if (expiryOption.value === 'none') return undefined
  if (expiryOption.value === 'custom') return customExpiry.value || undefined

  const now = new Date()
  const daysMap: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '60d': 60,
    '90d': 90,
    '1y': 365,
  }
  const days = daysMap[expiryOption.value] || 90
  now.setDate(now.getDate() + days)
  return now.toISOString()
})

const isStep1Valid = computed(() => {
  return tokenName.value.length > 0 && tokenName.value.length <= 255
})

const isStep2Valid = computed(() => {
  return true
})

// Initialize default permissions
const initPermissions = () => {
  if (Object.keys(permissions.value).length) return
  const perms: Record<string, string> = {}
  for (const cat of BASE_SCOPED_PERMISSION_CATEGORIES) {
    perms[cat] = ApiTokenPermissionLevel.NONE
  }
  permissions.value = perms
}

const nextStep = () => {
  if (currentStep.value === 2) {
    initPermissions()
  }
  currentStep.value++
}

const prevStep = () => {
  currentStep.value--
}

const createToken = async () => {
  isCreating.value = true
  try {
    const hasPermissions = Object.values(permissions.value).some(
      (v) => v !== ApiTokenPermissionLevel.NONE,
    )

    // Build scopes with permissions attached
    const scopesWithPermissions = scopes.value.map((s) => ({
      ...s,
      ...(hasPermissions ? { permissions: permissions.value } : {}),
    }))

    const payload: any = {
      title: tokenName.value,
      ...(scopesWithPermissions.length ? { scopes: scopesWithPermissions } : {}),
      ...(hasPermissions && !scopesWithPermissions.length ? { permissions: permissions.value } : {}),
      ...(computedExpiry.value ? { expiry: computedExpiry.value } : {}),
    }

    // Use V3 API for fine-grained token creation
    const result = await api.request({
      path: '/api/v3/meta/tokens',
      method: 'POST',
      body: payload,
    })
    createdToken.value = result.token
    currentStep.value = 4 // Result step
    emit('created', result)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isCreating.value = false
  }
}

const copyToken = async () => {
  if (!createdToken.value) return
  try {
    await copy(createdToken.value)
    tokenCopied.value = true
    message.info(t('msg.info.copiedToClipboard'))
    setTimeout(() => {
      tokenCopied.value = false
    }, 2000)
  } catch (e: any) {
    message.error(e.message)
  }
}

const close = () => {
  emit('cancel')
}
</script>

<template>
  <div class="nc-token-create-wizard" data-testid="nc-token-create-wizard">
    <!-- Steps indicator -->
    <div v-if="currentStep < 4" class="flex items-center mb-6 px-2">
      <template v-for="step in 3" :key="step">
        <div class="flex flex-col items-center gap-1">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
            :class="
              currentStep === step
                ? 'bg-brand-500 text-white'
                : currentStep > step
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-400'
            "
          >
            <GeneralIcon v-if="currentStep > step" icon="check" class="w-4 h-4" />
            <span v-else>{{ step }}</span>
          </div>
          <span
            class="text-xs font-medium whitespace-nowrap"
            :class="currentStep >= step ? 'text-nc-content-gray' : 'text-gray-400'"
          >
            {{ stepLabels[step - 1] }}
          </span>
        </div>
        <div v-if="step < 3" class="flex-1 h-0.5 bg-gray-100 mx-3 mb-5 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="currentStep > step ? 'bg-green-500 w-full' : 'w-0'"
          />
        </div>
      </template>
    </div>

    <!-- Step 1: Name & Expiry -->
    <div v-if="currentStep === 1" class="flex flex-col gap-5">
      <div>
        <div class="text-base font-semibold text-nc-content-gray-extreme">Name your token</div>
        <div class="text-sm text-nc-content-gray-muted mt-1">
          Give it a descriptive name so you can identify it later.
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-nc-content-gray">Token name</label>
        <a-input
          v-model:value="tokenName"
          placeholder="e.g., CI/CD Pipeline, Zapier Integration"
          size="large"
          class="!rounded-lg"
          :maxlength="255"
          data-testid="nc-token-name-input"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-nc-content-gray">Expiration</label>
        <a-select v-model:value="expiryOption" class="w-full max-w-64" size="large" data-testid="nc-token-expiry-select">
          <a-select-option v-for="opt in expiryOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-select-option>
        </a-select>
        <a-date-picker
          v-if="expiryOption === 'custom'"
          v-model:value="customExpiry"
          class="mt-2 w-full max-w-64"
          size="large"
          :disabled-date="(d: any) => d && d < new Date()"
        />
        <span v-if="expiryOption !== 'none'" class="text-xs text-nc-content-gray-muted">
          We recommend setting an expiration for better security.
        </span>
      </div>

      <div class="flex justify-end gap-2 pt-4 border-t border-nc-border-gray-light">
        <NcButton type="secondary" size="small" data-testid="nc-token-wizard-cancel" @click="close">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton type="primary" size="small" :disabled="!isStep1Valid" data-testid="nc-token-wizard-next" @click="nextStep">
          Continue
        </NcButton>
      </div>
    </div>

    <!-- Step 2: Scope -->
    <div v-if="currentStep === 2" class="flex flex-col gap-5" data-testid="nc-token-wizard-step-2">
      <div>
        <div class="text-base font-semibold text-nc-content-gray-extreme">Choose scope</div>
        <div class="text-sm text-nc-content-gray-muted mt-1">
          Restrict which resources this token can access.
        </div>
      </div>

      <AccountTokenScopePicker v-model:scopes="scopes" />

      <div class="flex justify-end gap-2 pt-4 border-t border-nc-border-gray-light">
        <NcButton type="secondary" size="small" data-testid="nc-token-wizard-back" @click="prevStep">
          {{ $t('general.back') }}
        </NcButton>
        <NcButton type="primary" size="small" :disabled="!isStep2Valid" data-testid="nc-token-wizard-next" @click="nextStep">
          Continue
        </NcButton>
      </div>
    </div>

    <!-- Step 3: Permissions -->
    <div v-if="currentStep === 3" class="flex flex-col gap-5" data-testid="nc-token-wizard-step-3">
      <div>
        <div class="text-base font-semibold text-nc-content-gray-extreme">Set permissions</div>
        <div class="text-sm text-nc-content-gray-muted mt-1">
          Choose what this token can do. Effective permissions are the intersection of your role and the levels selected here.
        </div>
      </div>

      <AccountTokenPermissionMatrix v-model="permissions" />

      <div class="flex justify-end gap-2 pt-4 border-t border-nc-border-gray-light">
        <NcButton type="secondary" size="small" data-testid="nc-token-wizard-back" @click="prevStep">
          {{ $t('general.back') }}
        </NcButton>
        <NcButton type="primary" size="small" :loading="isCreating" data-testid="nc-token-wizard-create" @click="createToken">
          Create Token
        </NcButton>
      </div>
    </div>

    <!-- Step 4: Result -->
    <div v-if="currentStep === 4" class="flex flex-col items-center text-center py-4" data-testid="nc-token-wizard-result">
      <div class="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-4">
        <GeneralIcon icon="check" class="w-6 h-6 text-green-600" />
      </div>

      <div class="text-base font-semibold text-nc-content-gray-extreme">Token created successfully</div>
      <p class="text-sm text-nc-content-gray-muted mt-2 max-w-sm">
        Copy your token now. For security, it won't be shown again.
      </p>

      <div class="w-full mt-4 bg-nc-bg-gray-extralight border-1 rounded-lg p-4">
        <div class="flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <code
              class="text-sm break-all text-nc-content-gray-extreme select-all leading-relaxed block font-mono"
              data-testid="nc-token-created-value"
            >
              {{ createdToken }}
            </code>
          </div>
          <NcButton
            size="xs"
            :type="tokenCopied ? 'secondary' : 'primary'"
            class="flex-none"
            data-testid="nc-token-copy-btn"
            @click="copyToken"
          >
            <div class="flex items-center gap-1">
              <GeneralIcon :icon="tokenCopied ? 'check' : 'copy'" class="w-3.5 h-3.5" />
              {{ tokenCopied ? 'Copied' : 'Copy' }}
            </div>
          </NcButton>
        </div>
      </div>

      <NcAlert type="warning" class="w-full mt-3" :show-icon="true">
        <template #message> This token will not be displayed again after you close this dialog. </template>
      </NcAlert>

      <div class="mt-6">
        <NcButton type="primary" size="small" data-testid="nc-token-wizard-done" @click="close">Done</NcButton>
      </div>
    </div>
  </div>
</template>
