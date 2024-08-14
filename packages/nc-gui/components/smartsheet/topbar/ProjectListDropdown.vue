<script lang="ts" setup>
const { activeTable, activeTables } = storeToRefs(useTablesStore());

const isOpen = ref<boolean>(false);
</script>

<template>
  <div v-if="activeTable">
    <NcDropdown v-model:visible="isOpen">
      <slot />
      <template #overlay>
        <NcList
          v-model:open="isOpen"
          v-model:value="activeTable.id"
          :list="activeTables"
          option-value-key="id"
          option-label-key="title"
        ></NcList>
      </template>
    </NcDropdown>
  </div>
</template>

<style lang="scss" scopped></style>
