<script setup lang="ts">
const { header, field, toggleSort } = defineProps<{
  header: string
  activeSort: { field?: string; direction?: string }
  field: UsersSortType['field']
  toggleSort: Function
}>()
</script>

<template>
  <div class="flex items-center space-x-2 cursor-pointer text-gray-700" @click="toggleSort(field)">
    <span>
      {{ header }}
    </span>
    <div class="flex">
      <GeneralIcon
        v-if="activeSort.field === field"
        icon="chevronDown"
        class="flex-none"
        :class="{
          'transform rotate-180': activeSort.direction === 'asc',
        }"
      />
      <GeneralIcon v-else icon="chevronUpDown" class="flex-none" />
    </div>
  </div>
</template>
