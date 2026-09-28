<script setup lang="ts">
// The base's chip at the head of a topbar breadcrumb: its icon with the
// environment dot, and the caret for the base switcher behind it. One component
// so every topbar reads the same and the icon never ships without its dot.

withDefaults(
  defineProps<{
    isOpen?: boolean
  }>(),
  { isOpen: false },
)

const { base, isSharedBase } = storeToRefs(useBase())

// Everywhere else the sidebar already names the base; a share has no sidebar, so
// there the chip has to say it.
const showTitle = computed(() => isSharedBase.value)
</script>

<template>
  <div
    class="rounded-lg h-8 px-2 flex items-center gap-1 min-w-0 cursor-pointer select-none font-weight-500 text-nc-content-gray-subtle hover:(bg-nc-bg-gray-light text-nc-content-gray-emphasis)"
    :class="{ 'bg-nc-bg-gray-light !text-nc-content-gray-emphasis': isOpen }"
    data-testid="nc-topbar-base-crumb"
  >
    <NcTooltip :disabled="showTitle || isOpen">
      <template #title>
        <span class="capitalize">
          {{ base?.title }}
        </span>
      </template>

      <SmartsheetTopbarBaseIcon grayscale />
    </NcTooltip>

    <NcTooltip
      v-if="showTitle"
      class="ml-1 truncate nc-active-base-title max-w-full !leading-5 !hidden lg:!block"
      show-on-truncate-only
      :disabled="isOpen"
    >
      <template #title>
        <span class="capitalize">
          {{ base?.title }}
        </span>
      </template>

      <span
        class="text-ellipsis capitalize"
        :style="{
          wordBreak: 'keep-all',
          whiteSpace: 'nowrap',
          display: 'inline',
        }"
      >
        {{ base?.title }}
      </span>
    </NcTooltip>

    <GeneralIcon
      icon="chevronDown"
      class="!text-current opacity-70 flex-none transform transition-transform duration-25 w-3.5 h-3.5"
      :class="{ '!rotate-180': isOpen }"
    />
  </div>
</template>
