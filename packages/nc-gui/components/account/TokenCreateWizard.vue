<script lang="ts" setup>
interface Props {
  editToken?: null
}

withDefaults(defineProps<Props>(), {
  editToken: null,
})

const emit = defineEmits(['created', 'saved', 'cancel'])

const { api } = useApi()
const { copy } = useCopy()
const { t } = useI18n()
const { $e } = useNuxtApp()

const isCreating = ref(false)
const showResultModal = ref(false)
const createdTokenValue = ref('')

const tokenName = ref('')
const expiryOption = ref('90d')
const customExpiry = ref('')

const showExpiryDropdown = ref(false)
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
  { value: 'custom', label: t('labels.custom') },
  { value: 'none', label: t('labels.noExpiration') },
])

const selectedExpiryLabel = computed(() => {
  return expiryOptions.value.find((o) => o.value === expiryOption.value)?.label || expiryOption.value
})

const isFormValid = computed(() => {
  return tokenName.value.length > 0 && tokenName.value.length <= 255
})

const submitToken = async () => {
  isCreating.value = true
  try {
    const token = await api.orgTokens.create({
      description: tokenName.value,
    })

    createdTokenValue.value = (token as any).token
    showResultModal.value = true

    $e('a:api-token:create')
    emit('created', (token as any).token)
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

const onResultDone = () => {
  showResultModal.value = false
  createdTokenValue.value = ''
  emit('cancel')
}
</script>

<template>
  <div class="flex flex-col gap-6" data-testid="nc-token-create-form">
    <span class="text-sm text-nc-content-gray-muted" data-rec="true">{{ $t('msg.apiTokenCreate') }}</span>

    <div class="max-w-150 flex flex-col gap-6">
      <!-- Name -->
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-bold text-nc-content-gray">{{ $t('general.name') }}</label>
        <a-input v-model:value="tokenName" class="!rounded-lg max-w-150" :maxlength="255" data-testid="nc-token-name-input" />
      </div>

      <!-- Expiration -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-bold text-nc-content-gray">{{ $t('labels.expiration') }}</label>
        <div class="flex items-center gap-2">
          <NcDropdown v-model:visible="showExpiryDropdown" :trigger="['click']" placement="bottomLeft">
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
        <NcButton type="text" size="small" data-testid="nc-token-cancel-btn" @click="emit('cancel')">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton
          type="primary"
          size="small"
          :loading="isCreating"
          :disabled="!isFormValid"
          data-testid="nc-token-create-btn"
          @click="submitToken"
        >
          {{ $t('activity.createToken') }}
        </NcButton>
      </div>
    </div>

    <!-- Token Created Modal -->
    <NcModal v-model:visible="showResultModal" :closable="false" :mask-closable="false" :keyboard="false" size="sm" centered>
      <div class="flex flex-col gap-4 p-1" data-testid="nc-token-result-modal">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="ncKey2" class="w-5 h-5 text-nc-content-gray flex-none" />
          <span class="text-base font-bold text-nc-content-gray-extreme flex-1">
            {{ $t('msg.info.tokenCreatedSuccessfully') }}
          </span>
          <GeneralIcon icon="circleCheck" class="w-5 h-5 text-green-600 flex-none" />
        </div>

        <p class="text-sm text-nc-content-gray-muted mb-0 leading-5">
          {{ $t('msg.info.tokenResultHelpText') }}
        </p>

        <div
          class="flex items-center gap-2 bg-nc-bg-gray-extralight border-1 border-nc-border-gray-medium rounded-lg px-3 py-2.5"
        >
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

        <div class="flex items-start gap-2 bg-orange-50 border-1 border-orange-200 rounded-lg px-3 py-2.5">
          <GeneralIcon icon="alertTriangle" class="w-4 h-4 text-orange-500 flex-none mt-0.5" />
          <span class="text-xs text-orange-700 leading-4">
            {{ $t('msg.info.tokenWontBeDisplayedAgain') }}
          </span>
        </div>

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
    </NcModal>
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
