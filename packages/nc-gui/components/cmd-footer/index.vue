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
    <!-- On a phone the shortcuts drop out and the labels truncate, so the three items fit. -->
    <div class="flex justify-center w-full py-2 px-2">
      <div
        class="flex flex-grow-1 w-full min-w-0 whitespace-nowrap text-sm items-center gap-2 justify-center cursor-pointer"
        :class="activeCmd === 'cmd-j' ? 'text-nc-content-brand' : ''"
        @click.stop="activeCmd !== 'cmd-j' ? setActiveCmdView('cmd-j') : () => undefined"
      >
        <GeneralIcon icon="ncFileSearch" class="h-4 w-4 flex-none" />
        <span class="truncate">{{ $t('title.docs') }}</span>
        <GeneralShortcutLabel
          :keys="[cmdOrCtrlKey, 'J']"
          class="!hidden sm:!flex"
          :class="activeCmd === 'cmd-j' ? '' : 'text-nc-content-gray-muted'"
        />
      </div>
      <div
        class="flex flex-grow-1 w-full min-w-0 whitespace-nowrap text-sm items-center gap-2 justify-center cursor-pointer"
        :class="activeCmd === 'cmd-k' ? 'text-nc-content-brand' : ''"
        @click.stop="activeCmd !== 'cmd-k' ? setActiveCmdView('cmd-k') : () => undefined"
      >
        <GeneralIcon icon="ncCornerUpRight" class="h-4 w-4 flex-none" />
        <span class="truncate">{{ $t('labels.quickNavigation') }}</span>
        <GeneralShortcutLabel
          :keys="[cmdOrCtrlKey, 'K']"
          class="!hidden sm:!flex"
          :class="activeCmd === 'cmd-k' ? '' : 'text-nc-content-gray-muted'"
        />
      </div>
      <div
        class="flex flex-grow-1 w-full min-w-0 whitespace-nowrap text-sm items-center gap-2 justify-center cursor-pointer"
        :class="activeCmd === 'cmd-l' ? 'text-nc-content-brand' : ''"
        @click.stop="activeCmd !== 'cmd-l' ? setActiveCmdView('cmd-l') : () => undefined"
      >
        <GeneralIcon icon="ncClock" class="h-4 w-4 flex-none" />
        <span class="truncate">{{ $t('labels.recent') }}</span>
        <GeneralShortcutLabel
          :keys="[cmdOrCtrlKey, 'L']"
          class="!hidden sm:!flex"
          :class="activeCmd === 'cmd-l' ? '' : 'text-nc-content-gray-muted'"
        />
      </div>
    </div>
  </div>
</template>
