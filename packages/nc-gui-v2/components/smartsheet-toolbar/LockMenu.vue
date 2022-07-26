<script lang="ts" setup>
import { computed } from '@vue/reactivity'
import { useToast } from 'vue-toastification'
import MdiLockOutlineIcon from '~icons/mdi/lock-outline'
import MdiAccountIcon from '~icons/mdi/account'
import MdiAccountGroupIcon from '~icons/mdi/account-group'
import MdiCheckIcon from '~icons/mdi/check-bold'

interface Props {
  modelValue?: LockType
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

enum LockType {
  Personal = 'personal',
  Locked = 'locked',
  Collaborative = 'collaborative',
}

const vModel = useVModel(props, 'modelValue', emits)

const { $e } = useNuxtApp()

const toast = useToast()

function changeLockType(type: LockType) {
  $e('a:grid:lockmenu', { lockType: type })

  if (type === 'personal') {
    return toast.info('Coming soon', { timeout: 3000 })
  }

  vModel.value = type

  toast.success(`Successfully Switched to ${type} view`, { timeout: 3000 })
}

const Icon = computed(() => {
  switch (vModel.value) {
    case LockType.Personal:
      return MdiAccountIcon
    case LockType.Locked:
      return MdiLockOutlineIcon
    case LockType.Collaborative:
    default:
      return MdiAccountGroupIcon
  }
})
</script>

<script lang="ts">
export default {
  name: 'LockMenu',
}
</script>

<template>
  <a-dropdown max-width="350" :trigger="['click']">
    <Icon class="mx-1 nc-view-lock-menu text-grey"> mdi-lock-outline </Icon>
    <template #overlay>
      <div class="min-w-[350px] max-w-[500px] shadow bg-white">
        <div>
          <div class="nc-menu-item">
            <MdiCheckIcon v-if="!vModel || vModel === LockType.Collaborative" />
            <span v-else />

            <div>
              <MdiAccountGroupIcon />
              Collaborative view
              <div class="nc-subtitle">Collaborators with edit permissions or higher can change the view configuration.</div>
            </div>
          </div>
          <div class="nc-menu-item">
            <MdiCheckIcon v-if="vModel === LockType.Locked" />
            <span v-else />
            <div>
              <MdiLockOutlineIcon />
              Locked View
              <div class="nc-subtitle">No one can edit the view configuration until it is unlocked.</div>
            </div>
          </div>
          <div class="nc-menu-item">
            <MdiCheckIcon v-if="vModel === LockType.Personal" />
            <span v-else />
            <div>
              <MdiAccountIcon />
              Personal view
              <div class="nc-subtitle">
                Only you can edit the view configuration. Other collaborators’ personal views are hidden by default.
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

  </a-dropdown>
</template>

<style scoped>
.nc-menu-item {
  @apply grid grid-cols-[30px,auto] gap-2  p-4;
}

.nc-menu-option > :first-child {
  @apply align-self-center;
}

.nc-subtitle {
  @apply font-size-sm font-weight-light;
}
</style>
