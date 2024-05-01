<script lang="ts" setup>
import OnetoOneIcon from '~icons/nc-icons/onetoone'

import { iconMap } from '#imports'

const {
  relation,
  relatedTableTitle,
  tableTitle,
  linkedRecords = 0,
} = defineProps<{
  relation: string
  header?: string | null
  tableTitle: string
  relatedTableTitle: string
  displayValue?: string
  linkedRecords?: number
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
    <div class="flex flex-row sm:w-[calc(100%-16rem)] xs:w-full items-center justify-center gap-2 xs:(h-full)">
      <div class="flex justify-start xs:w-[calc(50%-1.5rem)] w-[calc(50%-1.5rem)] xs:justify-start">
        <div
          class="flex rounded-md max-w-full flex-shrink-0 gap-1 items-center px-2 py-1 xs:w-full overflow-hidden"
          :class="{
            '!bg-orange-50 !text-orange-500': relation === 'hm',
            '!bg-pink-50 !text-pink-500': relation === 'mm',
            '!bg-blue-50 !text-blue-500': relation === 'bt',
          }"
        >
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

          <div class="">
            {{ linkedRecords || 0 }} {{ $t('general.linked') }}
            {{ linkedRecords === 1 ? $t('objects.record') : $t('objects.records') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
