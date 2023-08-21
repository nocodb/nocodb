<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    trigger: Array<'click' | 'hover' | 'contextmenu'>
    visible: boolean | undefined
    overlayClassName?: string | undefined
  }>(),
  {
    trigger: () => ['click'],
    visible: undefined,
    overlayClassName: undefined,
  },
)

const emits = defineEmits(['update:visible'])

const trigger = computed(() => props.trigger)

const overlayClassName = computed(() => props.overlayClassName)

const visible = useVModel(props, 'visible', emits)
</script>

<template>
  <a-dropdown
    :visible="visible"
    :trigger="trigger"
    :overlay-class-name="{
      'nc-dropdown bg-white rounded-2xl border-1 border-gray-100 shadow-md overflow-hidden': true,
      [overlayClassName as any]: !!overlayClassName,
    } as any"
    @update:visible="visible !== undefined ? (visible = $event) : undefined"
  >
    <slot />

    <template #overlay>
      <slot name="overlay" />
    </template>
  </a-dropdown>
</template>
