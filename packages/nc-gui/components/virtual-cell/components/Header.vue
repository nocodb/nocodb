<script lang="ts" setup>
import OnetoOneIcon from '~icons/nc-icons/onetoone'
import InfoIcon from '~icons/nc-icons/info'
import FileIcon from '~icons/nc-icons/file'

import { iconMap } from '#imports'

const { relation, relatedTableTitle, displayValue, showHeader, tableTitle } = defineProps<{
  relation: string
  showHeader?: boolean
  tableTitle: string
  relatedTableTitle: string
  displayValue?: string
}>()

const { isMobileMode } = useGlobal()

const { t } = useI18n()

const relationMeta = computed(() => {
  if (relation === 'hm') {
    return {
      title: t('msg.hm.title'),
      icon: iconMap.hm,
      tooltip_desc: t('msg.hm.tooltip_desc'),
      tooltip_desc2: t('msg.hm.tooltip_desc2'),
    }
  } else if (relation === 'mm') {
    return {
      title: t('msg.mm.title'),
      icon: iconMap.mm,

      tooltip_desc: t('msg.mm.tooltip_desc'),
      tooltip_desc2: t('msg.mm.tooltip_desc2'),
    }
  } else if (relation === 'bt') {
    return {
      title: t('msg.bt.title'),
      icon: iconMap.bt,
      tooltip_desc: t('msg.bt.tooltip_desc'),
      tooltip_desc2: t('msg.bt.tooltip_desc2'),
    }
  } else {
    return {
      title: t('msg.oo.title'),
      icon: OnetoOneIcon,
      tooltip_desc: t('msg.oo.tooltip_desc'),
      tooltip_desc2: t('msg.oo.tooltip_desc2'),
    }
  }
})
</script>

<template>
  <div class="flex sm:justify-between relative pb-2 items-center">
    <div v-if="!isMobileMode" class="flex text-base font-bold justify-start items-center min-w-36">
      {{ showHeader ? 'Linked Records' : '' }}
    </div>
    <div class="flex flex-row sm:w-[calc(100%-16rem)] xs:w-full items-center justify-center gap-2 xs:(h-full)">
      <div class="flex sm:justify-end w-[calc(50%-1.5rem)] xs:(w-[calc(50%-1.5rem)] h-full)">
        <div
          class="flex max-w-full xs:w-full flex-shrink-0 xs:(h-full) rounded-md gap-1 text-brand-500 items-center bg-gray-100 px-2 py-1"
        >
          <FileIcon class="w-4 h-4 min-w-4" />
          <span class="truncate">
            {{ displayValue }}
          </span>
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
      <div class="flex justify-start xs:w-[calc(50%-1.5rem)] w-[calc(50%-1.5rem)] xs:justify-start">
        <div
          class="flex rounded-md max-w-full flex-shrink-0 gap-1 items-center px-2 py-1 xs:w-full overflow-hidden"
          :class="{
            '!bg-orange-50 !text-orange-500': relation === 'hm',
            '!bg-pink-50 !text-pink-500': relation === 'mm',
            '!bg-blue-50 !text-blue-500': relation === 'bt',
          }"
        >
          <MdiFileDocumentMultipleOutline
            class="w-4 h-4 min-w-4"
            :class="{
              '!text-orange-500': relation === 'hm',
              '!text-pink-500': relation === 'mm',
              '!text-blue-500': relation === 'bt',
            }"
          />
          <span class="truncate"> {{ relatedTableTitle }} Records </span>
        </div>
      </div>
    </div>
    <div v-if="!isMobileMode" class="flex flex-row justify-end w-36">
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
        <InfoIcon class="w-4 h-4" />
      </NcTooltip>
    </div>
  </div>
</template>
