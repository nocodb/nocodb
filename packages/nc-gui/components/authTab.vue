<template>
  <div class="h-100">

    <div class="h-100" style="width: 100%">

      <v-tabs height="30" color="x-active">
        <v-tab><span class="caption text-capitalize">
          <!-- Users Management -->
          {{ $t('management.tabs.user')}}
          </span></v-tab>
        <v-tab-item class="h-100">
          <user-management :nodes="nodes"></user-management>
        </v-tab-item>

        <template v-if="_isUIAllowed('apiTokenTab')">
          <v-tab><span class="caption text-capitalize">
            <!-- API Tokens Management -->
          {{ $t('management.tabs.api')}}
            </span></v-tab>
          <v-tab-item>
            <api-tokens :nodes="nodes"></api-tokens>
          </v-tab-item>
        </template>
        <v-tab><span class="caption text-capitalize">
          <!-- Roles Management -->
          {{ $t('management.tabs.roles')}}
          </span></v-tab>
        <v-tab-item>
          <roles :nodes="nodes"></roles>
        </v-tab-item>
<!--              <v-tab><span class="caption text-capitalize">Auth Management</span></v-tab>
              <v-tab-item>
                <auth-hooks :nodes="nodes"></auth-hooks>
              </v-tab-item>-->

      </v-tabs>
    </div>

  </div>
</template>

<script>
import DlgLabelSubmitCancel from "@/components/utils/dlgLabelSubmitCancel";
import UserManagement from "@/components/auth/userManagement";
import Roles from "@/components/auth/roles";
import AuthHooks from "@/components/auth/authHooks";
import ApiTokens from "@/components/auth/apiTokens";

export default {
  components: {ApiTokens, AuthHooks, Roles, UserManagement, DlgLabelSubmitCancel},
  props: ['nodes'],
  name: "auth-tab",
  data: () => ({
    showConfirmDlg: false,
  }),
  async created() {
  },
  methods: {}
}
</script>

<style scoped lang="scss">
::v-deep {

  //.v-tabs-bar {
  //  border-bottom: solid 1px var(--v-primary-lighten2);
  //}
  //
  //.v-tab {
  //  border-right: 1px solid var(--v-primary-lighten2);
  //}

  .v-tabs {
    height: 100%;

    .v-tabs-items {
      height: calc(100% - 30px);

      .v-window__container {
        height: 100%;
      }
    }
  }

}
</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
-->
