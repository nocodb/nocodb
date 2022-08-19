<script setup lang="ts">
import { useRoute } from '#imports'

const route = useRoute()

const showUserModal = $ref(false)

const { isUIAllowed } = useUIPermission()
</script>

<template>
  <div class="flex items-center">
    <a-button
      v-if="
        isUIAllowed('newUser') &&
        route.name !== 'index' &&
        route.name !== 'project-index-create' &&
        route.name !== 'project-index-create-external' &&
        route.name !== 'index-user-index'
      "
      size="middle"
      type="primary"
      class="rounded"
      @click="showUserModal = true"
    >
      <div class="flex items-center space-x-1">
        <mdi-account-supervisor-outline class="mr-1 nc-share-base" />
        <div>{{ $t('activity.share') }}</div>
      </div>
    </a-button>
    <TabsAuthUserManagementUsersModal :key="showUserModal" :show="showUserModal" @closed="showUserModal = false" />
  </div>
</template>
