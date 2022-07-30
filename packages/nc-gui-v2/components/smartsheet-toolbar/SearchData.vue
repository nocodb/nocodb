<script lang="ts" setup>
import { useProvideSmartsheetStore, useSmartsheetStoreOrThrow } from '~/composables/useSmartsheetStore'
import { MetaInj, ReloadViewDataHookInj, SearchFieldAndQueryCbkInj } from '~/context'

const reloadData = inject(ReloadViewDataHookInj)
const { search, meta } = useSmartsheetStoreOrThrow()

const columns = computed(() =>
  meta?.value?.columns?.map((c) => ({
    value: c.id,
    label: c.title,
  })),
)
</script>

<template>
  <a-input
    v-model:value="search.value"
    size="small"
    class="max-w-[250px]"
    placeholder="Filter query"
    @pressEnter="reloadData.trigger()"
  >
    <template #addonBefore>
      <a-select v-model:value="search.field" :options="columns" style="width: 80px" class="!text-xs" size="small" />
    </template>
  </a-input>
</template>

<style scoped></style>
