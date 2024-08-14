<script lang="ts" setup>
const { activeTable, activeTables } = storeToRefs(useTablesStore())

const isOpen = ref<boolean>(false)

const handleNavigateToView = (id: string | number) => {}
</script>

<template>
  <div v-if="activeTable">
    <NcDropdown v-model:visible="isOpen">
      <slot />
      <template #overlay>
        <NcList
          v-model:open="isOpen"
          :value="activeTable.id"
          @update:value="handleNavigateToView"
          :list="activeTables"
          option-value-key="id"
          option-label-key="title"
        ></NcList>
      </template>
    </NcDropdown>
  </div>
</template>

<style lang="scss" scopped></style>
