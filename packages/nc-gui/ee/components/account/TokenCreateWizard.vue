<script lang="ts" setup>
import { ApiTokenPermissionLevel, NO_SCOPE } from 'nocodb-sdk'
import type { ApiTokenScopeEntry } from 'nocodb-sdk'

interface EditTokenType {
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

interface Props {
  editToken?: EditTokenType | null
}

const props = withDefaults(defineProps<Props>(), {
  editToken: null,
})

const emit = defineEmits(['created', 'saved', 'cancel'])

const { api } = useApi()
const { $api } = useNuxtApp()
const { copy } = useCopy()
const { t } = useI18n()
const { $e } = useNuxtApp()
const { isEEFeatureBlocked } = useEeConfig()

const isEditing = computed(() => !!props.editToken?.id)

const isCreating = ref(false)
const showResultModal = ref(false)
const createdTokenValue = ref('')

// Form fields — pre-fill from editToken if editing
const tokenName = ref(props.editToken?.title || props.editToken?.description || '')
const expiryOption = ref(props.editToken ? 'keep' : '90d')
const customExpiry = ref('')

// Scopes — pre-fill from editToken
const scopes = ref<ApiTokenScopeEntry[]>(
  props.editToken?.scopes?.map((s) => ({
    resource_type: s.resource_type,
    resource_id: s.resource_id,
  })) || [],
)

// Permissions — pre-fill from editToken's first scope, or empty
const existingPerms = props.editToken?.scopes?.[0]?.permissions
const permissions = ref<Record<string, string>>(existingPerms ? { ...existingPerms } : {})

const showExpiryDropdown = ref(false)

const selectedExpiryLabel = computed(() => {
  return expiryOptions.value.find((o) => o.value === expiryOption.value)?.label || expiryOption.value
})

// Result
const tokenCopied = ref(false)

const formatDate = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

const keepLabel = computed(() => {
  if (!props.editToken?.expiry) return t('labels.noExpiration')
  return `Keep (${new Date(props.editToken.expiry).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })})`
})

const expiryOptions = computed(() => [
  ...(isEditing.value ? [{ value: 'keep', label: keepLabel.value }] : []),
  { value: '7d', label: `7 days (${formatDate(7)})` },
  { value: '30d', label: `30 days (${formatDate(30)})` },
  { value: '60d', label: `60 days (${formatDate(60)})` },
  { value: '90d', label: `90 days (${formatDate(90)})` },
  { value: '1y', label: `1 year (${formatDate(365)})` },
  { value: 'custom', label: t('labels.custom') },
  { value: 'none', label: t('labels.noExpiration') },
])

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

const hasAccessScope = computed(() => {
  return scopes.value.length > 0
})

const isFineGrainedEnabled = computed(() => !isEEFeatureBlocked.value)

const isFormValid = computed(() => {
  return tokenName.value.length > 0 && tokenName.value.length <= 255 && (isFineGrainedEnabled.value ? hasAccessScope.value : true)
})

const submitToken = async () => {
  isCreating.value = true
  try {
    const hasPermissions = Object.values(permissions.value).some((v) => v !== ApiTokenPermissionLevel.NONE)

    const scopesWithPermissions = scopes.value.map((s) => ({
      ...s,
      ...(hasPermissions ? { permissions: permissions.value } : {}),
    }))

    if (isEditing.value) {
      // Update existing token
      const payload: any = {
        title: tokenName.value,
      }

      const newExpiry = computedExpiry.value
      if (newExpiry !== undefined) {
        payload.expiry = newExpiry
      }

      if (scopesWithPermissions.length) {
        payload.scopes = scopesWithPermissions
      }

      await $api.internal.postOperation(
        NO_SCOPE,
        NO_SCOPE,
        {
          operation: 'apiTokenUpdateWithScopes',
          tokenId: props.editToken!.id,
        },
        payload,
      )

      // Telemetry: token updated — log scope/permission counts, never token values
      $e('a:api-token:update', {
        scopeCount: scopesWithPermissions.length,
        permissionCount: Object.values(permissions.value).filter((v) => v !== ApiTokenPermissionLevel.NONE).length,
        hasExpiry: !!computedExpiry.value,
      })

      message.toast(t('msg.info.tokenUpdatedSuccessfully'))
      emit('saved')
    } else {
      // Create new token
      const payload: any = {
        title: tokenName.value,
        // Only include scopes/permissions when fine-grained is enabled (Cloud / licensed on-prem)
        ...(isFineGrainedEnabled.value && scopesWithPermissions.length ? { scopes: scopesWithPermissions } : {}),
        ...(isFineGrainedEnabled.value && hasPermissions && !scopesWithPermissions.length
          ? { permissions: permissions.value }
          : {}),
        // null = no expiration (explicitly clear), undefined = not set (keep default)
        ...(computedExpiry.value !== undefined ? { expiry: computedExpiry.value } : {}),
      }

      const result: any = await $api.internal.postOperation(
        NO_SCOPE,
        NO_SCOPE,
        {
          operation: 'apiTokenCreateWithScopes',
        },
        payload,
      )
      createdTokenValue.value = result.token
      showResultModal.value = true

      // Telemetry: token created — log scope/permission counts, never token values
      $e('a:api-token:create', {
        scopeCount: scopesWithPermissions.length,
        permissionCount: Object.values(permissions.value).filter((v) => v !== ApiTokenPermissionLevel.NONE).length,
        hasExpiry: !!computedExpiry.value,
      })

      emit('created', result.token)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isCreating.value = false
  }
}

const copyToken = async () => {
  if (!createdTokenValue.value) return
  try {
    await copy(createdTokenValue.value)
    tokenCopied.value = true
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const cancel = () => {
  emit('cancel')
}

const onResultDone = () => {
  showResultModal.value = false
  createdTokenValue.value = ''
  emit('cancel')
}
</script>

<template>
  <!-- ============ CREATE FORM (single page, Airtable-style) ============ -->
  <div class="flex flex-col gap-6" data-testid="nc-token-create-form">
    <span class="text-sm text-nc-content-gray-muted" data-rec="true">{{ $t('msg.apiTokenCreate') }}</span>

    <div class="max-w-150 flex flex-col gap-6">
      <!-- Name -->
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-bold text-nc-content-gray">{{ $t('general.name') }}</label>
        <span class="text-sm text-nc-content-gray-muted">{{ $t('msg.info.tokenNameVisibleInHistory') }}</span>
        <a-input v-model:value="tokenName" class="!rounded-lg max-w-150" :maxlength="255" data-testid="nc-token-name-input" />
      </div>

      <!-- Scopes (permissions) — hidden on CE / unlicensed on-prem -->
      <template v-if="isFineGrainedEnabled">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-bold text-nc-content-gray">{{ $t('labels.scopes') }}</label>
          <span class="text-sm text-nc-content-gray-muted">{{ $t('msg.info.tokenScopeDescription') }}</span>

          <AccountTokenPermissionMatrix v-model="permissions" />
        </div>

        <!-- Access (base scoping) -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-bold text-nc-content-gray">{{ $t('general.access') }}</label>
          <span class="text-sm text-nc-content-gray-muted">{{ $t('msg.info.tokenAccessDescription') }}</span>

          <AccountTokenScopePicker v-model:scopes="scopes" />
        </div>
      </template>

      <!-- Expiration -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-bold text-nc-content-gray">{{ $t('labels.expiration') }}</label>
        <div class="flex items-center gap-2">
          <NcDropdown v-model:visible="showExpiryDropdown" :trigger="['click']" placement="bottomLeft">
            <button class="nc-expiry-pill" data-testid="nc-token-expiry-select">
              <span class="text-xs font-semibold text-nc-content-gray">{{ selectedExpiryLabel }}</span>
              <GeneralIcon icon="arrowDown" class="w-3 h-3 text-nc-content-gray-muted ml-auto" />
            </button>

            <template #overlay>
              <NcMenu variant="small" class="!min-w-52">
                <NcMenuItem
                  v-for="opt in expiryOptions"
                  :key="opt.value"
                  :class="{ '!bg-nc-bg-gray-light': expiryOption === opt.value }"
                  @click="
                    () => {
                      expiryOption = opt.value
                      showExpiryDropdown = false
                    }
                  "
                >
                  {{ opt.label }}
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>
          <a-date-picker
            v-if="expiryOption === 'custom'"
            v-model:value="customExpiry"
            class="nc-expiry-datepicker flex-1 max-w-40"
            :disabled-date="(d: any) => d && d < new Date()"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 pt-4 border-t border-nc-border-gray-light">
        <NcButton v-e="['c:api-token:cancel']" type="text" size="small" data-testid="nc-token-cancel-btn" @click="cancel">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton
          v-e="[isEditing ? 'c:api-token:save' : 'c:api-token:create']"
          type="primary"
          size="small"
          :loading="isCreating"
          :disabled="!isFormValid"
          data-testid="nc-token-create-btn"
          @click="submitToken"
        >
          {{ isEditing ? $t('general.save') : $t('activity.createToken') }}
        </NcButton>
      </div>
    </div>

    <!-- Token Created Modal -->
    <NcModalConfirm
      v-model:visible="showResultModal"
      type="success"
      :title="$t('msg.info.tokenCreatedSuccessfully')"
      :ok-text="$t('general.done')"
      :ok-props="{ disabled: !tokenCopied }"
      :show-cancel-btn="false"
      :mask-closable="false"
      :keyboard="false"
      :closable="false"
      size="sm"
      :wrapper-props="{ 'data-testid': 'nc-token-result-modal' }"
      @ok="onResultDone"
    >
      <template #extraContent>
        <!-- Help text -->
        <p class="text-sm text-nc-content-gray-subtle2 mb-0 leading-5">
          {{ $t('msg.info.tokenResultHelpText') }}
        </p>

        <!-- Token value -->
        <div
          class="flex items-center gap-2 bg-nc-bg-gray-extralight border-1 border-nc-border-gray-medium rounded-lg px-3 py-2.5"
        >
          <code
            class="text-xs text-nc-content-gray select-all leading-5 flex-1 min-w-0 truncate"
            style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
            data-testid="nc-token-created-value"
          >
            {{ createdTokenValue }}
          </code>
          <NcTooltip :title="tokenCopied ? $t('general.copied') : $t('general.copy')">
            <NcButton
              v-e="['c:api-token:copy-created']"
              size="xs"
              type="secondary"
              class="flex-none !px-1.5"
              data-testid="nc-token-copy-btn"
              @click="copyToken"
            >
              <GeneralIcon
                :icon="tokenCopied ? 'check' : 'copy'"
                class="w-4 h-4"
                :class="tokenCopied ? 'text-green-600' : 'text-nc-content-gray-subtle2'"
              />
            </NcButton>
          </NcTooltip>
        </div>

        <!-- Warning -->
        <NcAlert type="warning" :description="$t('msg.info.tokenWontBeDisplayedAgain')" />
      </template>
    </NcModalConfirm>
  </div>
</template>

<style lang="scss" scoped>
.nc-expiry-pill {
  @apply flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
    bg-nc-bg-gray-light border-1 border-nc-border-gray-medium
    cursor-pointer transition-all w-56;

  &:hover {
    @apply bg-nc-bg-gray-medium;
  }
}

.nc-expiry-datepicker {
  @apply !rounded-lg !border-nc-border-gray-medium !shadow-none;

  &:deep(.ant-picker-focused),
  &.ant-picker-focused {
    @apply !border-nc-border-gray-medium !shadow-none;
  }
}
</style>
