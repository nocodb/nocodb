<script lang="ts" setup>
import { useToast } from 'vue-toastification'
import { computed, useSmartsheetStoreOrThrow } from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils'
import MdiLockOutlineIcon from '~icons/mdi/lock-outline'
import MdiAccountIcon from '~icons/mdi/account'
import MdiAccountGroupIcon from '~icons/mdi/account-group'
import MdiCheckIcon from '~icons/mdi/check-bold'

enum LockType {
  Personal = 'personal',
  Locked = 'locked',
  Collaborative = 'collaborative',
}

const { view, $api } = useSmartsheetStoreOrThrow()
const { $e } = useNuxtApp()
const toast = useToast()

function changeLockType(type: LockType) {
  $e('a:grid:lockmenu', { lockType: type })

  if (type === 'personal') {
    return toast.info('Coming soon', { timeout: 3000 })
  }
  try {
    ;(view.value as any).lock_type = type
    $api.dbView.update(view.value.id as string, {
      lock_type: type,
    })

    toast.success(`Successfully Switched to ${type} view`, { timeout: 3000 })
  } catch (e: any) {
    toast.error(extractSdkResponseErrorMsg(e))
  }
}

const Icon = computed(() => {
  switch ((view.value as any).lock_type) {
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

<template>
  <a-dropdown max-width="350" :trigger="['click']">
    <div class="nc-sidebar-right-item hover:after:bg-indigo-500 group">
      <Icon class="cursor-pointer group-hover:(!text-white)" />
    </div>

    <template #overlay>
      <div class="min-w-[350px] max-w-[500px] shadow bg-white">
        <div>
          <div class="nc-menu-item" @click="changeLockType(LockType.Collaborative)">
            <div>
              <MdiCheckIcon v-if="!view?.lock_type || view?.lock_type === LockType.Collaborative" />
              <span v-else />
              <div>
                <MdiAccountGroupIcon />
                Collaborative view
                <div class="nc-subtitle">Collaborators with edit permissions or higher can change the view configuration.</div>
              </div>
            </div>
          </div>
          <div class="nc-menu-item" @click="changeLockType(LockType.Locked)">
            <div>
              <MdiCheckIcon v-if="view.lock_type === LockType.Locked" />
              <span v-else />
              <div>
                <MdiLockOutlineIcon />
                Locked View
                <div class="nc-subtitle">No one can edit the view configuration until it is unlocked.</div>
              </div>
            </div>
          </div>
          <div class="nc-menu-item" @click="changeLockType(LockType.Personal)">
            <div>
              <MdiCheckIcon v-if="view.lock_type === LockType.Personal" />
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
      </div>
    </template>
  </a-dropdown>
</template>

<style scoped>
.nc-menu-item > div {
  @apply grid grid-cols-[30px,auto] gap-2  p-2 align-center;
}

.nc-menu-item > div > svg {
  align-self: center;
}

.nc-menu-option > :first-child {
  @apply align-self-center;
}

.nc-subtitle {
  @apply font-size-sm font-weight-light;
}
</style>
