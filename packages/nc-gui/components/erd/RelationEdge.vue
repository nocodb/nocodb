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
    color: string
  }
  style: CSSProperties
  selected?: boolean
  showSkeleton: boolean
  markerEnd: string
  events: EdgeProps['events']
}

const props = defineProps<RelationEdgeProps>()

const baseStroke = 2

const data = toRef(props, 'data')

const isHovering = ref(false)

const edgePath = computed(() => {
  if (data.value.isSelfRelation) {
    const { sourceX, sourceY, targetX, targetY } = props
    const radiusX = (sourceX - targetX) * 0.6
    const radiusY = 50
    return [`M ${sourceX} ${sourceY} A ${radiusX} ${radiusY} 0 1 0 ${targetX} ${targetY}`]
  }

  return getBezierPath({ ...props })
})

props.events?.mouseEnter?.(() => {
  isHovering.value = true
})

props.events?.mouseLeave?.(() => {
  isHovering.value = false
})
</script>

<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>

<template>
  <defs>
    <linearGradient id="linear-gradient" x1="-28.83" y1="770.92" x2="771.05" y2="-28.95" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#06b6d4" />
      <stop offset="0.18" stop-color="#155e75" />
      <stop offset="0.49" stop-color="#84cc16" />
      <stop offset="0.88" stop-color="#10b981" />
      <stop offset="0.99" stop-color="#047857" />
    </linearGradient>
  </defs>

  <path
    :id="id"
    class="opacity-100 hover:(opacity-0) stroke-slate-500"
    :class="selected ? 'opacity-0' : ''"
    :style="style"
    :stroke-width="showSkeleton ? baseStroke * 4 : baseStroke"
    fill="none"
    :d="edgePath[0]"
    :marker-end="showSkeleton ? markerEnd : ''"
  />

  <path
    class="opacity-0 hover:(opacity-100 transition-all duration-100 ease)"
    :class="selected ? 'opacity-100' : ''"
    style="stroke: url(#linear-gradient)"
    :stroke-width="(showSkeleton ? baseStroke * 12 : baseStroke * 8) / (isHovering || selected ? 2 : 1)"
    fill="none"
    :d="edgePath[0]"
    :marker-end="showSkeleton ? markerEnd : ''"
  />

  <path class="opacity-0" :stroke-width="showSkeleton ? baseStroke * 12 : baseStroke * 8" fill="none" :d="edgePath[0]" />

  <Transition name="layout">
    <EdgeText
      v-if="data.label?.length > 0 && isHovering"
      :key="`edge-text-${id}.${showSkeleton}`"
      :class="`nc-erd-table-label-${data.label.toLowerCase().replace(' ', '-').replace('\(', '').replace(')', '')}`"
      :x="edgePath[1]"
      :y="edgePath[2]"
      :label="data.label"
      :label-style="{ fill: 'white', fontSize: `${showSkeleton ? baseStroke * 2 : baseStroke / 2}rem` }"
      :label-show-bg="true"
      :label-bg-style="{ fill: data.color }"
      :label-bg-padding="[8, 6]"
      :label-bg-border-radius="2"
    />
  </Transition>

  <template v-if="!showSkeleton">
    <rect
      class="nc-erd-edge-rect"
      :x="sourceX"
      :y="sourceY - 4"
      :width="8"
      :height="8"
      fill="#fff"
      stroke="#6F3381"
      :stroke-width="2"
      :transform="`rotate(45,${sourceX + 2},${sourceY - 4})`"
    />

    <rect
      v-if="data.isManyToMany"
      class="nc-erd-edge-rect"
      :x="targetX"
      :y="targetY - 4"
      :width="8"
      :height="8"
      fill="#fff"
      stroke="#6F3381"
      :stroke-width="2"
      :transform="`rotate(45,${targetX + 2},${targetY - 4})`"
    />
    <circle v-else class="nc-erd-edge-circle" :cx="targetX" :cy="targetY" fill="#fff" :r="5" stroke="#6F3381" :stroke-width="2" />
  </template>
</template>
