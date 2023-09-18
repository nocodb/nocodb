<script setup lang="ts">
import { isDrawerOrModalExist, isMac, useNuxtApp, useRoles, useRoute } from '#imports'

const route = useRoute()

const showUserModal = ref(false)

const { isUIAllowed } = useRoles()

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
      <a-button type="primary" class="!rounded-lg !px-2">
        <div class="flex items-center space-x-1 cursor-pointer font-medium">
          <img src="~/assets/nc-icons/share.svg" class="mr-1.75 h-3.75 w-3.75" />
          {{ $t('activity.share') }}
        </div>
      </a-button>
    </div>

    <LazyTabsAuthUserManagementUsersModal :show="showUserModal" @closed="showUserModal = false" />
  </div>
</template>
