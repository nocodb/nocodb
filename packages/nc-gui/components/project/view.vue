
<template>
  <v-container class="pa-0 ma-0 h-100" fluid>
    <v-tabs :key="!nodes.newView || created ? 'old' : 'new'" height="28" class="view-tab" color="pink">
      <!--    <v-tab class="caption text-capitalize">

            <v-icon small>mdi-table-column</v-icon>&nbsp;
            Columns
          </v-tab>
          <v-tab-item>
            <ViewColumns
              :nodes="nodes"
            ></ViewColumns>
          </v-tab-item>

          <template v-if="!isMvc && !isMetaTable">
            <template v-if="isRest">
              <v-tab ripple >
                <v-icon small>mdi-nodejs</v-icon>&nbsp;
                <span class="caption  text-capitalize">APIs</span>
              </v-tab>

              <v-tab-item :transition="false">

                <logic-rest
                  ref="tabs0"
                  :nodes="nodes"
                  :newTable="newTableCopy"
                />
              </v-tab-item>
            </template>
            <template v-if="isGraphql">

              <v-tab ripple class="divider" style="border-right:1px solid grey;">
                <v-icon small>mdi-graphql</v-icon>&nbsp;
                <span class="caption  text-capitalize">Schema & Resolvers</span>
              </v-tab>

              <v-tab-item :transition="false">

                <logic-gql
                  ref="tabs0"
                  is-view
                  :nodes="nodes"
                  :newTable="newTableCopy"
                />
              </v-tab-item>
            </template>
            <template v-if="isGrpc">
              <v-tab ripple class="divider" style="border-right:1px solid grey;">
                <v-icon small>mdi-nodejs</v-icon>&nbsp;
                <span class="caption text-capitalize">APIs</span>
              </v-tab>

              <v-tab-item :transition="false">

                <logic-grpc
                  ref="tabs0"
                  :nodes="nodes"
                  :newTable="newTableCopy"
                />
              </v-tab-item>
            </template>
          </template>-->

      <!--      <v-tab class="caption text-capitalize">
              <v-icon small>mdi-shield-edit-outline</v-icon>&nbsp;
              ACL
            </v-tab>
            <v-tab-item>
              <table-acl
                :nodes="nodes"
              />
            </v-tab-item>-->
      <template v-if="!nodes.newView || created">
        <v-tab class="caption text-capitalize">
          <v-icon small>
            mdi-table-row
          </v-icon>&nbsp;
          Spreadsheet
        </v-tab>
        <v-tab-item>
          <!--        <rows-->
          <!--          ref="tabs3"-->
          <!--          :nodes="nodes"-->
          <!--        />-->
          <spreadsheet
            class="h-100"
            :nodes="nodes"
          />
        </v-tab-item>
      </template>

      <template v-if="_isUIAllowed('view-create')">
        <v-tab class="caption text-capitalize">
          <v-icon small>
            mdi-database-edit
          </v-icon>&nbsp;
          SQL
        </v-tab>
        <v-tab-item>
          <view-query
            :nodes="nodes"
            @created="created = true"
          />
        </v-tab-item>
      </template>
    </v-tabs>
  </v-container>
</template>

<script>

import { mapGetters } from 'vuex'
import Spreadsheet from '@/components/project/viewTabs/viewSpreadsheet'
import ViewQuery from './viewTabs/viewQuery'
// import ViewColumns from './viewTabs/viewColumns'

export default {
  components: {
    Spreadsheet,
    // ViewColumns,
    ViewQuery
  },
  props: ['nodes'],
  data: () => ({ created: false, newTableCopy: null, isMetaTable: null }),
  computed: {
    ...mapGetters({
      sqlMgr: 'sqlMgr/sqlMgr',
      isGraphql: 'project/GtrProjectIsGraphql',
      isNoApis: 'project/GtrProjectIsNoApis',
      isMvc: 'project/GtrProjectIsMvc',
      isDocker: 'project/GtrProjectIsDocker',
      isPackage: 'project/GtrProjectIsPackage',
      isTs: 'project/GtrProjectIsTs',
      isRest: 'project/GtrProjectIsRest',
      isGrpc: 'project/GtrProjectIsGrpc'
    })
  }
}
</script>
<style scoped>
.view-tab {
  height: 100%;
}

/deep/ .view-tab .v-window {
  height: calc(100% - 28px);
}

/deep/ .view-tab .v-window > .v-window__container {
  height: 100%;
}

/deep/ .v-window-item {
  height: 100%
}</style>
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
