<script lang="ts" setup>
const { activeProjectId, basesList } = storeToRefs(useBases())
const { base: activeBase, isSharedBase } = storeToRefs(useBase())
const { baseUrl } = useBase()

const isOpen = ref<boolean>(false)

const handleNavigateToProject = async (base: NcProject) => {
  if (!base?.id) return

  await navigateTo(
    baseUrl({
      id: base.id!,
      type: 'database',
      isSharedBase: isSharedBase.value,
    }),
  )
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen">
    <slot />
    <template #overlay>
      <NcList
        v-if="activeBase.id"
        v-model:open="isOpen"
        :value="activeBase.id"
        @change="handleNavigateToProject"
        :list="basesList"
        option-value-key="id"
        option-label-key="title"
      ></NcList>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scopped></style>
