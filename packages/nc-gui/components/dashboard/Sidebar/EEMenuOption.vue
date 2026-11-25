<script lang="ts" setup>
import { OrgUserRoles } from 'nocodb-sdk'

const { orgRoles } = useRoles()

const route = useRoute()

const saveBackRoute = () => {
  ncBackRoute().set(route.fullPath)
}
</script>

<template>
  <template v-if="orgRoles?.[OrgUserRoles.SUPER_ADMIN]">
    <nuxt-link v-e="['c:user:admin-panel']" to="/admin" class="!no-underline" @click="saveBackRoute">
      <!-- test id on the item, not the link: a-menu renders a hidden copy of the link for key measuring -->
      <NcMenuItem data-testid="nc-sidebar-instance-admin-panel">
        <GeneralIcon class="menu-icon" icon="controlPanel" /> {{ $t('labels.adminPanel') }}
      </NcMenuItem>
    </nuxt-link>
  </template>
  <span v-else></span>
</template>
