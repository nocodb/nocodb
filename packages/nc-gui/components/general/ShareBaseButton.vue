<script setup lang="ts">
import { isDrawerOrModalExist, isMac, useNuxtApp, useRoute, useUIPermission } from '#imports'

const route = useRoute()

const showUserModal = ref(false)

const { isUIAllowed } = useUIPermission()

const { $e } = useNuxtApp()

const isShareBaseAllowed = computed(
  () =>
    isUIAllowed('newUser') &&
    route.name !== 'index' &&
    route.name !== 'index-index' &&
    route.name !== 'index-index-create' &&
    route.name !== 'index-index-create-external' &&
    route.name !== 'index-user-index',
)

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      case 73: {
        // ALT + I
        if (isShareBaseAllowed.value && !isDrawerOrModalExist()) {
          $e('c:shortcut', { key: 'ALT + I' })
          showUserModal.value = true
        }
        break
      }
    }
  }
})
</script>

<template>
  <div class="flex items-center h-full" @click="showUserModal = true">
    <div v-if="isShareBaseAllowed">
      <a-tooltip placement="left">
        <template #title>
          <span class="text-xs">{{ $t('activity.inviteTeam') }}</span>
        </template>
        <div class="flex items-center !text-sm space-x-1 cursor-pointer">
          <a-button size="small" class="nc-share-base mr-2">
            <div class="flex items-center text-xs gap-1 text-primary hover:text-accent">
              <MdiAccountPlusOutline />
              Share
            </div>
          </a-button>
        </div>
      </a-tooltip>
    </div>

    <LazyTabsAuthUserManagementUsersModal :show="showUserModal" @closed="showUserModal = false" />
  </div>
</template>
