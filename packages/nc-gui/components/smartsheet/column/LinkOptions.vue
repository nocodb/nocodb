<script setup lang="ts">
import { storeToRefs, useColumnCreateStoreOrThrow, useVModel } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const viewsStore = useViewsStore()
const { viewsByTable } = storeToRefs(viewsStore)

const vModel = useVModel(props, 'value', emit)

const { validateInfos, setAdditionalValidations } = useColumnCreateStoreOrThrow()

const refViews = computed(() => {
  if (!vModel.value) return []

  const views = viewsByTable.value.get(vModel.value.colOptions.fk_related_model_id)
  return views || []
})

setAdditionalValidations({
  'meta.singular': [
    {
      validator: (_, value: string) => {
        return new Promise((resolve, reject) => {
          if (value?.length > 59) {
            return reject(t('msg.length59Required'))
          }
          resolve(true)
        })
      },
    },
  ],
  'meta.plural': [
    {
      validator: (_, value: string) => {
        return new Promise((resolve, reject) => {
          if (value?.length > 59) {
            return reject(t('msg.length59Required'))
          }
          resolve(true)
        })
      },
    },
  ],
})

// set default value
vModel.value.meta = {
  singular: '',
  plural: '',
  ...vModel.value.meta,
}
</script>

<template>
  <a-row :gutter="8">
    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.singular']" :label="$t('labels.singularLabel')">
        <a-input
          v-model:value="vModel.meta.singular"
          :placeholder="$t('general.link')"
          class="!w-full nc-link-singular !rounded-md"
        />
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.plural']" :label="$t('labels.pluralLabel')">
        <a-input
          v-model:value="vModel.meta.plural"
          :placeholder="$t('general.links')"
          class="!w-full nc-link-plural !rounded-md"
        />
      </a-form-item>
    </a-col>
    <a-form-item :label="$t('labels.childView')" class="flex w-full pb-2 mt-4 space-y-2 nc-ltar-child-view">
      <NcSelect v-model:value="vModel.colOptions.fk_child_view_id">
        <a-select-option v-for="view of refViews" :key="view.title" :value="view.id">
          <div class="flex w-full items-center gap-2">
            <div class="min-w-5 flex items-center justify-center">
              <GeneralViewIcon :meta="view" class="text-gray-500" />
            </div>
            <NcTooltip class="flex-1 truncate" show-on-truncate-only>
              <template #title>{{ view.title }}</template>
              <span>{{ view.title }}</span>
            </NcTooltip>
          </div>
        </a-select-option>
      </NcSelect>
    </a-form-item>
  </a-row>
</template>
