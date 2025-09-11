<script lang="ts" setup>
interface Props {
  modelValue: boolean
  view?: Record<string, any>
}

interface Emits {
  (event: 'update:modelValue', data: boolean): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { view } = props

const vModel = useVModel(props, 'modelValue', emits)

const viewsStore = useViewsStore()

async function onDelete() {
  if (!props.view) return

  await viewsStore.deleteView(props.view)
  vModel.value = false
}
</script>

<template>
  <GeneralDeleteModal v-model:visible="vModel" :entity-name="$t('objects.view')" :on-delete="onDelete">
    <template #entity-preview>
      <div v-if="view" class="flex flex-row items-center py-2 px-3 bg-gray-50 rounded-lg text-gray-700">
        <GeneralViewIcon :meta="props.view" class="nc-view-icon w-4 min-h-4"></GeneralViewIcon>
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-3"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          <span v-if="view.is_default">{{ $t('labels.defaultView') }}</span>
          <span v-else>
            {{ view.title }}
          </span>
        </div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>
