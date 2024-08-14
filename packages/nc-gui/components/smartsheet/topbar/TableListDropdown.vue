<script lang="ts" setup>
import type { TableType } from 'nocodb-sdk';

const { activeTable, activeTables } = storeToRefs(useTablesStore());

const {openTable} = useTablesStore()

const isOpen = ref<boolean>(false);

const handleNavigateToTable = (table: TableType) => {
 if(table?.id){
  openTable(table)
 }
}

</script>

<template>
    <NcDropdown v-model:visible="isOpen">
      <slot name="default" :isOpen="isOpen"></slot>
      <template #overlay>
        <NcList
          v-model:open="isOpen"
          :value="activeTable.id"
          @change="handleNavigateToTable"
          :list="activeTables"
          option-value-key="id"
          option-label-key="title"
        ></NcList>
      </template>
    </NcDropdown>
  
</template>

<style lang="scss" scopped></style>
