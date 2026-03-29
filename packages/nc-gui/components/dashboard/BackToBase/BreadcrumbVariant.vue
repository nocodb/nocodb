<!-- Back to Base: breadcrumb variant.
     Full-width bar rendered between the breadcrumb row and the page tabs.
     Only visible when shouldShow is true and variant is 'breadcrumb'. -->
<script lang="ts" setup>
interface Props {
  disableTransition?: boolean
}

withDefaults(defineProps<Props>(), {
  disableTransition: true,
})

const { shouldShow, navigateToBase, lastVisitedBase } = useBackToBase()
</script>

<template>
  <Transition :name="disableTransition ? '' : 'nc-btb-bc'">
    <div
      v-if="shouldShow"
      class="nc-btb-bar w-full flex items-center gap-2 pl-3 pr-4 h-9 border-b-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight cursor-pointer select-none group hover:bg-nc-bg-brand-light transition-colors duration-150"
      data-testid="nc-btb-bar"
      @click="navigateToBase"
    >
      <GeneralIcon
        icon="chevronLeft"
        class="flex-none h-4 w-4 text-nc-content-gray-muted group-hover:text-nc-content-brand transition-colors duration-150"
      />
      <span
        class="text-small font-medium text-nc-content-gray-subtle group-hover:text-nc-content-brand transition-colors duration-150 whitespace-nowrap"
      >
        {{ $t('labels.backToBase') }}
      </span>
      <template v-if="lastVisitedBase?.title">
        <span class="text-nc-content-gray-muted group-hover:text-nc-content-brand transition-colors duration-150">-</span>
        <span
          class="text-small font-semibold text-nc-content-gray group-hover:text-nc-content-brand transition-colors duration-150 truncate"
        >
          {{ lastVisitedBase.title }}
        </span>
      </template>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.nc-btb-bc-enter-active,
.nc-btb-bc-leave-active {
  transition: opacity 0.15s ease, max-height 0.15s ease;
  max-height: 2.25rem; /* h-9 */
  overflow: hidden;
}
.nc-btb-bc-enter-from,
.nc-btb-bc-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
