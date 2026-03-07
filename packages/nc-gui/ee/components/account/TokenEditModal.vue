<script lang="ts" setup>
import {
  ApiTokenPermissionLevel,
  BASE_SCOPED_PERMISSION_CATEGORIES,
} from 'nocodb-sdk'

const props = defineProps<{
  token: {
    id?: string
    title?: string
    description?: string
    expiry?: string
    enabled?: boolean
    scopes?: Array<{
      id?: string
      resource_type: string
      resource_id: string
      permissions?: Record<string, string>
    }>
  }
}>()

const emit = defineEmits(['saved', 'cancel'])

const { api } = useApi()
const { t } = useI18n()

const isSaving = ref(false)
const tokenName = ref(props.token.title || props.token.description || '')
const expiryOption = ref<string>('keep')
const customExpiry = ref('')

// Permissions from scopes
const permissions = ref<Record<string, string>>({})
const showPermissions = ref(false)

const expiryOptions = [
  { value: 'keep', label: props.token.expiry ? `Keep current (${new Date(props.token.expiry).toLocaleDateString()})` : 'No expiration' },
  { value: '7d', label: '7 days from now' },
  { value: '30d', label: '30 days from now' },
  { value: '60d', label: '60 days from now' },
  { value: '90d', label: '90 days from now' },
  { value: '1y', label: '1 year from now' },
  { value: 'custom', label: 'Custom date' },
  { value: 'none', label: 'No expiration' },
]

// Initialize permissions from the first scope's permissions (or empty)
const initPermissions = () => {
  const existingPerms = props.token.scopes?.[0]?.permissions
  if (existingPerms && Object.keys(existingPerms).length) {
    permissions.value = { ...existingPerms }
    showPermissions.value = true
  } else {
    const perms: Record<string, string> = {}
    for (const cat of BASE_SCOPED_PERMISSION_CATEGORIES) {
      perms[cat] = ApiTokenPermissionLevel.NONE
    }
    permissions.value = perms
  }
}

initPermissions()

const computedExpiry = computed(() => {
  if (expiryOption.value === 'keep') return undefined
  if (expiryOption.value === 'none') return null
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

const isValid = computed(() => {
  return tokenName.value.length > 0 && tokenName.value.length <= 255
})

const hasPermissionChanges = computed(() => {
  if (!showPermissions.value) return false
  return Object.values(permissions.value).some((v) => v !== ApiTokenPermissionLevel.NONE)
})

const saveToken = async () => {
  if (!props.token.id) return
  isSaving.value = true
  try {
    const payload: any = {}

    if (tokenName.value !== (props.token.title || props.token.description)) {
      payload.title = tokenName.value
    }

    const newExpiry = computedExpiry.value
    if (newExpiry !== undefined) {
      payload.expiry = newExpiry
    }

    if (showPermissions.value && hasPermissionChanges.value) {
      const existingScopes = props.token.scopes || []
      if (existingScopes.length) {
        payload.scopes = existingScopes.map((s) => ({
          resource_type: s.resource_type,
          resource_id: s.resource_id,
          permissions: permissions.value,
        }))
      } else {
        payload.scopes = [{
          resource_type: 'org',
          resource_id: '*',
          permissions: permissions.value,
        }]
      }
    }

    if (Object.keys(payload).length === 0) {
      emit('cancel')
      return
    }

    await api.request({
      path: `/api/v3/meta/tokens/${props.token.id}`,
      method: 'PATCH',
      body: payload,
    })

    message.success('Token updated successfully')
    emit('saved')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="nc-token-edit-modal" data-testid="nc-token-edit-modal">
    <div class="text-base font-semibold text-nc-content-gray-extreme">Edit token</div>
    <div class="text-sm text-nc-content-gray-muted mt-1">
      Update the name, expiration, or permissions of this token.
    </div>

    <div class="flex flex-col gap-5 mt-5">
      <!-- Name -->
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-nc-content-gray">Token name</label>
        <a-input
          v-model:value="tokenName"
          size="large"
          class="!rounded-lg"
          :maxlength="255"
          data-testid="nc-token-edit-name"
        />
      </div>

      <!-- Expiry -->
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-nc-content-gray">Expiration</label>
        <a-select
          v-model:value="expiryOption"
          class="w-full max-w-64"
          size="large"
          data-testid="nc-token-edit-expiry"
        >
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
      </div>

      <!-- Permissions toggle -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-nc-content-gray">Permissions</label>
          <a-switch
            v-model:checked="showPermissions"
            size="small"
            data-testid="nc-token-edit-perms-toggle"
          />
        </div>
        <AccountTokenPermissionMatrix v-if="showPermissions" v-model="permissions" />
      </div>
    </div>

    <!-- Footer -->
    <div class="flex justify-end gap-2 pt-4 mt-5 border-t border-nc-border-gray-light">
      <NcButton type="secondary" size="small" data-testid="nc-token-edit-cancel" @click="emit('cancel')">
        {{ $t('general.cancel') }}
      </NcButton>
      <NcButton
        type="primary"
        size="small"
        :disabled="!isValid"
        :loading="isSaving"
        data-testid="nc-token-edit-save"
        @click="saveToken"
      >
        Save Changes
      </NcButton>
    </div>
  </div>
</template>
