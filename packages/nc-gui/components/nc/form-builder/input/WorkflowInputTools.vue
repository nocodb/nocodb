<script lang="ts"></script>

<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { HIGHLIGHT_COLORS } from '~/helpers/tiptap-markdown/extensions/marks/highlight'
import { TEXT_COLORS } from '~/helpers/tiptap-markdown/extensions/marks/textColor'
export interface WorkflowInputTool {
  key: string
  type?: 'color'
  icon?: IconMapKey
  label?: string
  isActive?: () => boolean
  action?: (event?: MouseEvent) => void
}

interface Props {
  editor: Editor
  groups: WorkflowInputTool[][]
}

const props = defineProps<Props>()

const colorOpen = ref(false)

const activeTextColor = computed(
  () => TEXT_COLORS.find((c) => props.editor.isActive('textColor', { color: c.color }))?.color ?? null,
)

const activeHighlight = computed(
  () => HIGHLIGHT_COLORS.find((c) => c.color && props.editor.isActive('highlight', { color: c.color }))?.color ?? null,
)

function applyTextColor(color: string) {
  const chain = props.editor.chain().focus()
  // "Default" means no mark at all — the email then inherits the client's text colour.
  if (color === TEXT_COLORS[0].color) chain.unsetTextColor().run()
  else chain.setTextColor({ color }).run()
}

function applyHighlight(color: string) {
  const chain = props.editor.chain().focus()
  if (!color) chain.unsetHighlight().run()
  else chain.setHighlight({ color }).run()
}
</script>

<template>
  <template v-for="(group, gi) in groups" :key="gi">
    <div v-if="gi > 0" class="nc-email-format-divider" />

    <template v-for="tool in group" :key="tool.key">
      <NcDropdown v-if="tool.type === 'color'" v-model:visible="colorOpen" placement="bottomLeft">
        <NcTooltip :title="$t('general.color')">
          <NcButton
            size="xs"
            type="text"
            class="nc-workflow-format-btn"
            :class="{ 'is-active': colorOpen || activeTextColor || activeHighlight }"
            data-testid="nc-workflow-richtext-color-btn"
            @mousedown.prevent
            @click.stop
          >
            <span
              class="nc-email-color-preview"
              :style="{
                color: activeTextColor || 'currentColor',
                backgroundColor: activeHighlight || 'transparent',
              }"
              >A</span
            >
          </NcButton>
        </NcTooltip>

        <template #overlay>
          <div class="nc-email-color-picker" @mousedown.prevent @click.stop>
            <div class="nc-email-color-label">{{ $t('labels.textColor') }}</div>
            <div class="nc-email-color-grid">
              <button
                v-for="c in TEXT_COLORS"
                :key="c.color"
                class="nc-email-color-swatch"
                :class="{ 'is-active': c.color !== TEXT_COLORS[0].color && activeTextColor === c.color }"
                :style="{ borderColor: `color-mix(in srgb, ${c.color} 30%, transparent)` }"
                :title="c.name"
                @click="applyTextColor(c.color)"
              >
                <span class="nc-email-color-swatch-letter" :style="{ color: c.color }">A</span>
              </button>
            </div>
            <div class="nc-email-color-label">{{ $t('labels.backgroundColor') }}</div>
            <div class="nc-email-color-grid">
              <button
                v-for="c in HIGHLIGHT_COLORS"
                :key="c.color || 'none'"
                class="nc-email-color-swatch"
                :class="{ 'is-active': c.color && activeHighlight === c.color, 'is-none': !c.color }"
                :style="c.color ? { backgroundColor: c.color, borderColor: c.color } : {}"
                :title="c.name"
                @click="applyHighlight(c.color)"
              />
            </div>
          </div>
        </template>
      </NcDropdown>

      <NcTooltip v-else :title="$t(tool.label!)">
        <NcButton
          size="xs"
          type="text"
          class="nc-workflow-format-btn"
          :class="{ 'is-active': tool.isActive?.() }"
          :data-testid="`nc-workflow-richtext-${tool.key}-btn`"
          @click.stop="tool.action"
        >
          <GeneralIcon :icon="tool.icon!" class="w-4 h-4" />
        </NcButton>
      </NcTooltip>
    </template>
  </template>
</template>

<style lang="scss">
.nc-email-color-preview {
  @apply flex items-center justify-center w-4.5 h-4.5 rounded text-[13px] font-bold leading-none;
}

// Overlay renders in body, so this stays unscoped.
.nc-email-color-picker {
  @apply p-3 rounded-lg bg-nc-bg-default border-1 border-nc-border-gray-medium;
  width: 196px;
  box-shadow: 0 8px 24px rgba(16, 16, 21, 0.12);

  .nc-email-color-label {
    @apply text-[11px] font-semibold text-nc-content-gray-subtle mb-1.5 mt-2.5;

    &:first-child {
      @apply mt-0;
    }
  }

  .nc-email-color-grid {
    @apply grid gap-2;
    grid-template-columns: repeat(5, 1fr);
  }

  .nc-email-color-swatch {
    @apply flex items-center justify-center w-7 h-7 p-0 rounded-md cursor-pointer bg-nc-bg-default;
    border: 1.5px solid var(--nc-border-gray-medium);
    transition: border-color 0.1s, transform 0.1s;

    &:hover {
      transform: scale(1.08);
      border-color: var(--nc-content-gray-subtle);
    }

    &.is-active {
      border-color: var(--nc-content-gray);
      border-width: 2px;
    }

    &.is-none {
      background: linear-gradient(
        to top left,
        transparent calc(50% - 1px),
        var(--nc-border-gray-medium) calc(50% - 1px),
        var(--nc-border-gray-medium) calc(50% + 1px),
        transparent calc(50% + 1px)
      );
    }
  }

  .nc-email-color-swatch-letter {
    @apply text-sm font-bold leading-none;
  }
}
</style>
