<script lang="ts" setup>
import { ApiTokenPermissionLevel } from 'nocodb-sdk'
import type { ApiTokenScopeEntry } from 'nocodb-sdk'

const emit = defineEmits(['created', 'cancel'])

const { api } = useApi()
const { copy } = useCopy()
const { t } = useI18n()

const isCreating = ref(false)
const showResultModal = ref(false)
const createdTokenValue = ref('')

// Form fields
const tokenName = ref('')
const expiryOption = ref('90d')
const customExpiry = ref('')

// Scopes
const scopes = ref<ApiTokenScopeEntry[]>([])

// Permissions — start empty, user adds one by one
const permissions = ref<Record<string, string>>({})

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

const expiryOptions = computed(() => [
  { value: '7d', label: `7 days (${formatDate(7)})` },
  { value: '30d', label: `30 days (${formatDate(30)})` },
  { value: '60d', label: `60 days (${formatDate(60)})` },
  { value: '90d', label: `90 days (${formatDate(90)})` },
  { value: '1y', label: `1 year (${formatDate(365)})` },
  { value: 'custom', label: 'Custom' },
  { value: 'none', label: 'No expiration' },
])

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
    createdTokenValue.value = result.token
    showResultModal.value = true
    emit('created', result.token)
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
      <div class="flex flex-col gap-2">
        <label class="text-sm font-bold text-nc-content-gray">{{ $t('general.access') }}</label>
        <span class="text-sm text-nc-content-gray-muted">{{ $t('msg.info.tokenAccessDescription') }}</span>

        <AccountTokenScopePicker v-model:scopes="scopes" />
      </div>

      <!-- Expiration -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-bold text-nc-content-gray">{{ $t('labels.expiration') }}</label>
        <div class="flex items-center gap-2">
          <NcDropdown
            v-model:visible="showExpiryDropdown"
            :trigger="['click']"
            placement="bottomLeft"
          >
            <button class="nc-expiry-pill" data-testid="nc-token-expiry-select">
              <span class="text-xs font-semibold text-nc-content-gray-extreme">{{ selectedExpiryLabel }}</span>
              <GeneralIcon icon="arrowDown" class="w-3 h-3 text-nc-content-gray-muted ml-auto" />
            </button>

            <template #overlay>
              <NcMenu variant="small" class="!min-w-52">
                <NcMenuItem
                  v-for="opt in expiryOptions"
                  :key="opt.value"
                  :class="{ '!bg-nc-bg-gray-light': expiryOption === opt.value }"
                  @click="expiryOption = opt.value; showExpiryDropdown = false"
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

    <!-- Token Created Modal -->
    <a-modal
      v-model:visible="showResultModal"
      :closable="false"
      :mask-closable="false"
      :keyboard="false"
      :footer="null"
      width="480px"
      centered
    >
      <div class="flex flex-col gap-4 p-1" data-testid="nc-token-result-modal">
        <!-- Header -->
        <div class="flex items-center gap-2">
          <GeneralIcon icon="ncKey2" class="w-5 h-5 text-nc-content-gray flex-none" />
          <span class="text-base font-bold text-nc-content-gray-extreme flex-1">
            {{ $t('msg.info.tokenCreatedSuccessfully') }}
          </span>
          <GeneralIcon icon="circleCheck" class="w-5 h-5 text-green-600 flex-none" />
        </div>

        <!-- Help text -->
        <p class="text-sm text-nc-content-gray-muted mb-0 leading-5">
          {{ $t('msg.info.tokenResultHelpText') }}
        </p>

        <!-- Token value -->
        <div class="flex items-center gap-2 bg-nc-bg-gray-extralight border-1 border-nc-border-gray-medium rounded-lg px-3 py-2.5">
          <code
            class="text-xs text-nc-content-gray-extreme select-all leading-5 flex-1 min-w-0 truncate"
            style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
            data-testid="nc-token-created-value"
          >
            {{ createdTokenValue }}
          </code>
          <NcTooltip :title="tokenCopied ? $t('general.copied') : $t('general.copy')">
            <NcButton
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
        <div class="flex items-start gap-2 bg-orange-50 border-1 border-orange-200 rounded-lg px-3 py-2.5">
          <GeneralIcon icon="alertTriangle" class="w-4 h-4 text-orange-500 flex-none mt-0.5" />
          <span class="text-xs text-orange-700 leading-4">
            {{ $t('msg.info.tokenWontBeDisplayedAgain') }}
          </span>
        </div>

        <!-- Footer -->
        <div class="flex justify-end">
          <NcButton
            type="primary"
            size="small"
            :disabled="!tokenCopied"
            data-testid="nc-token-done-btn"
            @click="onResultDone"
          >
            {{ $t('general.done') }}
          </NcButton>
        </div>
      </div>
    </a-modal>
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
