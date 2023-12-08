<script lang="ts" setup>
import { onKeyStroke } from '#imports'

const props = defineProps<{
  visible: boolean
  entityName: string
  onDelete: () => Promise<void>
  deleteLabel?: string | undefined
}>()

const emits = defineEmits(['update:visible'])
const visible = useVModel(props, 'visible', emits)

const isLoading = ref(false)

const { t } = useI18n()

const deleteLabel = computed(() => props.deleteLabel ?? t('general.delete'))

const onDelete = async () => {
  isLoading.value = true
  try {
    await props.onDelete()

    visible.value = false
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

onKeyStroke('Escape', () => {
  if (visible.value) visible.value = false
})

onKeyStroke('Enter', () => {
  if (isLoading.value) return

  if (!visible.value) return

  onDelete()
})
</script>

<template>
  <GeneralModal v-model:visible="visible" size="small" centered>
    <div class="flex flex-col p-6">
      <div class="flex flex-row pb-2 mb-4 font-medium text-lg border-b-1 border-gray-50 text-gray-800">
        {{ deleteLabel }} {{ props.entityName }}
      </div>

      <div class="mb-3 text-gray-800">
        {{
          $t('msg.areYouSureUWantToDeleteLabel', {
            deleteLabel: deleteLabel.toLowerCase(),
          })
        }}<span class="ml-1">{{ props.entityName.toLowerCase() }}?</span>
      </div>

      <slot name="entity-preview"></slot>

      <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
        <NcButton type="secondary" @click="visible = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          key="submit"
          type="danger"
          html-type="submit"
          :loading="isLoading"
          data-testid="nc-delete-modal-delete-btn"
          @click="onDelete"
        >
          {{ `${deleteLabel} ${props.entityName}` }}
          <template #loading>
            {{ $t('general.deleting') }}
          </template>
        </NcButton>
      </div>
    </div>
  </GeneralModal>
</template>

<style lang="scss">
.nc-modal-wrapper {
  .ant-modal-content {
    @apply !p-0;
  }
}
</style>
