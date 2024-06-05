<script lang="ts" setup>
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
      icon: iconMap.oneToOneSolid,
      tooltip_desc: t('msg.oo.tooltip_desc'),
      tooltip_desc2: t('msg.oo.tooltip_desc2'),
    }
  }
})
</script>

<template>
  <div
    class="flex-none flex rounded-md gap-1 items-center p-1 max-h-7"
    :class="{
      'bg-gray-200 text-gray-600': !linkedRecords,
      'bg-orange-100 text-orange-700': relation === 'hm' && linkedRecords,
      'bg-pink-100 text-pink-700': relation === 'mm' && linkedRecords,
      'bg-blue-100 text-blue-700': relation === 'bt' && linkedRecords,
      'bg-purple-100 text-purple-700': relation === 'oo' && linkedRecords,
    }"
  >
    <NcTooltip class="z-10 flex" placement="bottom">
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
        class="nc-relation-icon flex-none w-5 h-5 p-1 rounded-md"
        :class="{
          '!bg-orange-500': relation === 'hm',
          '!bg-pink-500': relation === 'mm',
          '!bg-purple-500 one-to-one': relation === 'oo',
          '!bg-blue-500': relation === 'bt',
        }"
      />
    </NcTooltip>

    <div class="leading-[20px]">
      {{ linkedRecords || 0 }} {{ $t('general.linked') }}
      {{ linkedRecords === 1 ? $t('objects.record') : $t('objects.records') }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-relation-icon.one-to-one path) {
  @apply stroke-purple-50;
}
</style>
