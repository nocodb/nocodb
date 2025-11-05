<script setup lang="ts">
defineProps<{
  active: boolean
}>()

const emit = defineEmits(['click'])

const slots = defineSlots<{
  icon: () => any
  default: () => any
}>()

const handleClick = () => {
  emit('click')
}
</script>

<template>
  <Transition name="item-slide" appear>
    <div
      :class="{
        'bg-nc-bg-brand active': active,
        'hover:bg-nc-bg-gray-light': !active,
      }"
      class="px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 flex gap-3 items-center group"
      @click="handleClick"
    >
      <template v-if="slots.icon?.()">
        <div
          :key="active ? 'active' : 'inactive'"
          class="flex-shrink-0 text-nc-content-gray-subtle"
          :class="{
            'text-nc-content-brand': active,
          }"
        >
          <slot name="icon" />
        </div>
      </template>

      <div
        :class="{
          'text-nc-content-brand': active,
        }"
        class="nc-marketplace-sidebar-item-title text-nc-content-gray-subtle text-bodyDefaultSmBold transition-all duration-200"
      >
        <slot />
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.item-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.item-slide-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.group:hover {
  .nc-marketplace-sidebar-item-title {
    transform: translateX(2px);
  }
}
</style>
