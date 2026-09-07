<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { EMAIL_FONTS } from '~/helpers/tiptap-markdown/extensions/marks/fontFamily'
import { EMAIL_FONT_SIZES } from '~/helpers/tiptap-markdown/extensions/marks/fontSize'
import { HIGHLIGHT_COLORS } from '~/helpers/tiptap-markdown/extensions/marks/highlight'
import { TEXT_COLORS } from '~/helpers/tiptap-markdown/extensions/marks/textColor'
import type { EmailTextAlign } from '~/helpers/tiptap-markdown/extensions/textAlign'
export interface WorkflowInputTool {
  key: string
  type?: 'color' | 'typography' | 'align'
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

// The email body's ink. Highlight pastels are picked against it, so the preview must not
// fall back to theme text, which goes light in dark mode and vanishes on the swatch.
const EMAIL_INK = '#1f293a'

const colorOpen = ref(false)

const typographyOpen = ref(false)

const alignOpen = ref(false)

const ALIGNMENTS: { value: EmailTextAlign; icon: IconMapKey; label: string }[] = [
  { value: 'left', icon: 'lucideAlignLeft', label: 'labels.alignLeft' },
  { value: 'center', icon: 'lucideAlignCenter', label: 'labels.alignCenter' },
  { value: 'right', icon: 'lucideAlignRight', label: 'labels.alignRight' },
  { value: 'justify', icon: 'lucideAlignJustify', label: 'labels.justify' },
]

const activeTextColor = computed(
  () => TEXT_COLORS.find((c) => props.editor.isActive('textColor', { color: c.color }))?.color ?? null,
)

const activeHighlight = computed(
  () => HIGHLIGHT_COLORS.find((c) => c.color && props.editor.isActive('highlight', { color: c.color }))?.color ?? null,
)

const activeFont = computed(() => props.editor.getAttributes('textStyle').fontFamily ?? '')

const activeSize = computed(() => props.editor.getAttributes('textStyle').fontSize ?? '')

// Fonts pasted in from elsewhere won't be in the list; show them as the default rather than nothing.
const activeFontName = computed(() => EMAIL_FONTS.find((f) => f.value === activeFont.value)?.name ?? EMAIL_FONTS[0].name)

const activeAlign = computed<EmailTextAlign>(
  () => ALIGNMENTS.find((a) => a.value !== 'left' && props.editor.isActive({ textAlign: a.value }))?.value ?? 'left',
)

const activeAlignIcon = computed(() => ALIGNMENTS.find((a) => a.value === activeAlign.value)!.icon)

function applyFont(value: string) {
  const chain = props.editor.chain().focus()
  if (value) chain.setFontFamily(value).run()
  else chain.unsetFontFamily().run()
}

function applySize(value: string) {
  const chain = props.editor.chain().focus()
  if (value) chain.setFontSize(value).run()
  else chain.unsetFontSize().run()
}

function applyAlign(value: EmailTextAlign) {
  const chain = props.editor.chain().focus()
  if (value === 'left') chain.unsetTextAlign().run()
  else chain.setTextAlign(value).run()
  alignOpen.value = false
}

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
        <NcTooltip :title="$t('labels.textAndBackgroundColor')">
          <NcButton
            size="xs"
            type="text"
            class="nc-workflow-format-btn"
            :class="{ 'is-active': colorOpen || activeTextColor || activeHighlight }"
            data-testid="nc-workflow-richtext-color-btn"
            @mousedown.prevent
            @click.stop="colorOpen = !colorOpen"
          >
            <span class="nc-email-color-preview">
              <span
                class="nc-email-color-preview-letter"
                :style="{
                  color: activeTextColor || (activeHighlight ? EMAIL_INK : 'currentColor'),
                  backgroundColor: activeHighlight || 'transparent',
                }"
                >A</span
              >
              <span class="nc-email-color-preview-bar" :style="{ backgroundColor: activeTextColor || 'currentColor' }" />
            </span>
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
                :style="{ '--nc-swatch-tint': `color-mix(in srgb, ${c.color} 30%, transparent)` }"
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
                :style="c.color ? { 'backgroundColor': c.color, '--nc-swatch-tint': c.color } : {}"
                :title="c.name"
                @click="applyHighlight(c.color)"
              />
            </div>
          </div>
        </template>
      </NcDropdown>

      <NcDropdown v-else-if="tool.type === 'typography'" v-model:visible="typographyOpen" placement="bottomLeft">
        <NcTooltip :title="$t('labels.font')">
          <NcButton
            size="xs"
            type="text"
            class="nc-workflow-format-btn nc-email-typo-btn"
            :class="{ 'is-active': typographyOpen || activeFont || activeSize }"
            data-testid="nc-workflow-richtext-typography-btn"
            @mousedown.prevent
            @click.stop="typographyOpen = !typographyOpen"
          >
            <!-- The current font, set in itself — the clearest label a font control can have -->
            <span class="nc-email-typo-name" :style="{ fontFamily: activeFont || undefined }">{{ activeFontName }}</span>
            <GeneralIcon icon="ncChevronDown" class="w-3.5 h-3.5 flex-none text-nc-content-gray-muted" />
          </NcButton>
        </NcTooltip>

        <template #overlay>
          <div class="nc-email-typo-picker" @mousedown.prevent @click.stop>
            <div class="nc-email-typo-col">
              <button
                v-for="f in EMAIL_FONTS"
                :key="f.name"
                class="nc-email-typo-item"
                :class="{ 'is-active': activeFont === f.value }"
                :style="f.value ? { fontFamily: f.value } : {}"
                @click="applyFont(f.value)"
              >
                {{ f.name }}
              </button>
            </div>
            <div class="nc-email-typo-col is-sizes">
              <button
                v-for="sz in EMAIL_FONT_SIZES"
                :key="sz.name"
                class="nc-email-typo-item"
                :class="{ 'is-active': activeSize === sz.value }"
                :style="{ fontSize: sz.value || undefined, fontFamily: activeFont || undefined }"
                @click="applySize(sz.value)"
              >
                {{ $t(sz.name) }}
              </button>
            </div>
          </div>
        </template>
      </NcDropdown>

      <NcDropdown v-else-if="tool.type === 'align'" v-model:visible="alignOpen" placement="bottomLeft">
        <NcTooltip :title="$t('labels.textAlign')">
          <NcButton
            size="xs"
            type="text"
            class="nc-workflow-format-btn"
            :class="{ 'is-active': alignOpen || activeAlign !== 'left' }"
            data-testid="nc-workflow-richtext-align-btn"
            @mousedown.prevent
            @click.stop="alignOpen = !alignOpen"
          >
            <GeneralIcon :icon="activeAlignIcon" class="w-4 h-4" />
          </NcButton>
        </NcTooltip>

        <template #overlay>
          <div class="nc-email-align-picker" @mousedown.prevent @click.stop>
            <NcTooltip v-for="a in ALIGNMENTS" :key="a.value" :title="$t(a.label)">
              <NcButton
                size="xs"
                type="text"
                class="nc-workflow-format-btn"
                :class="{ 'is-active': activeAlign === a.value }"
                @click="applyAlign(a.value)"
              >
                <GeneralIcon :icon="a.icon" class="w-4 h-4" />
              </NcButton>
            </NcTooltip>
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
.nc-email-typo-btn {
  @apply !w-auto !px-2 gap-1;

  .nc-email-typo-name {
    @apply whitespace-nowrap max-w-28 truncate;
    font-size: 13px;
  }
}

