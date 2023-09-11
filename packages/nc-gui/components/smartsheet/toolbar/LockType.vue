<script setup lang="ts">
import { ActiveViewInj, LockType, iconMap, inject } from '#imports'
import UsersIcon from '~icons/nc-icons/users'
import LockIcon from '~icons/nc-icons/lock'

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
    icon: UsersIcon,
    subtitle: 'msg.info.collabView',
  },
  [LockType.Locked]: {
    title: 'title.lockedView',
    icon: LockIcon,
    subtitle: 'msg.info.lockedView',
  },
}

const selectedView = inject(ActiveViewInj)
</script>

<template>
  <div class="nc-locked-menu-item min-w-50" @click="emit('select', type)">
    <div :class="{ 'show-tick': !hideTick }">
      <div class="flex items-center gap-2 flex-grow">
        <component :is="types[type].icon" class="text-gray-800 !w-4 !h-4" />
        <div class="flex flex-col">
          {{ $t(types[type].title) }}
          <div v-if="!hideTick" class="nc-subtitle max-w-120 text-sm text-gray-500 whitespace-normal">
            {{ $t(types[type].subtitle) }}
          </div>
        </div>
      </div>

      <template v-if="!hideTick">
        <GeneralIcon v-if="selectedView?.lock_type === type" icon="check" />
        <span v-else />
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-locked-menu-item > div {
  @apply py-2 items-center;

  &.show-tick {
    @apply flex gap-2;
  }
}
</style>
