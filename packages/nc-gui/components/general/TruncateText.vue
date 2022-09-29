<script lang="ts" setup>
interface Props {
  placement?:
    | 'top'
    | 'left'
    | 'right'
    | 'bottom'
    | 'topLeft'
    | 'topRight'
    | 'bottomLeft'
    | 'bottomRight'
    | 'leftTop'
    | 'leftBottom'
    | 'rightTop'
    | 'rightBottom'
  length?: number
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'bottom',
  length: 20,
})

const text = ref()
const enableTooltip = computed(() => text?.value?.textContent.length > props.length)
const shortName = computed(() =>
  text?.value?.textContent.length > props.length
    ? `${text?.value?.textContent.substr(0, props.length - 3)}...`
    : text?.value?.textContent,
)
</script>

<template>
  <a-tooltip v-if="enableTooltip" :placement="props.placement">
    <template #title>
      <slot></slot>
    </template>
    <div>{{ shortName }}</div>
  </a-tooltip>
  <div v-else><slot></slot></div>
  <div ref="text" class="hidden"><slot></slot></div>
</template>

<style scoped></style>
