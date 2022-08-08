<script lang="ts" setup>
import { computed, inject, ref, useSmartsheetStoreOrThrow } from '#imports'
import { ReloadViewDataHookInj } from '~/context'

const reloadData = inject(ReloadViewDataHookInj)!

const { search, meta } = useSmartsheetStoreOrThrow()

// todo: where is this value supposed to come from? it's not in the store
const isDropdownOpen = ref(false)

const columns = computed(() =>
  meta.value?.columns?.map((c) => ({
    value: c.id,
    label: c.title,
  })),
)
</script>

<template>
  <a-input
    v-model:value="search.query"
    size="small"
    class="max-w-[200px]"
    placeholder="Filter query"
    @press-enter="reloadData.trigger(null)"
  >
    <template #addonBefore>
      <div class="flex align-center relative" @click="isDropdownOpen = true">
        <MdiMagnify class="text-grey" />
        <MdiMenuDown class="text-grey" />

        <a-select
          v-model:value="search.field"
          size="small"
          :dropdown-match-select-width="false"
          :options="columns"
          class="!absolute top-0 left-0 w-full h-full z-10 !text-xs opacity-0"
        >
        </a-select>
      </div>
    </template>
  </a-input>
</template>
