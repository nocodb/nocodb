<script setup lang="ts">
import type { CommandPaletteType } from '~/lib/types'

defineProps<{
  activeCmd: CommandPaletteType
  setActiveCmdView: (cmd: CommandPaletteType) => void
}>()

const cmdOrCtrlKey = isMac() ? 'Meta' : 'Ctrl'
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
        <GeneralShortcutLabel :keys="[cmdOrCtrlKey, 'J']" :class="activeCmd === 'cmd-j' ? '' : 'text-nc-content-gray-muted'" />
      </div>
      <div
        class="flex flex-grow-1 w-full text-sm items-center gap-2 justify-center cursor-pointer"
        :class="activeCmd === 'cmd-k' ? 'text-nc-content-brand' : ''"
        @click.stop="activeCmd !== 'cmd-k' ? setActiveCmdView('cmd-k') : () => undefined"
      >
        <GeneralIcon icon="ncCornerUpRight" class="h-4 w-4" />
        {{ $t('labels.quickNavigation') }}
        <GeneralShortcutLabel :keys="[cmdOrCtrlKey, 'K']" :class="activeCmd === 'cmd-k' ? '' : 'text-nc-content-gray-muted'" />
      </div>
      <div
        class="flex flex-grow-1 w-full text-sm items-center gap-2 justify-center cursor-pointer"
        :class="activeCmd === 'cmd-l' ? 'text-nc-content-brand' : ''"
        @click.stop="activeCmd !== 'cmd-l' ? setActiveCmdView('cmd-l') : () => undefined"
      >
        <GeneralIcon icon="ncClock" class="h-4 w-4" />
        {{ $t('labels.recent') }}
        <GeneralShortcutLabel :keys="[cmdOrCtrlKey, 'L']" :class="activeCmd === 'cmd-l' ? '' : 'text-nc-content-gray-muted'" />
      </div>
    </div>
  </div>
</template>
