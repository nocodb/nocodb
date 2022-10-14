<script lang="ts" setup>
import type { EdgeProps, Position } from '@vue-flow/core'
import { EdgeText, getBezierPath } from '@vue-flow/core'
import type { CSSProperties } from '@vue/runtime-dom'
import { computed, toRef } from '#imports'

interface RelationEdgeProps extends EdgeProps {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  data: {
    isManyToMany: boolean
    isSelfRelation: boolean
    label: string
  }
  markerEnd: string
  style: CSSProperties
  targetHandleId: string
}

const props = defineProps<RelationEdgeProps>()

const data = toRef(props, 'data')

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
</script>

<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>

<template>
  <path
    :id="id"
    :style="style"
    class="path-wrapper hover:!stroke-green-500 p-4 hover:cursor-pointer"
    :stroke-width="8"
    fill="none"
    :d="edgePath[0]"
    :marker-end="markerEnd"
  />

  <EdgeText
    v-if="data.label?.length > 0"
    :class="`nc-erd-table-label-${data.label.toLowerCase().replace(' ', '-').replace('\(', '').replace(')', '')}`"
    :x="edgePath[1]"
    :y="edgePath[2]"
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
    v-if="data.isManyToMany"
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
