<script setup>
import { EdgeText, getBezierCenter, getBezierPath, getEdgeCenter } from '@braks/vue-flow'
import { computed } from 'vue'

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  sourceX: {
    type: Number,
    required: true,
  },
  sourceY: {
    type: Number,
    required: true,
  },
  targetX: {
    type: Number,
    required: true,
  },
  targetY: {
    type: Number,
    required: true,
  },
  sourcePosition: {
    type: String,
    required: true,
  },
  targetPosition: {
    type: String,
    required: true,
  },
  data: {
    type: Object,
    required: false,
  },
  markerEnd: {
    type: String,
    required: false,
  },
  style: {
    type: Object,
    required: false,
  },
  sourceHandleId: {
    type: String,
    required: false,
  },
  targetHandleId: {
    type: String,
    required: false,
  },
})

const isHovered = ref(false)
const { column, relatedTable, table } = props.data

const edgePath = computed(() =>
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  }),
)

const center = computed(() =>
  getEdgeCenter({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  }),
)

watch(
  () => isHovered.value,
  (val) => {
    console.log(val)
  },
)
</script>

<script>
export default {
  inheritAttrs: false,
}
</script>

<template>
  <circle :cx="sourceX" :cy="sourceY" fill="#fff" :r="5" stroke="#6F3381" :stroke-width="1.5" />
  <path
    :id="id"
    :style="style"
    class="stroke-gray-500 p-4 hover:stroke-green-500 hover:cursor-pointer"
    :class="{ 'stroke-green-500': isHovered }"
    :stroke-width="2.5"
    fill="none"
    :d="edgePath"
    :marker-end="markerEnd"
    onmouseover="isHovered = true"
    onmouseout="isHovered = false"
  />
  <EdgeText
    :x="center[0]"
    :y="center[1]"
    label="Text"
    :label-style="{ fill: 'white' }"
    :label-show-bg="true"
    :label-bg-style="{ fill: '#10b981' }"
    :label-bg-padding="[2, 4]"
    :label-bg-border-radius="2"
  />
  <circle :cx="targetX" :cy="targetY" fill="#fff" :r="5" stroke="#6F3381" :stroke-width="1.5" />
</template>
