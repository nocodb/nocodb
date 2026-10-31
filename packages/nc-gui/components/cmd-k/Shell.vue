<script lang="ts" setup>
import type { CommandPaletteType } from '~/lib/types'

/** Modal frame shared by Cmd+K, Cmd+L and Cmd+J: backdrop, motion, click-outside and footer. */
const props = defineProps<{
  open: boolean
  activeCmd: CommandPaletteType
  setActiveCmdView: (cmd: CommandPaletteType) => void
  /** Extra classes on the backdrop, kept for tests (`cmdl-modal`, `cmdj-modal`). */
  modalClass?: string
}>()

const emits = defineEmits(['update:open'])

const vOpen = useVModel(props, 'open', emits)

const contentEl = ref<HTMLElement>()

onClickOutside(contentEl, () => {
  if (vOpen.value) vOpen.value = false
})
</script>

<template>
  <Transition name="nc-cmdk-modal">
    <div v-if="vOpen" class="cmdk-modal cmdk-modal-active" :class="modalClass">
      <div
        ref="contentEl"
        class="cmdk-modal-content nc-cmdk"
        role="dialog"
        aria-modal="true"
        :aria-label="
          $t(activeCmd === 'cmd-j' ? 'objects.document' : activeCmd === 'cmd-l' ? 'labels.recent' : 'labels.quickNavigation')
        "
      >
        <div class="nc-cmdk-header">
          <slot name="header" />
        </div>
        <div class="nc-cmdk-body">
          <slot />
        </div>
        <CmdFooter :active-cmd="activeCmd" :set-active-cmd-view="setActiveCmdView" />
      </div>
    </div>
  </Transition>
</template>

<style lang="scss">
.cmdk-modal {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.35);
  z-index: 1100;

  // 35% black does not dim an already dark page.
  .dark & {
    background-color: rgba(0, 0, 0, 0.6);
  }
  color: var(--nc-content-gray);
  font-size: 16px;

  // Short and decelerating: the palette should feel instant, the motion only orients.
  --nc-cmdk-ease: cubic-bezier(0.2, 0, 0, 1);

  .cmdk-modal-content {
    @apply dark:(border-1 border-nc-border-gray-medium);

    position: relative;
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
    margin: auto;
    top: 16%;
    border-radius: 12px;
    max-width: min(640px, calc(100vw - 32px));
    // One size for Cmd+K, L and J whatever they show; the body flexes to fill it.
    height: min(460px, calc(100vh - 20vh - 32px));
    background: var(--nc-bg-elevated);
    box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.04);

    .dark & {
      box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.7);
    }
  }

  .cmdk-input {
    @apply min-w-0;
    flex-grow: 1;
    margin: 0;
    padding: 0;
    border: none;
    appearance: none;
    background: transparent;
    outline: none;
    font-size: 15px;
    line-height: 22px;
    box-shadow: var(--un-ring-inset) 0 0 0 calc(0px + var(--un-ring-offset-width)) var(--un-ring-color) !important;
    caret-color: var(--nc-brand-accent);
    color: var(--nc-content-gray);

    &::placeholder {
      color: var(--nc-content-gray-muted);
      opacity: 1;
    }
  }

  .cmdk-footer {
    @apply dark:!text-nc-content-gray-subtle2;

    display: flex;
    border-top: 1px solid var(--nc-border-gray-medium);
    font-size: 0.8em;
    padding: 0 0.6em;
    color: var(--nc-content-gray-subtle2);
  }
}

