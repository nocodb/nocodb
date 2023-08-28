<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    trigger?: Array<'click' | 'hover' | 'contextmenu'>
    visible?: boolean | undefined
    overlayClassName?: string | undefined
  }>(),
  {
    trigger: () => ['click'],
    visible: undefined,
    overlayClassName: undefined,
  },
)

const emits = defineEmits(['update:visible'])

const trigger = toRef(props, 'trigger')

const overlayClassName = toRef(props, 'overlayClassName')

const overlayClassNameComputed = computed(() => {
  let className = 'nc-dropdown bg-white rounded-lg border-1 border-gray-100 shadow-md overflow-hidden'
  if (overlayClassName.value) {
    className += ` ${overlayClassName.value}`
  }
  return className
})

const visible = useVModel(props, 'visible', emits)
</script>

<template>
  <a-dropdown
    :visible="visible"
    :trigger="trigger"
    :overlay-class-name="overlayClassNameComputed"
    @update:visible="visible !== undefined ? (visible = $event) : undefined"
  >
    <slot />

    <template #overlay>
      <slot name="overlay" />
    </template>
  </a-dropdown>
</template>
