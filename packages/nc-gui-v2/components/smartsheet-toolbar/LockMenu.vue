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
          <div class="nc-menu-option">
            <MdiCheckIcon v-if="!vModel || vModel === LockType.Collaborative" />
            <span v-else />

            <div>
              <MdiAccountGroupIcon />
              Collaborative view
              <div class="nc-subtitle">Collaborators with edit permissions or higher can change the view configuration.</div>
            </div>
          </div>
          <div class="nc-menu-option">
            <MdiCheckIcon v-if="vModel === LockType.Locked" />
            <span v-else />
            <div>
              <MdiLockOutlineIcon />
              Locked View
              <div class="nc-subtitle">No one can edit the view configuration until it is unlocked.</div>
            </div>
          </div>
          <div class="nc-menu-option">
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

    <!--    <v-list maxc-width="350">
          <v-list-item two-line class="pb-4" @click="changeLockType(LockType.Collaborative)">
            <v-list-item-icon class="mr-1 align-self-center">
              <v-icon v-if="!vModel || vModel === LockType.Collaborative" small> mdi-check-bold </v-icon>
            </v-list-item-icon>
            <v-list-item-content class="pb-1">
              <v-list-item-title>
                <v-icon small class="mt-n1" color="primary"> mdi-account-group </v-icon>
                Collaborative view
              </v-list-item-title>

              <v-list-item-subtitle class="pt-2 pl- font-weight-light" style="white-space: normal">
                Collaborators with edit permissions or higher can change the view configuration.
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          <v-list-item two-line class="pb-4" @click="changeLockType(LockType.Locked)">
            <v-list-item-icon class="mr-1 align-self-center">
              <v-icon v-if="vModel === LockType.Locked" small> mdi-check-bold </v-icon>
            </v-list-item-icon>

            <v-list-item-content class="pb-1">
              <v-list-item-title>
                <v-icon small class="mt-n1" color="primary"> mdi-lock </v-icon>
                Locked View
              </v-list-item-title>

              <v-list-item-subtitle class="pt-2 pl- font-weight-light" style="white-space: normal">
                No one can edit the view configuration until it is unlocked.
              </v-list-item-subtitle>
              <span class="caption mt-3"><v-icon class="mr-1 mt-n1" x-small color="#fcb401"> mdi-star</v-icon>Locked view.</span>
            </v-list-item-content>
          </v-list-item>
          <v-list-item three-line @click="changeLockType(LockType.Personal)">
            <v-list-item-icon class="mr-1 align-self-center">
              <v-icon v-if="vModel === LockType.Personal" small> mdi-check-bold </v-icon>
            </v-list-item-icon>

            <v-list-item-content>
              <v-list-item-title>
                <v-icon small class="mt-n1" color="primary"> mdi-account </v-icon>
                Personal view
              </v-list-item-title>

              <v-list-item-subtitle class="pt-2 pl- font-weight-light" style="white-space: normal">
                Only you can edit the view configuration. Other collaborators’ personal views are hidden by default.
              </v-list-item-subtitle>
              <span class="caption mt-3"><v-icon class="mr-1 mt-n1" x-small color="#fcb401"> mdi-star</v-icon>Coming soon.</span>
            </v-list-item-content>
          </v-list-item>
        </v-list> -->
  </a-dropdown>
</template>

<style scoped>
.nc-menu-option {
  @apply grid grid-cols-[30px,auto] gap-2  p-4;
}

.nc-menu-option > :first-child {
  @apply align-self-center;
}

.nc-subtitle {
  @apply font-size-sm font-weight-light;
}
</style>
