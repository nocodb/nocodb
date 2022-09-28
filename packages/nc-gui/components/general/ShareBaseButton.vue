<script setup lang="ts">
import { useRoute, useUIPermission } from '#imports'

const route = useRoute()

const showUserModal = $ref(false)

const { isUIAllowed } = useUIPermission()
</script>

<template>
  <div class="flex items-center w-full pl-3 hover:(text-primary bg-primary bg-opacity-5)" @click="showUserModal = true">
    <div
      v-if="
        isUIAllowed('newUser') &&
        route.name !== 'index' &&
        route.name !== 'index-index-create' &&
        route.name !== 'index-index-create-external' &&
        route.name !== 'index-user-index'
      "
    >
      <div class="flex items-center space-x-1">
        <MdiAccountPlusOutline class="mr-1 nc-share-base" />

        <div>{{ $t('activity.inviteTeam') }}</div>
      </div>
    </div>

    <LazyTabsAuthUserManagementUsersModal :key="showUserModal" :show="showUserModal" @closed="showUserModal = false" />
  </div>
</template>
