<script lang="ts" setup>
import HasManyIcon from '~icons/nc-icons/hasmany'
import ManytoManyIcon from '~icons/nc-icons/manytomany'
import OnetoOneIcon from '~icons/nc-icons/onetoone'
import BelongsToIcon from '~icons/nc-icons/belongsto'
import InfoIcon from '~icons/nc-icons/info'
import FileIcon from '~icons/nc-icons/file'

const { relation, relatedTableTitle, displayValue, showHeader, tableTitle } = defineProps<{
  relation: string
  showHeader?: boolean
  tableTitle: string
  relatedTableTitle: string
  displayValue?: string
}>()

const relationMeta = computed(() => {
  if (relation === 'hm') {
    return {
      title: 'Has Many Relation',
      icon: HasManyIcon,
      tooltip_desc: 'A single record from table ',
      tooltip_desc2: ' can be linked with a multiple records from table ',
    }
  } else if (relation === 'mm') {
    return {
      title: 'Many to Many Relation',
      icon: ManytoManyIcon,
      tooltip_desc: 'Multiple records from table ',
      tooltip_desc2: ' can be linked with multiple records from table ',
    }
  } else if (relation === 'bt') {
    return {
      title: 'Belongs to Relation',
      icon: BelongsToIcon,
      tooltip_desc: 'A single record from table ',
      tooltip_desc2: ' can be linked with a record from table ',
    }
  } else {
    return {
      title: 'One to One Relation',
      icon: OnetoOneIcon,
      tooltip_desc: 'A single record from table ',
      tooltip_desc2: ' can be linked with a single record from table ',
    }
  }
})
</script>

<template>
  <div class="flex justify-between relative pb-2 items-center">
    <span class="text-base font-bold flex mt-2 justify-center">
      {{ showHeader ? 'Linked Records' : '' }}
    </span>
    <div class="grid grid-cols-[1fr,auto,1fr] justify-center items-center gap-2 absolute inset-0 m-auto">
      <div class="flex justify-end">
        <div class="flex flex-shrink-0 rounded-md gap-1 text-brand-500 items-center bg-gray-100 px-2 py-1">
          <FileIcon class="w-4 h-4" />
          {{ displayValue }}
        </div>
      </div>
      <NcTooltip class="flex-shrink-0">
        <template #title> {{ relationMeta.title }} </template>
        <component
          :is="relationMeta.icon"
          class="w-7 h-7 p-1 rounded-md"
          :class="{
            '!bg-orange-500': relation === 'hm',
            '!bg-pink-500': relation === 'mm',
            '!bg-blue-500': relation === 'bt',
          }"
        />
      </NcTooltip>
      <div class="flex justify-start">
        <div
          class="flex rounded-md flex-shrink-0 gap-1 items-center px-2 py-1"
          :class="{
            '!bg-orange-50 !text-orange-500': relation === 'hm',
            '!bg-pink-50 !text-pink-500': relation === 'mm',
            '!bg-blue-50 !text-blue-500': relation === 'bt',
          }"
        >
          <MdiFileDocumentMultipleOutline
            class="w-4 h-4"
            :class="{
              '!text-orange-500': relation === 'hm',
              '!text-pink-500': relation === 'mm',
              '!text-blue-500': relation === 'bt',
            }"
          />
          {{ relatedTableTitle }} Records
        </div>
      </div>
    </div>
    <NcTooltip class="z-10" placement="bottom">
      <template #title>
        <div class="p-1">
          <h1 class="text-white font-bold">{{ relationMeta.title }}</h1>
          <div class="text-white">
            {{ relationMeta.tooltip_desc }}
            <span class="bg-gray-700 px-2 rounded-md">
              {{ tableTitle }}
            </span>
            {{ relationMeta.tooltip_desc2 }}
            <span class="bg-gray-700 px-2 rounded-md">
              {{ relatedTableTitle }}
            </span>
          </div>
        </div>
      </template>
      <InfoIcon class="w-4 h-4 mt-2" />
    </NcTooltip>
  </div>
</template>
