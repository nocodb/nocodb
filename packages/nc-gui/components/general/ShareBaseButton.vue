<script setup lang="ts">
import { useRoute, useUIPermission } from '#imports'

const route = useRoute()

const showUserModal = ref(false)

const { isUIAllowed } = useUIPermission()

const isShareBaseAllowed =
  isUIAllowed('newUser') &&
  route.name !== 'index' &&
  route.name !== 'index-index-create' &&
  route.name !== 'index-index-create-external' &&
  route.name !== 'index-user-index'

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  if (e.altKey) {
    switch (e.keyCode) {
      case 73: {
        // ALT + I
        if (isShareBaseAllowed) {
          showUserModal.value = true
        }
        break
      }
    }
  }
})
</script>

<template>
  <div class="flex items-center w-full pl-3 hover:(text-primary bg-primary bg-opacity-5)" @click="showUserModal = true">
    <div v-if="isShareBaseAllowed">
      <div class="flex items-center space-x-1">
        <MdiAccountPlusOutline class="mr-1 nc-share-base" />

        <div>{{ $t('activity.inviteTeam') }}</div>
      </div>
    </div>

    <LazyTabsAuthUserManagementUsersModal :show="showUserModal" @closed="showUserModal = false" />
  </div>
</template>
