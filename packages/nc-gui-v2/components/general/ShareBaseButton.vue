<script setup lang="ts">
import { useRoute } from '#imports'

const route = useRoute()

const showUserModal = $ref(false)

const { isUIAllowed } = useUIPermission()
</script>

<template>
  <div class="flex items-center w-full pl-3 hover:(text-primary bg-primary bg-opacity-5)">
    <div
      v-if="
        isUIAllowed('newUser') &&
        route.name !== 'index' &&
        route.name !== 'project-index-create' &&
        route.name !== 'project-index-create-external' &&
        route.name !== 'index-user-index'
      "
      @click="showUserModal = true"
    >
      <div class="text-white flex items-center space-x-1">
        <MdiAccountPlusOutline class="mr-1 nc-share-base" />
        <!-- todo: i18n       <div>{{ $t('activity.share') }}</div> -->
        <div>{{ $t('activity.inviteTeam') }}</div>
      </div>
    </div>

    <TabsAuthUserManagementUsersModal :key="showUserModal" :show="showUserModal" @closed="showUserModal = false" />
  </div>
</template>
