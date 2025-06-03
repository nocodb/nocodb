<script lang="ts" setup>
import { hideExtraFieldsMetaKey, isLinksOrLTAR } from 'nocodb-sdk'
const { activeField, updateColMeta } = useFormViewStoreOrThrow()

const vShowExtraFields = computed({
  get: () => {
    return !activeField.value?.meta?.[hideExtraFieldsMetaKey]
  },
  set: (value) => {
    if (!activeField.value) return

    if (!activeField.value.meta) {
      activeField.value.meta = {}
    }

    activeField.value.meta[hideExtraFieldsMetaKey] = !value

    updateColMeta(activeField.value!)
  },
})
</script>

<template>
  <div v-if="activeField && isLinksOrLTAR(activeField)" class="flex flex-col">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="nc-form-input-required text-gray-800 font-medium">
          {{ $t('labels.showExtraFields') }}
        </div>
        <div class="text-gray-500 mt-1">
          {{ $t('labels.showExtraFieldsDescription') }}
        </div>
      </div>

      <a-switch
        v-model:checked="vShowExtraFields"
        v-e="['a:form-view:field:show-extra-fields']"
        size="small"
        data-testid="nc-form-input-show-extra-fields"
      />
    </div>
  </div>
</template>