.nc-cmdk {
  // In flow, so the footer never covers the list.
  .cmdk-footer {
    @apply static;
  }

  .nc-cmdk-header {
    @apply border-b-1 border-nc-border-gray-medium flex-none;
  }

  .nc-cmdk-body {
    @apply flex-1 min-h-0 flex flex-col;

    > *,
    .cmdk-body > * {
      @apply flex-1 min-h-0;
    }

    .cmdk-body {
      @apply flex flex-col;
    }
  }

  .nc-cmdk-input-row {
    @apply flex items-center gap-3 px-4 py-3.5;
  }

  .nc-cmdk-input-icon {
    @apply h-4 w-4 flex-none text-nc-content-gray-muted;
  }

  .nc-cmdk-textarea {
    resize: none;
  }

  .nc-cmdk-edit-body {
    @apply flex flex-col gap-2 px-4 py-3;
  }

  // Compose area: the text fills the palette, status and hints sit at its foot.
  .nc-cmdk-edit-body--multiline {
    @apply flex-1 min-h-0 py-0 pb-3;
  }

  .nc-cmdk-compose {
    @apply flex-1 min-h-0 flex items-start gap-3 pt-3;

    .nc-cmdk-textarea {
      @apply h-full;
    }
  }

  .cmdk-actions {
    @apply px-2 py-1;
    overflow: auto;
    position: relative;
  }

  .nc-cmdk-empty {
    @apply flex flex-col gap-2 items-center justify-center text-center px-6;
  }

  // Cloned from NcList: inset rounded rows, gray-light active state, muted bold group headers.
  .nc-cmdk-section {
    @apply flex items-end px-2 pb-1.5 text-bodySmBold text-nc-content-gray-muted;
  }

  .nc-cmdk-row {
    @apply flex items-center w-full rounded-md cursor-pointer text-sm text-nc-content-gray;
    transition: background-color 90ms var(--nc-cmdk-ease);

    &.selected {
      @apply bg-nc-bg-gray-light;

      .nc-cmdk-row-hover-icon {
        @apply opacity-100;
      }
    }

    &.is-danger {
      @apply text-nc-content-red-medium;

      &.selected {
        @apply bg-nc-bg-red-light dark:bg-nc-bg-red-light/20;
      }
    }

    &.is-disabled {
      @apply cursor-default;

      &:not(.is-danger) {
        @apply text-nc-content-gray-muted;
      }
    }
  }

  // One 16px column for every icon kind; nested icons drop their own margins and tints.
  .nc-cmdk-icon-box {
    @apply h-4 w-4 flex-none flex items-center justify-center;

    > svg,
    > .nc-virtual-cell-icon,
    > .nc-cell-icon {
      @apply h-4 w-4 m-0;
    }
  }

  // Field-type icons carry per-type tints (links pink, lookups blue); rows use one ink.
  .nc-cmdk-field-icon > * {
    color: inherit !important;
  }

  .nc-cmdk-row-inner {
    @apply flex items-center gap-2.5 w-full min-w-0 px-2 whitespace-nowrap;
  }

  // Summary figures line up down a list.
  .nc-cmdk-row-value {
    font-variant-numeric: tabular-nums;
  }
}

.nc-cmdk-modal-enter-active,
.nc-cmdk-modal-leave-active {
  transition: opacity 160ms cubic-bezier(0.2, 0, 0, 1);

  .cmdk-modal-content {
    transition: opacity 160ms cubic-bezier(0.2, 0, 0, 1), transform 180ms cubic-bezier(0.2, 0, 0, 1);
  }
}

.nc-cmdk-modal-leave-active {
  transition-duration: 120ms;

  .cmdk-modal-content {
    transition-duration: 120ms;
  }
}

.nc-cmdk-modal-enter-from,
.nc-cmdk-modal-leave-to {
  opacity: 0;

  .cmdk-modal-content {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
}

// Drilling in slides content from the right, going back from the left; leaving is instant.
.nc-cmdk-slide-forward-enter-active,
.nc-cmdk-slide-back-enter-active {
  transition: opacity 140ms cubic-bezier(0.2, 0, 0, 1), transform 160ms cubic-bezier(0.2, 0, 0, 1);
}

.nc-cmdk-slide-forward-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.nc-cmdk-slide-back-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.nc-cmdk-pop-enter-active {
  transition: opacity 140ms cubic-bezier(0.2, 0, 0, 1), transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.nc-cmdk-pop-leave-active {
  transition: opacity 80ms ease-out;
}

.nc-cmdk-pop-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

.nc-cmdk-pop-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .nc-cmdk-modal-enter-active,
  .nc-cmdk-modal-leave-active,
  .nc-cmdk-modal-enter-active .cmdk-modal-content,
  .nc-cmdk-modal-leave-active .cmdk-modal-content,
  .nc-cmdk-slide-forward-enter-active,
  .nc-cmdk-slide-back-enter-active,
  .nc-cmdk-pop-enter-active,
  .nc-cmdk-pop-leave-active,
  .nc-cmdk .nc-cmdk-row {
    transition: none;
  }
}
</style>
