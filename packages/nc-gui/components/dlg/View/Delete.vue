<script lang="ts" setup>
import { DependencyTableType } from 'nocodb-sdk'
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

const { status, dependency, checkDependency } = useDependencies()

watch(
  () => props.modelValue,
  async (newVal) => {
    if (newVal && props.view?.id) {
      await checkDependency(DependencyTableType.View, props.view.id)
    }
  },
  { immediate: true },
)

async function onDelete() {
  if (!props.view) return

  await viewsStore.deleteView(props.view)
  vModel.value = false
}
</script>

<template>
  <GeneralDeleteModal
    v-model:visible="vModel"
    :entity-name="$t('objects.view')"
    :on-delete="onDelete"
    :disable-delete-btn="status === 'loading'"
  >
    <template #entity-preview>
      <div
        v-if="view"
        class="flex flex-row items-center py-2 px-3 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle"
      >
        <GeneralViewIcon :meta="props.view" class="nc-view-icon w-4 min-h-4"></GeneralViewIcon>
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-3"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          <span>
            {{ view.title }}
          </span>
        </div>
      </div>

      <!-- Dependency Check Section -->
      <div class="mt-4">
        <NcDependencyList
          :status="status"
          :has-breaking-changes="dependency.hasBreakingChanges"
          :entities="dependency.entities"
          action="delete"
          entity-type="view"
        />
      </div>
    </template>
  </GeneralDeleteModal>
</template>
