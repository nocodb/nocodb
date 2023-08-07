<script lang="ts" setup>
const props = defineProps<{
  trigger: Array<'click' | 'hover' | 'contextmenu'>
  visible: boolean
  overlayClassName?: string
}>()

const emits = defineEmits(['update:visible'])

const trigger = computed(() => props.trigger)

const overlayClassName = computed(() => props.overlayClassName)

const visible = useVModel(props, 'visible', emits)
</script>

<template>
  <a-dropdown
    v-model:visible="visible"
    :trigger="trigger"
    :overlay-class-name="overlayClassName ? `nc-dropdown ${overlayClassName}` : 'nc-dropdown'"
  >
    <slot />

    <template #overlay>
      <div class="bg-white rounded-2xl p-6 border-1 border-gray-100 shadow-md">
        <slot name="overlay" />
      </div>
    </template>
  </a-dropdown>
</template>
