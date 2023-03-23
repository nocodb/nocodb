<script setup lang="ts">
import { LockType } from '~/lib'
import { ActiveViewInj, iconMap, inject } from '#imports'

const { type, hideTick } = defineProps<{ hideTick?: boolean; type: LockType }>()

const emit = defineEmits(['select'])

const types = {
  [LockType.Personal]: {
    title: 'title.personalView',
    icon: iconMap.account,
    subtitle: 'msg.info.personalView',
  },
  [LockType.Collaborative]: {
    title: 'title.collabView',
    icon: iconMap.users,
    subtitle: 'msg.info.collabView',
  },
  [LockType.Locked]: {
    title: 'title.lockedView',
    icon: iconMap.lock,
    subtitle: 'msg.info.lockedView',
  },
}

const selectedView = inject(ActiveViewInj)
</script>

<template>
  <div class="nc-locked-menu-item" @click="emit('select', type)">
    <div :class="{ 'show-tick': !hideTick }">
      <template v-if="!hideTick">
        <component :is="iconMap.check" v-if="selectedView?.lock_type === type" />

        <span v-else />
      </template>

      <div>
        <component :is="types[type].icon" class="text-gray-500" />

        {{ $t(types[type].title) }}

        <div class="nc-subtitle whitespace-normal">
          {{ $t(types[type].subtitle) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-locked-menu-item > div {
  @apply p-2 items-center min-w-[350px] max-w-[350px];

  &.show-tick {
    @apply grid gap-2  grid-cols-[30px,auto];
  }

  .nc-subtitle {
    @apply text-xs text-gray-500 font-weight-light;
  }
}
</style>
