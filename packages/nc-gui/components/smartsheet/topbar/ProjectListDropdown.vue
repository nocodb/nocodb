<script lang="ts" setup>
const props = defineProps<{
  isAutomation?: boolean
}>()

const basesStore = useBases()
const { basesList } = storeToRefs(basesStore)

const baseStore = useBase()
const { base: activeBase, isSharedBase } = storeToRefs(baseStore)

const { loadProjectTables } = useTablesStore()

const isOpen = ref<boolean>(false)

/**
 * Handles navigation to a selected project/base.
 *
 * @param base - The project/base to navigate to.
 * @returns A Promise that resolves when the navigation is complete.
 *
 * @remarks
 * This function is called when a user selects a project from the dropdown list.
 * It performs the following steps:
 * 1. Checks if the base has a valid ID.
 * 2. Determines if the project data is already populated.
 * 3. Navigates to the selected project's URL.
 * 4. If the project data isn't populated, it loads the project tables.
 */
const handleNavigateToProject = async (base: NcProject) => {
  if (!base?.id) return

  const isProjectPopulated = basesStore.isProjectPopulated(base.id!)

  await navigateTo(
    baseStore.baseUrl({
      id: base.id!,
      type: 'database',
      isAutomation: props.isAutomation,
      isSharedBase: isSharedBase.value,
    }),
  )

  if (!isProjectPopulated) {
    await loadProjectTables(base.id)
  }
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen">
    <slot name="default" :is-open="isOpen"></slot>
    <template #overlay>
      <LazyNcList
        v-if="activeBase.id"
        v-model:open="isOpen"
        :value="activeBase.id"
        :list="basesList"
        option-value-key="id"
        option-label-key="title"
        search-input-placeholder="Search bases"
        @change="handleNavigateToProject"
      >
        <template #listItem="{ option }">
          <GeneralBaseIconColorPicker :type="option?.type" :model-value="parseProp(option.meta).iconColor" size="xsmall" readonly>
          </GeneralBaseIconColorPicker>
          <NcTooltip class="truncate flex-1" show-on-truncate-only>
            <template #title>
              {{ option?.title }}
            </template>
            {{ option?.title }}
          </NcTooltip>
          <GeneralIcon
            v-if="option.id === activeBase.id"
            id="nc-selected-item-icon"
            icon="check"
            class="flex-none text-primary w-4 h-4"
          />
        </template>
      </LazyNcList>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped></style>
