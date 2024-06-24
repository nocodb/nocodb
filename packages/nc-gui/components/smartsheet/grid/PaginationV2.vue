<script setup lang="ts">
const props = defineProps<{
  scrollLeft?: number
}>()

const scrollLeft = toRef(props, 'scrollLeft')

const containerElement = ref()

const { gridViewCols } = useViewColumnsOrThrow()

const fields = inject(FieldsInj, ref([]))

const visibleFields = computed(() => {
  return fields.value.map((field, index) => ({ field, index })).filter((f) => f.index !== 0)
})

watch(scrollLeft, (value) => {
  if (containerElement.value) {
    containerElement.value.scrollLeft = value
  }
})
</script>

<template>
  <div ref="containerElement" class="bg-gray-50 w-full pr-1 overflow-x-hidden no-scrollbar flex h-9">
    <div class="sticky flex bg-gray-50 left-0">
      <div class="min-w-16 max-w-16 h-full left-0 flex items-center justify-center">
        <NcTooltip>
          <template #title>
            Aggregation bar : Configure summary statistics such as sum, average, count, and more for fields.</template
          >
          <GeneralIcon icon="info" />
        </NcTooltip>
      </div>

      <div
        class="flex items-center hover:bg-gray-100 cursor-pointer text-gray-500 px-3 py-2"
        :style="{
          'min-width': `${Number(gridViewCols[fields[0].id]?.width.replace('px', ''))}px` || '180px',
          'max-width': `${Number(gridViewCols[fields[0].id]?.width.replace('px', ''))}px` || '180px',
          'width': `${Number(gridViewCols[fields[0].id]?.width.replace('px', ''))}px` || '180px',
        }"
      >
        {{ fields[0].title }}
      </div>
    </div>

    <div
      v-for="({ field }, index) in visibleFields"
      :key="index"
      class="flex items-center hover:bg-gray-100 cursor-pointer text-gray-500 transition-all transition-linear px-3 py-2"
      :style="{
        'min-width': `${Number(gridViewCols[field.id]?.width.replace('px', ''))}px` || '180px',
        'max-width': `${Number(gridViewCols[field.id]?.width.replace('px', ''))}px` || '180px',
        'width': `${Number(gridViewCols[field.id]?.width.replace('px', ''))}px` || '180px',
      }"
    >
      {{ field.title }}
    </div>
    <div class="!px-8 !w-8 h-1">‎</div>
  </div>
</template>

<style scoped lang="scss"></style>
