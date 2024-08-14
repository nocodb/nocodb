<script lang="ts" setup>
const basesStore = useBases()
const { basesList } = storeToRefs(basesStore)

const baseStore = useBase()
const { base: activeBase, isSharedBase } = storeToRefs(baseStore)


const { loadProjectTables } = useTablesStore()


const isOpen = ref<boolean>(false)

const handleNavigateToProject = async (base: NcProject) => {
  if (!base?.id) return

  const isProjectPopulated = basesStore.isProjectPopulated(base.id!)

  await navigateTo(
    baseStore.baseUrl({
      id: base.id!,
      type: 'database',
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
    <slot name="default" :isOpen="isOpen"></slot>
    <template #overlay>
      <NcList
        v-if="activeBase.id"
        v-model:open="isOpen"
        :value="activeBase.id"
        @change="handleNavigateToProject"
        :list="basesList"
        option-value-key="id"
        option-label-key="title"
        search-input-placeholder="Search bases"
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
      </NcList>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scopped></style>
