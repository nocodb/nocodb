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
    <div class="flex flex-col">
      <GeneralIcon
        icon="arrowDropUp"
        class="text-sm mb-[-10px] text-[16px]"
        :class="{
          'text-primary': activeSort.field === field && activeSort.direction === 'asc',
        }"
      />
      <GeneralIcon
        icon="arrowDropDown"
        class="text-sm text-[16px]"
        :class="{
          'text-primary': activeSort.field === field && activeSort.direction === 'desc',
        }"
      />
    </div>
  </div>
</template>
