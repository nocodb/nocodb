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
  open: []
}>()

/** `text` split around each case-insensitive occurrence of the command's `highlight`. */
function markParts(text: string) {
  const needle = props.command.highlight?.trim().toLowerCase()
  if (!needle) return [{ text, hit: false }]

  const parts: { text: string; hit: boolean }[] = []
  const lower = text.toLowerCase()
  let from = 0
  for (let at = lower.indexOf(needle); at > -1; at = lower.indexOf(needle, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), hit: false })
    parts.push({ text: text.slice(at, at + needle.length), hit: true })
    from = at + needle.length
  }
  if (from < text.length) parts.push({ text: text.slice(from), hit: false })
  return parts
}

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
      'is-loading': command.loading,
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
      <div v-if="command.loading" class="h-4 w-4 flex-none flex items-center justify-center text-nc-content-brand">
        <GeneralLoader size="medium" />
      </div>
      <CmdKItemIcon
        v-else-if="command.icon"
        :icon="command.icon"
        class="flex-none"
        :class="{ 'self-start mt-0.5': command.snippet }"
      />
      <div v-if="command.snippet" class="flex flex-col gap-0.5 min-w-0 flex-1" data-testid="nc-cmdk-row-snippet">
        <div class="flex items-center gap-2 min-w-0">
          <span class="truncate">
            <template v-for="(part, i) of markParts(command.title)" :key="i">
              <mark v-if="part.hit" class="nc-cmdk-mark">{{ part.text }}</mark>
              <template v-else>{{ part.text }}</template>
            </template>
          </span>
          <span v-if="command.hint" class="text-bodySm text-nc-content-gray-muted truncate max-w-48">
            {{ command.hint }}
          </span>
        </div>
        <div class="text-bodySm text-nc-content-gray-subtle2 truncate">
          <template v-for="(part, i) of markParts(command.snippet)" :key="i">
            <mark v-if="part.hit" class="nc-cmdk-mark">{{ part.text }}</mark>
            <template v-else>{{ part.text }}</template>
          </template>
        </div>
      </div>
      <template v-else>
        <NcTooltip show-on-truncate-only class="truncate" :tooltip-style="{ zIndex: 1100 }">
          <template #title>{{ command.title }}</template>
          <template v-if="command.highlight">
            <template v-for="(part, i) of markParts(command.title)" :key="i">
              <mark v-if="part.hit" class="nc-cmdk-mark">{{ part.text }}</mark>
              <template v-else>{{ part.text }}</template>
            </template>
          </template>
          <template v-else>{{ command.title }}</template>
        </NcTooltip>
        <span v-if="command.hint" class="text-bodySm text-nc-content-gray-muted truncate max-w-48">
          {{ command.hint }}
        </span>
      </template>
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
        <!-- Short of room, the value truncates well before the title does (it shrinks 4x as fast). -->
        <div v-else key="hints" class="flex items-center gap-2 ml-auto pl-2 min-w-0 flex-shrink-[4] children:flex-none">
          <NcTooltip
            v-if="command.value"
            show-on-truncate-only
            class="nc-cmdk-row-value text-bodyDefaultSm text-nc-content-gray-subtle truncate min-w-0 max-w-80 !flex-shrink"
            :tooltip-style="{ zIndex: 1100 }"
          >
            <template #title>{{ command.value }}</template>
            <span data-testid="nc-cmdk-row-value">{{ command.value }}</span>
          </NcTooltip>
          <PaymentUpgradeBadge
            v-if="command.upgradeFeature"
            :feature="command.upgradeFeature"
            remove-click
            source="command-palette"
          />
          <GeneralIcon
            v-if="command.checked"
            icon="ncCheck"
            class="h-4 w-4 text-nc-content-brand"
            data-testid="nc-cmdk-row-checked"
          />
          <GeneralShortcutLabel v-if="indexKey" :keys="[indexKey]" class="text-nc-content-gray-muted" />
          <GeneralShortcutLabel v-else-if="command.shortcut" :keys="command.shortcut" class="text-nc-content-gray-muted" />
          <template v-if="command.children && command.runFirst && command.run">
            <GeneralShortcutLabel v-if="selected" :keys="['ArrowRight']" class="text-nc-content-gray-muted" />
            <NcButton
              type="text"
              size="xxsmall"
              class="!px-0.5"
              data-testid="nc-cmdk-row-open"
              @click.stop="!command.disabled && emits('open')"
            >
              <GeneralIcon icon="ncChevronRight" class="h-4 w-4 text-nc-content-gray-muted" />
            </NcButton>
          </template>
          <GeneralIcon v-else-if="command.children" icon="ncChevronRight" class="h-4 w-4 text-nc-content-gray-muted" />
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
