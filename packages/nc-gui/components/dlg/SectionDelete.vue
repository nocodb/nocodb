<script lang="ts" setup>
import { extractSdkResponseErrorMsg, message, onKeyStroke, useApi, useI18n, useVModel } from '#imports'
import type { SectionType } from '~/lib'

interface Props {
  modelValue: boolean
  section: SectionType
}

interface Emits {
  (event: 'update:modelValue', data: boolean): void
  (event: 'deleted'): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { t } = useI18n()

const vModel = useVModel(props, 'modelValue', emits)

const { api, isLoading } = useApi()

onKeyStroke('Escape', () => (vModel.value = false))

onKeyStroke('Enter', () => onDelete())

/** Delete a section */
async function onDelete() {
  try {
    for (const view of props.section.views) {
      await api.dbView.update(view.id!, { section: '' })
    }

    // Section deleted successfully
    message.success(t('msg.success.sectionDeleted'))

    vModel.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  emits('deleted')
}
</script>

<template>
  <a-modal
    v-model:visible="vModel"
    class="!top-[35%]"
    :class="{ active: vModel }"
    :confirm-loading="isLoading"
    wrap-class-name="nc-modal-section-delete"
  >
    <template #title> {{ $t('general.delete') }} {{ $t('objects.section') }} </template>

    {{ $t('msg.info.deleteSectionConfirmation') }}

    <template #footer>
      <a-button key="back" @click="vModel = false">{{ $t('general.cancel') }}</a-button>

      <a-button key="submit" danger html-type="submit" :loading="isLoading" @click="onDelete">
        {{ $t('general.submit') }}
      </a-button>
    </template>
  </a-modal>
</template>
