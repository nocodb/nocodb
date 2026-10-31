<script lang="ts" setup>
import type { CmdCommand } from '~/lib/types'
import { cmdRowDomId } from '~/utils/commandPaletteUtils'

/** One palette row; shared by Cmd+K, Cmd+L and Cmd+J. */
const props = defineProps<{
  command: CmdCommand
  selected: boolean
  height: number
  /** In-place result of running the command (replaces the right-hand hints). */
  status?: { kind: 'pending' | 'success' | 'error'; text?: string }
  /** Number-key hint inside a submenu. */
  indexKey?: string
}>()

const emits = defineEmits<{
  hover: []
  select: []
}>()

// A palette opening under a resting pointer fires mousemove with no movement; that is not a hover.
function onMouseMove(e: MouseEvent) {
  if (props.command.disabled || (!e.movementX && !e.movementY)) return
  emits('hover')
}
</script>

<template>
  <div
    :id="cmdRowDomId(command.id)"
    class="nc-cmdk-row"
    :class="{
      'selected': selected && !command.disabled,
      'is-danger': command.danger || command.error,
      'is-disabled': command.disabled,
    }"
    :style="{ height: `${height}px` }"
    role="option"
    :aria-selected="selected && !command.disabled"
    :aria-disabled="command.disabled || undefined"
    :data-testid="`nc-cmdk-action-${command.id}`"
    @mousemove="onMouseMove"
    @click="!command.disabled && emits('select')"
  >
    <div class="nc-cmdk-row-inner">
      <div v-if="command.loading" class="h-4 w-4 flex-none flex items-center justify-center">
        <GeneralLoader size="small" />
      </div>
      <CmdKItemIcon v-else-if="command.icon" :icon="command.icon" class="flex-none" />
      <NcTooltip show-on-truncate-only class="truncate" :tooltip-style="{ zIndex: 1100 }">
        <template #title>{{ command.title }}</template>
        {{ command.title }}
      </NcTooltip>
      <span v-if="command.hint" class="text-bodySm text-nc-content-gray-muted truncate max-w-48">
        {{ command.hint }}
      </span>
      <Transition name="nc-cmdk-pop" mode="out-in">
        <div
          v-if="status"
          :key="status.kind"
          class="flex items-center gap-1.5 ml-auto pl-2 min-w-0 text-bodySm"
          :class="status.kind === 'error' ? 'text-nc-content-red-medium' : 'text-nc-content-brand'"
          data-testid="nc-cmdk-row-status"
        >
          <GeneralLoader v-if="status.kind === 'pending'" />
          <GeneralIcon v-else :icon="status.kind === 'error' ? 'ncAlertCircle' : 'ncCheck'" class="h-4 w-4 flex-none" />
          <NcTooltip v-if="status.text" show-on-truncate-only class="truncate max-w-64" :tooltip-style="{ zIndex: 1100 }">
            <template #title>{{ status.text }}</template>
            {{ status.text }}
          </NcTooltip>
        </div>
        <div v-else key="hints" class="flex items-center gap-2 ml-auto pl-2 flex-none">
          <span
            v-if="command.value"
            class="nc-cmdk-row-value text-bodyDefaultSm text-nc-content-gray-subtle truncate max-w-48"
            data-testid="nc-cmdk-row-value"
          >
            {{ command.value }}
          </span>
          <PaymentUpgradeBadge
            v-if="command.upgradeFeature"
            :feature="command.upgradeFeature"
            remove-click
            source="command-palette"
          />
          <GeneralIcon v-if="command.checked" icon="ncCheck" class="h-4 w-4 text-nc-content-brand" />
          <GeneralShortcutLabel v-if="indexKey" :keys="[indexKey]" class="text-nc-content-gray-muted" />
          <GeneralShortcutLabel v-else-if="command.shortcut" :keys="command.shortcut" class="text-nc-content-gray-muted" />
          <GeneralIcon v-if="command.children" icon="ncChevronRight" class="h-4 w-4 text-nc-content-gray-muted" />
          <GeneralIcon
            v-else-if="command.edit"
            icon="ncEdit"
            class="h-3.5 w-3.5 text-nc-content-gray-muted opacity-0 nc-cmdk-row-hover-icon"
          />
          <slot name="trailing" />
        </div>
      </Transition>
    </div>
  </div>
</template>
