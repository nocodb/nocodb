<script lang="ts" setup>
import { ApiTokenPermissionLevel } from 'nocodb-sdk'
import type { ApiTokenScopeEntry } from 'nocodb-sdk'

interface Props {
  createdToken?: string
  resultOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  createdToken: '',
  resultOnly: false,
})

const emit = defineEmits(['created', 'cancel'])

const { api } = useApi()
const { copy } = useCopy()
const { t } = useI18n()

const isCreating = ref(false)

// Form fields
const tokenName = ref('')
const expiryOption = ref('90d')
const customExpiry = ref('')

// Scopes
const scopes = ref<ApiTokenScopeEntry[]>([])

// Permissions — start empty, user adds one by one
const permissions = ref<Record<string, string>>({})

// Result
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

const isFormValid = computed(() => {
  return tokenName.value.length > 0 && tokenName.value.length <= 255
})


const createToken = async () => {
  isCreating.value = true
  try {
    const hasPermissions = Object.values(permissions.value).some(
      (v) => v !== ApiTokenPermissionLevel.NONE,
    )

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

    const result = await api.request({
      path: '/api/v3/meta/tokens',
      method: 'POST',
      body: payload,
    })
    emit('created', result.token)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isCreating.value = false
  }
}

const copyToken = async () => {
  if (!props.createdToken) return
  try {
    await copy(props.createdToken)
    tokenCopied.value = true
    message.info(t('msg.info.copiedToClipboard'))
    setTimeout(() => {
      tokenCopied.value = false
    }, 2000)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const cancel = () => {
  emit('cancel')
}
</script>

<template>
  <!-- ============ RESULT VIEW ============ -->
  <div v-if="resultOnly && createdToken" class="flex flex-col gap-6" data-testid="nc-token-create-result">
    <div>
      <h6 class="text-xl font-bold my-0 text-nc-content-gray" data-rec="true">{{ $t('title.apiTokens') }}</h6>
      <span class="text-sm text-nc-content-gray-muted" data-rec="true">{{ $t('msg.apiTokenCreate') }}</span>
    </div>

    <div class="max-w-150 flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-none">
          <GeneralIcon icon="check" class="w-5 h-5 text-green-600" />
        </div>
        <div>
          <div class="text-base font-semibold text-nc-content-gray-extreme">{{ $t('msg.info.tokenCreatedSuccessfully') }}</div>
          <div class="text-sm text-nc-content-gray-muted">{{ $t('msg.info.tokenCopyWarning') }}</div>
        </div>
      </div>

      <div class="bg-nc-bg-gray-extralight border-1 rounded-lg p-4">
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
              {{ tokenCopied ? $t('general.copied') : $t('general.copy') }}
            </div>
          </NcButton>
        </div>
      </div>

      <NcAlert type="warning" class="!rounded-lg" :show-icon="true">
        <template #message>
          <span class="text-xs">{{ $t('msg.info.tokenWontBeDisplayedAgain') }}</span>
        </template>
      </NcAlert>

      <div class="flex justify-end pt-2">
        <NcButton type="primary" size="small" data-testid="nc-token-done-btn" @click="cancel">
          {{ $t('general.done') }}
        </NcButton>
      </div>
    </div>
  </div>

  <!-- ============ CREATE FORM (single page, Airtable-style) ============ -->
  <div v-else class="flex flex-col gap-6" data-testid="nc-token-create-form">
    <span class="text-sm text-nc-content-gray-muted" data-rec="true">{{ $t('msg.apiTokenCreate') }}</span>

    <div class="max-w-150 flex flex-col gap-6">
      <!-- Name -->
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-bold text-nc-content-gray">{{ $t('general.name') }}</label>
        <span class="text-sm text-nc-content-gray-muted">{{ $t('msg.info.tokenNameVisibleInHistory') }}</span>
        <a-input
          v-model:value="tokenName"
          class="!rounded-lg max-w-150"
          :maxlength="255"
          data-testid="nc-token-name-input"
        />
      </div>

      <!-- Scopes (permissions) -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-bold text-nc-content-gray">{{ $t('labels.scopes') }}</label>
        <span class="text-sm text-nc-content-gray-muted">{{ $t('msg.info.tokenScopeDescription') }}</span>

        <AccountTokenPermissionMatrix v-model="permissions" />
      </div>

      <!-- Access (base scoping) -->
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-bold text-nc-content-gray">{{ $t('general.access') }}</label>
        <span class="text-sm text-nc-content-gray-muted">{{ $t('msg.info.tokenAccessDescription') }}</span>

        <AccountTokenScopePicker v-model:scopes="scopes" />
      </div>

      <!-- Expiration -->
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-bold text-nc-content-gray">{{ $t('labels.expiration') }}</label>
        <a-select v-model:value="expiryOption" class="w-full max-w-64" data-testid="nc-token-expiry-select">
          <a-select-option v-for="opt in expiryOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-select-option>
        </a-select>
        <a-date-picker
          v-if="expiryOption === 'custom'"
          v-model:value="customExpiry"
          class="mt-2 w-full max-w-64"
          :disabled-date="(d: any) => d && d < new Date()"
        />
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 pt-4 border-t border-nc-border-gray-light">
        <NcButton type="text" size="small" data-testid="nc-token-cancel-btn" @click="cancel">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton
          type="primary"
          size="small"
          :loading="isCreating"
          :disabled="!isFormValid"
          data-testid="nc-token-create-btn"
          @click="createToken"
        >
          {{ $t('activity.createToken') }}
        </NcButton>
      </div>
    </div>
  </div>
</template>
