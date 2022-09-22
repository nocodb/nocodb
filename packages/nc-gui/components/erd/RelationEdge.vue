<script setup>
import { EdgeText, getBezierPath, getEdgeCenter } from '@braks/vue-flow'
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

const data = toRef(props, 'data')

const isManyToMany = computed(() => data.value.column?.colOptions?.type === 'mm')

const edgePath = computed(() => {
  if (data.value.isSelfRelation) {
    const { sourceX, sourceY, targetX, targetY } = props
    const radiusX = (sourceX - targetX) * 0.6
    const radiusY = 50
    return `M ${sourceX} ${sourceY} A ${radiusX} ${radiusY} 0 1 0 ${targetX} ${targetY}`
  }

  return getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  })
})

const center = computed(() =>
  getEdgeCenter({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
  }),
)
</script>

<script>
export default {
  inheritAttrs: false,
}
</script>

<template>
  <path
    :id="id"
    :style="style"
    class="path-wrapper p-4 hover:cursor-pointer"
    :stroke-width="8"
    fill="none"
    :d="edgePath"
    :marker-end="markerEnd"
  />

  <path
    :id="id"
    :style="style"
    class="path stroke-gray-500 hover:stroke-green-500 hover:cursor-pointer"
    :stroke-width="1.5"
    fill="none"
    :d="edgePath"
    :marker-end="markerEnd"
  />

  <EdgeText
    v-if="data.label?.length > 0"
    :class="`nc-erd-table-label-${data.label.toLowerCase().replace(' ', '-').replace('\(', '').replace(')', '')}`"
    :x="center[0]"
    :y="center[1]"
    :label="data.label"
    :label-style="{ fill: 'white' }"
    :label-show-bg="true"
    :label-bg-style="{ fill: '#10b981' }"
    :label-bg-padding="[2, 4]"
    :label-bg-border-radius="2"
  />

  <rect
    class="nc-erd-edge-rect"
    :x="sourceX"
    :y="sourceY - 4"
    width="8"
    height="8"
    fill="#fff"
    stroke="#6F3381"
    :stroke-width="1.5"
    :transform="`rotate(45,${sourceX + 2},${sourceY - 4})`"
  />

  <rect
    v-if="isManyToMany"
    class="nc-erd-edge-rect"
    :x="targetX"
    :y="targetY - 4"
    width="8"
    height="8"
    fill="#fff"
    stroke="#6F3381"
    :stroke-width="1.5"
    :transform="`rotate(45,${targetX + 2},${targetY - 4})`"
  />
  <circle v-else class="nc-erd-edge-circle" :cx="targetX" :cy="targetY" fill="#fff" :r="5" stroke="#6F3381" :stroke-width="1.5" />
</template>

<style scoped lang="scss">
.path-wrapper:hover + .path {
  @apply stroke-green-500;
  stroke-width: 2;
}
.path:hover {
  stroke-width: 2;
}
</style>
