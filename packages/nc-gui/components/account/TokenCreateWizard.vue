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
const { $e } = useNuxtApp()

const isCreating = ref(false)
const showResultModal = ref(false)
const createdTokenValue = ref('')

const tokenName = ref('')
const tokenCopied = ref(false)

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
            class="text-xs text-nc-content-gray-extreme select-all leading-5 flex-1 min-w-0 truncate"
            style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
            data-testid="nc-token-created-value"
          >
            {{ createdTokenValue }}
          </code>
          <NcTooltip :title="tokenCopied ? $t('general.copied') : $t('general.copy')">
            <NcButton size="xs" type="secondary" class="flex-none !px-1.5" data-testid="nc-token-copy-btn" @click="copyToken">
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

<style lang="scss" scoped></style>