// "A" over a colour bar — the mail-client convention for a text/background colour control.
.nc-email-color-preview {
  @apply flex flex-col items-center justify-center w-5 h-5 gap-0.5;

  .nc-email-color-preview-letter {
    @apply flex items-center justify-center px-0.5 rounded-sm text-[13px] font-bold leading-none;
  }

  .nc-email-color-preview-bar {
    @apply block w-3.5;
    height: 1px;
  }
}

// Overlays render in body, so these stay unscoped.
.nc-email-typo-picker {
  @apply flex gap-3 p-3 rounded-lg bg-nc-bg-default border-1 border-nc-border-gray-medium;
  box-shadow: 0 8px 24px rgba(16, 16, 21, 0.12);

  .nc-email-typo-col {
    @apply flex flex-col gap-0.5 w-40;

    &.is-sizes {
      @apply w-24 border-l-1 border-nc-border-gray-light pl-3;
    }
  }

  .nc-email-typo-item {
    @apply flex items-center h-7.5 px-2 rounded-md cursor-pointer text-left whitespace-nowrap;
    @apply bg-transparent border-0 text-nc-content-gray;
    font-size: 13px;

    &:hover {
      @apply bg-nc-bg-gray-light;
    }

    &.is-active {
      @apply bg-nc-bg-brand text-nc-content-brand;
    }
  }
}

.nc-email-align-picker {
  @apply flex items-center gap-0.5 p-1 rounded-lg bg-nc-bg-default border-1 border-nc-border-gray-medium;
  box-shadow: 0 8px 24px rgba(16, 16, 21, 0.12);

  .nc-workflow-format-btn.is-active {
    @apply bg-nc-bg-gray-light text-nc-content-brand;
  }
}

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
    @apply flex items-center justify-center w-7 h-7 p-0 rounded-md cursor-pointer;
    // The palette is absolute email hex on the mail's white body. Following the theme surface
    // here would hide the dark inks in dark mode, so the swatch face stays white in both.
    background-color: #fff;
    border: 1.5px solid var(--nc-swatch-tint, var(--nc-border-gray-medium));
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
      background-image: linear-gradient(
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
