<script setup lang="ts">
import type { CommandPaletteType } from '~/lib/types'

defineProps<{
  activeCmd: CommandPaletteType
  setActiveCmdView: (cmd: CommandPaletteType) => void
}>()

const renderCmdOrCtrlKey = () => {
  return isMac() ? '⌘' : 'Ctrl'
}
</script>

<template>
  <div class="cmdk-footer absolute inset-x-0 bottom-0 !bg-nc-bg-default">
    <div class="flex justify-center w-full py-2">
      <div
        class="flex flex-grow-1 w-full text-sm items-center gap-2 justify-center cursor-pointer"
        :class="activeCmd === 'cmd-j' ? 'text-nc-content-brand' : ''"
        @click.stop="activeCmd !== 'cmd-j' ? setActiveCmdView('cmd-j') : () => undefined"
      >
        <GeneralIcon icon="ncFileSearch" class="h-4 w-4" />
        {{ $t('objects.document') }}
        <span
          class="text-small !leading-5 px-1 rounded-md border-1"
          :class="
            activeCmd === 'cmd-j'
              ? 'bg-brand-500 border-nc-border-brand text-nc-content-inverted-primary'
              : 'bg-nc-bg-gray-medium border-nc-border-gray-medium'
          "
        >
          {{ renderCmdOrCtrlKey() }} + J
        </span>
      </div>
      <div
        class="flex flex-grow-1 w-full text-sm items-center gap-2 justify-center cursor-pointer"
        :class="activeCmd === 'cmd-k' ? 'text-nc-content-brand' : ''"
        @click.stop="activeCmd !== 'cmd-k' ? setActiveCmdView('cmd-k') : () => undefined"
      >
        <GeneralIcon icon="ncCornerUpRight" class="h-4 w-4" />
        {{ $t('labels.quickNavigation') }}
        <span
          class="text-small !leading-5 px-1 rounded-md border-1"
          :class="
            activeCmd === 'cmd-k'
              ? 'bg-brand-500 border-nc-border-brand text-nc-content-inverted-primary'
              : 'bg-nc-bg-gray-medium border-nc-border-gray-medium'
          "
        >
          {{ renderCmdOrCtrlKey() }} + K
        </span>
      </div>
      <div
        class="flex flex-grow-1 w-full text-sm items-center gap-2 justify-center cursor-pointer"
        :class="activeCmd === 'cmd-l' ? 'text-nc-content-brand' : ''"
        @click.stop="activeCmd !== 'cmd-l' ? setActiveCmdView('cmd-l') : () => undefined"
      >
        <MdiClockOutline class="h-4 w-4" />
        {{ $t('labels.recent') }}
        <span
          class="text-small !leading-5 px-1 rounded-md border-1"
          :class="
            activeCmd === 'cmd-l'
              ? 'bg-brand-500 border-nc-border-brand text-nc-content-inverted-primary'
              : 'bg-nc-bg-gray-medium border-nc-border-gray-medium'
          "
        >
          {{ renderCmdOrCtrlKey() }} + L
        </span>
      </div>
    </div>
  </div>
</template>
