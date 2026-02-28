<script lang="ts" setup>
const props = withDefaults(defineProps<{ visible: boolean; fileCount: number }>(), {
  visible: false,
  fileCount: 0,
})

const { t } = useI18n()

const dropZoneText = computed(() => {
  if (props.fileCount > 0) {
    return t('activity.dropToCreate', { count: props.fileCount })
  }
  return t('activity.dropToCreateRecords')
})
</script>

<template>
  <Transition name="slide-up">
    <div v-if="visible" class="nc-file-drop-zone" data-testid="nc-file-drop-zone">
      <div class="nc-file-drop-zone-content">
        <GeneralIcon icon="upload" class="nc-file-drop-zone-icon" />
        <span class="nc-file-drop-zone-text">{{ dropZoneText }}</span>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.nc-file-drop-zone {
  @apply absolute bottom-0 left-0 right-0 z-50;
  @apply flex items-center justify-center;
  @apply pointer-events-none;
  @apply bg-nc-bg-default rounded-lg m-2;
  min-height: 120px;
  border: 2px dashed rgb(var(--color-primary));
}

.nc-file-drop-zone-content {
  @apply flex flex-col items-center gap-2;
}

.nc-file-drop-zone-icon {
  @apply text-primary text-2xl;
}

.nc-file-drop-zone-text {
  @apply text-sm font-medium text-primary;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
