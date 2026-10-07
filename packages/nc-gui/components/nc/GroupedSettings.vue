<script setup lang="ts">
const props = defineProps<{
  title?: string
  defaultCollapsed?: boolean
}>()

const isOpen = ref(!props.defaultCollapsed)
</script>

<template>
  <div class="grouped-settings flex flex-col" :class="{ isOpen }">
    <header class="flex justify-between items-center cursor-pointer" @click="isOpen = !isOpen">
      <slot name="title">
        <span>{{ title }}</span>
      </slot>
      <NcButton size="xsmall" type="text" class="!w-7 !h-7" @click.stop="isOpen = !isOpen">
        <GeneralIcon icon="ncChevronDown" class="w-4 h-4 transition-transform duration-200" :class="{ 'rotate-180': isOpen }" />
      </NcButton>
    </header>
    <Transition name="grouped-settings-body">
      <div v-if="isOpen" class="grouped-settings-body">
        <div class="flex flex-col gap-4 pt-4 min-h-0">
          <slot></slot>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.grouped-settings {
  @apply py-3.5 px-5 border-b-1 border-nc-border-gray-light;
  header > span {
    @apply text-captionBold text-nc-content-gray-emphasis;
  }
}

// Animates height without measuring it: the row grows from 0fr to 1fr.
.grouped-settings-body {
  display: grid;
  grid-template-rows: 1fr;
}

.grouped-settings-body-enter-active,
.grouped-settings-body-leave-active {
  transition: grid-template-rows 0.2s ease, opacity 0.2s ease;
  // Only while animating, so focus rings and popovers aren't clipped at rest.
  > div {
    overflow: hidden;
  }
}

.grouped-settings-body-enter-from,
.grouped-settings-body-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .grouped-settings-body-enter-active,
  .grouped-settings-body-leave-active {
    transition: none;
  }
}
</style>
