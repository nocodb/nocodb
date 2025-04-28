<script lang="ts" setup>
interface Props {
  title?: string
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['back'])

const { title } = toRefs(props)
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <div class="flex">
      <NcButton type="text" size="small" class="!px-3" inner-class="!gap-1" @click="emits('back')">
        <template #icon>
          <GeneralIcon icon="ncArrowLeft" class="h-4 w-4" />
        </template>
        <div>{{ $t('labels.back') }}</div>
      </NcButton>
    </div>

    <slot>
      <div class="flex-1 text-xl text-nc-content-gray-emphasis font-700 text-center">{{ title }}</div>
    </slot>

    <div class="hidden md:(flex invisible)">
      <NcButton type="text" size="small" inner-class="!gap-1" class="!text-nc-content-brand !hover:text-brand-600">
        <template #icon>
          <GeneralIcon icon="chevronLeft" class="h-4 w-4" />
        </template>
        <div>{{ $t('labels.back') }}</div>
      </NcButton>
    </div>
  </div>
</template>
