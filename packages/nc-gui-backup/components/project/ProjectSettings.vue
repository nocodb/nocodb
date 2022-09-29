<template>
  <v-container fluid class="pa-0 ma-0" style="height: 100%">
    <v-tabs v-model="tab" height="32" color="x-active">
      <!--      <v-tab><span class="caption text-capitalize"> Version & Update</span></v-tab>-->
      <!--      <v-tab-item>-->
      <!--        <div class="d-flex justify-center d-100">-->
      <!--          <version-and-update></version-and-update>-->
      <!--        </div>-->
      <!--      </v-tab-item>-->

      <!--      <v-tab>-->
      <!--        <v-icon icon x-small class="mr-2"> mdi-file-table-box-multiple-outline</v-icon>-->
      <!--        <span class="caption text-capitalize"> Export/Import Metadata</span></v-tab>-->
      <!--      <v-tab-item>-->
      <!--        <div class="d-flex justify-center d-100">-->
      <!--          <xc-meta>-->
      <!--          </xc-meta>-->
      <!--        </div>-->
      <!--      </v-tab-item>-->

      <!--      <v-tab>
              <v-icon icon x-small class="mr-2">mdi-eye-outline</v-icon>
              <span class="caption text-capitalize">
              Environment
            </span></v-tab>
            <v-tab-item>
              <div class="d-flex justify-center d-100">
                <env></env>
              </div>
            </v-tab-item>-->

      <v-tab>
        <v-icon icon x-small class="mr-2"> mdi-format-paint </v-icon>
        <span class="caption text-capitalize" @dblclick="enableEditProject = true">Themes</span>
      </v-tab>
      <v-tab-item>
        <div class="d-flex justify-center d-100">
          <appearance class="flex-shrink-1" />
        </div>
      </v-tab-item>

      <template v-if="enableEditProject">
        <v-tab>
          <v-icon icon x-small class="mr-2"> mdi-pencil-box-outline </v-icon>
          <span class="caption text-capitalize"> Edit Project </span>
        </v-tab>
        <v-tab-item>
          <create-or-edit-project v-if="tab === 1" edit />
        </v-tab-item>
      </template>
      <!-- enable extra -->
      <!-- <v-tab>
         <v-icon icon x-small class="mr-2">
           mdi-bug-outline
         </v-icon>
         <span class="caption text-capitalize">Logs</span>
       </v-tab>
       <v-tab-item>
         <div class="d-flex justify-center d-100">
           <logs></logs>
         </div>
       </v-tab-item>-->
    </v-tabs>
  </v-container>
</template>

<script>
import Appearance from '~/components/project/settings/Appearance';
import CreateOrEditProject from '~/components/CreateOrEditProject';

export default {
  name: 'ProjectSettings',
  components: { CreateOrEditProject, Appearance },
  data: () => ({
    tab: 0,
    enableEditProject: false,
  }),
};
</script>

<style scoped lang="scss">
//::v-deep {
//  .v-tabs-bar {
//    border-bottom: solid 1px var(--v-primary-lighten2);
//  }
//
//  .v-tab {
//    border-right: 1px solid var(--v-primary-lighten2);
//  }
//}
</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
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
