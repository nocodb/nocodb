<script lang="ts" setup>
const props = defineProps<{
  sourceId: string
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const isOpen = useVModel(props, 'modelValue', emit)

const activeSourceId = computed(() => props.sourceId)
</script>

<template>
  <GeneralModal v-model:visible="isOpen" size="large">
    <div class="h-[80vh]">
      <LazyDashboardSettingsErd :source-id="activeSourceId" />
    </div>
  </GeneralModal>
</template>
