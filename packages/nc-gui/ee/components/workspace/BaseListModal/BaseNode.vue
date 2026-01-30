<script lang="ts" setup>
const props = defineProps<{
  base: NcProject
  isStarred?: boolean
  isPrivate?: boolean
  isMarked?: boolean
  // Indicator icons - shown when base has attribute but displayed in another section
  showStarIndicator?: boolean
  showPrivateIndicator?: boolean
}>()

const emit = defineEmits<{
  select: [base: NcProject]
}>()

const iconColor = computed(() => parseProp(props.base.meta).iconColor)

const onSelect = () => {
  emit('select', props.base)
}
</script>

<template>
  <div
    :tabindex="0"
    class="nc-base-node group relative flex items-center gap-3 px-3 py-4 rounded-xl cursor-pointer border-1 transition-all border-nc-border-gray-medium hover:border-nc-border-gray-dark hover:shadow-sm"
    :class="{ 'is-marked': isMarked }"
    @click="onSelect"
    @keydown.enter.stop="onSelect"
  >
    <GeneralProjectIcon
      :color="iconColor"
      :managed-app="{
        managed_app_master: base.managed_app_master,
        managed_app_id: base.managed_app_id,
      }"
      class="flex-none"
    />
    <div class="flex-1 min-w-0">
      <div class="text-sm font-medium text-nc-content-gray-extreme truncate">
        {{ base.title }}
      </div>
    </div>

    <!-- Indicator icons when base has attribute but shown in another section -->
    <div v-if="showStarIndicator || showPrivateIndicator" class="flex items-center gap-1">
      <NcTooltip v-if="showStarIndicator" class="flex">
        <GeneralIcon icon="star" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />
        <template #title>{{ $t('general.starred') }}</template>
      </NcTooltip>
      <NcTooltip v-if="showPrivateIndicator" class="flex">
        <GeneralIcon icon="ncLock" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />
        <template #title>{{ $t('general.private') }}</template>
      </NcTooltip>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-base-node {
  @apply bg-white dark:bg-nc-bg-gray-light;

  &:hover {
    @apply bg-nc-bg-gray-light dark:bg-nc-bg-gray-medium;
  }

  &:focus-visible {
    @apply outline-none shadow-focus;
  }

  &.is-marked {
    @apply bg-nc-bg-gray-medium border-nc-border-brand;
  }
}
</style>
