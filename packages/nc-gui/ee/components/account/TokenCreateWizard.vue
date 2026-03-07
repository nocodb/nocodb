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
  // If user selected "Specific bases", they must select at least one
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
    <div v-if="currentStep < 4" class="flex items-center gap-2 mb-6">
      <template v-for="step in 3" :key="step">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
          :class="
            currentStep === step
              ? 'bg-brand-500 text-white'
              : currentStep > step
                ? 'bg-green-500 text-white'
                : 'bg-nc-bg-gray-extralight text-nc-content-gray-muted'
          "
        >
          <GeneralIcon v-if="currentStep > step" icon="check" class="w-4 h-4" />
          <span v-else>{{ step }}</span>
        </div>
        <div v-if="step < 3" class="flex-1 h-0.5 bg-nc-bg-gray-extralight">
          <div class="h-full transition-all" :class="currentStep > step ? 'bg-green-500 w-full' : 'w-0'" />
        </div>
      </template>
    </div>

    <!-- Step 1: Name & Expiry -->
    <div v-if="currentStep === 1" class="flex flex-col gap-5">
      <div class="text-lg font-semibold text-nc-content-gray-extreme">Name & Expiry</div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-nc-content-gray-subtle">Token name</label>
        <a-input
          v-model:value="tokenName"
          placeholder="e.g., CI/CD Pipeline"
          class="!rounded-lg"
          :maxlength="255"
          data-testid="nc-token-name-input"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-nc-content-gray-subtle">Expiration</label>
        <a-select v-model:value="expiryOption" class="w-full max-w-60" data-testid="nc-token-expiry-select">
          <a-select-option v-for="opt in expiryOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-select-option>
        </a-select>
        <a-date-picker
          v-if="expiryOption === 'custom'"
          v-model:value="customExpiry"
          class="mt-2 w-full max-w-60"
          :disabled-date="(d: any) => d && d < new Date()"
        />
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <NcButton type="secondary" data-testid="nc-token-wizard-cancel" @click="close"> Cancel </NcButton>
        <NcButton type="primary" :disabled="!isStep1Valid" data-testid="nc-token-wizard-next" @click="nextStep"> Next </NcButton>
      </div>
    </div>

    <!-- Step 2: Scope -->
    <div v-if="currentStep === 2" class="flex flex-col gap-5" data-testid="nc-token-wizard-step-2">
      <div class="text-lg font-semibold text-nc-content-gray-extreme">Scope</div>
      <p class="text-sm text-nc-content-gray-muted">Choose which resources this token can access.</p>

      <AccountTokenScopePicker v-model:scopes="scopes" />

      <div class="flex justify-end gap-2 mt-4">
        <NcButton type="secondary" data-testid="nc-token-wizard-back" @click="prevStep"> Back </NcButton>
        <NcButton type="primary" :disabled="!isStep2Valid" data-testid="nc-token-wizard-next" @click="nextStep"> Next </NcButton>
      </div>
    </div>

    <!-- Step 3: Permissions -->
    <div v-if="currentStep === 3" class="flex flex-col gap-5" data-testid="nc-token-wizard-step-3">
      <div class="text-lg font-semibold text-nc-content-gray-extreme">Permissions</div>
      <p class="text-sm text-nc-content-gray-muted">
        Select what this token can do. The token will only have access to the intersection of your role permissions and the
        permissions selected here.
      </p>

      <AccountTokenPermissionMatrix v-model="permissions" />

      <div class="flex justify-end gap-2 mt-4">
        <NcButton type="secondary" data-testid="nc-token-wizard-back" @click="prevStep"> Back </NcButton>
        <NcButton type="primary" :loading="isCreating" data-testid="nc-token-wizard-create" @click="createToken"> Create Token </NcButton>
      </div>
    </div>

    <!-- Step 4: Result -->
    <div v-if="currentStep === 4" class="flex flex-col gap-5 items-center text-center" data-testid="nc-token-wizard-result">
      <div class="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
        <GeneralIcon icon="check" class="w-8 h-8 text-green-600" />
      </div>

      <div class="text-lg font-semibold text-nc-content-gray-extreme">Token Created</div>
      <p class="text-sm text-nc-content-gray-muted max-w-md">
        Make sure to copy your API token now. You won't be able to see it again.
      </p>

      <div class="w-full max-w-lg bg-nc-bg-gray-extralight rounded-lg p-4 flex items-center gap-2">
        <code class="flex-1 text-xs break-all text-nc-content-gray-extreme select-all" data-testid="nc-token-created-value">{{ createdToken }}</code>
        <NcButton size="xs" :type="tokenCopied ? 'secondary' : 'primary'" data-testid="nc-token-copy-btn" @click="copyToken">
          {{ tokenCopied ? 'Copied!' : 'Copy' }}
        </NcButton>
      </div>

      <div class="flex justify-center mt-4">
        <NcButton type="primary" data-testid="nc-token-wizard-done" @click="close"> Done </NcButton>
      </div>
    </div>
  </div>
</template>
