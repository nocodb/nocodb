<script lang="ts" setup>
interface Props {}

const props = withDefaults(defineProps<Props>(), {})

const {} = toRefs(props)
</script> 

<template>
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="audit" class="flex-none text-gray-700 text-[20px] h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('title.audits') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="nc-content-max-w p-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin"></div>
  </div>
</template>

<style lang="scss" scoped></style>
