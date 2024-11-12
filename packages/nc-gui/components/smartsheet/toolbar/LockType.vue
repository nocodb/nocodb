<script setup lang="ts">
import { LockType } from '#imports'

const { type, hideTick } = defineProps<{ hideTick?: boolean; type: LockType; disabled?: boolean }>()

const emit = defineEmits(['select'])

const types = viewLockIcons;

const selectedView = inject(ActiveViewInj)
</script>

<template>
  <div class="nc-locked-menu-item !px-1 text-gray-800 max-w-[312px]" @click="emit('select', type)">
    <div :class="{ 'show-tick': !hideTick }">
      <div class="flex flex-col gap-y-1">
        <div class="flex items-center gap-2 flex-grow">
          <component
            :is="types[type].icon"
            class="flex-none w-6"
            :class="{
              '!w-3 h-3': hideTick,
              '!w-4 h-4': !hideTick,
              'text-gray-400': disabled,
            }"
          />
          <div
            class="flex"
            :class="{
              'text-xs py-0.7': hideTick,
              'text-gray-400': disabled,
            }"
          >
            {{ $t(types[type].title) }}
          </div>
          <div v-if="!hideTick" class="flex flex-grow"></div>
          <template v-if="!hideTick">
            <GeneralIcon v-if="selectedView?.lock_type === type" icon="check" :class="{ '!text-brand-5s00': !disabled }" />
            <span v-else />
          </template>
        </div>
        <div
          v-if="!hideTick"
          class="nc-subtitle max-w-120 text-xs whitespace-normal ml-6"
          :class="{
            'text-gray-400': disabled,
            'text-gray-500': !disabled,
          }"
        >
          {{ $t(types[type].subtitle) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-locked-menu-item > div {
  @apply !py-0 items-center;

  &.show-tick {
    @apply flex gap-2;
  }
}
</style>
