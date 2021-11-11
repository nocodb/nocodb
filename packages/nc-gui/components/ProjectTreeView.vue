<template>
  <div style="height: 100%" class="nc-tree-view" @mouseenter="onMiniHoverEnter" @mouseleave="onMiniHoverLeave">
    <!--    :expand-on-hover="mini"-->
    <v-navigation-drawer
      ref="drawer"
      v-model="navigation.shown"
      permanent
      mini-variant-width="50"
      :mini-variant.sync="mini"
      mini
      class="pl-2 nc-nav-drawer"
      style="min-width: 100%; height: 100%"
    >
      <div class="h-100 d-flex flex-column">
        <div class="flex-grow-1" style="overflow-y: auto; min-height: 200px">
          <v-skeleton-loader v-if="!projects || !projects.length" class="mt-2 ml-2" type="button" />
          <!--      <v-btn
                  v-else
                  icon
                  text
                  @click.stop="toggleMini"
                >
                  &lt;!&ndash;        <v-icon v-if="mini">mdi-chevron-right-circle</v-icon>&ndash;&gt;
                  &lt;!&ndash;        <v-icon v-else>mdi-pin-outline</v-icon>&ndash;&gt;
                  <v-icon class="grey&#45;&#45;text">mdi-arrow-expand-horizontal</v-icon>
                  &lt;!&ndash;        <v-icon v-else>mdi-arrow-expand-horizontal</v-icon>&ndash;&gt;

                </v-btn>-->
          <!--      <v-text-field-->
          <!--        v-model="search"-->
          <!--        label="Search Project"-->
          <!--        dense-->
          <!--        solo-->
          <!--        hide-details-->
          <!--        clearable-->
          <!--        clear-icon="mdi-close-circle-outline"-->
          <!--        class="pa-2"-->
          <!--      ></v-text-field>-->

          <v-skeleton-loader
            v-if="!projects || !projects.length"
            type="list-item,list-item-three-line@3,list-item@2,list-item-three-line@3"
          />

          <v-treeview
            v-else-if="isTreeView"
            v-model="tree"
            class="mt-5 project-tree nc-project-tree"
            dense
            :open.sync="open"
            :active.sync="active"
            :items="projects"
            :search="search"
            :filter="filter"
            item-key="_nodes.key"
            open-on-click
            color="primary"
          >
            <template #label="{ item, open, leaf }">
              <v-tooltip
                :bottom="!!item.tooltip"
                :right="!item.tooltip"
                :disabled="!item.tooltip && false"
              >
                <template #activator="{ on }">
                  <div
                    v-if="!hideNode[item._nodes.type]"
                    v-on="item.tooltip || true ? on : ''"
                    @contextmenu.prevent="showCTXMenu($event, item, open, leaf)"
                    @click.stop="addTab({ ...item }, open, leaf)"
                  >
                    <template v-if="item._nodes.type === 'db'">
                      <v-icon size="16">
                        mdi-database
                      </v-icon>
                      <!--                  <img-->
                      <!--                    class="grey lighten-3"-->
                      <!--                    :width="16" :src="`/db-icons/${dbIcons[item._nodes.dbConnection.client]}`"/>-->
                    </template>
                    <template v-else>
                      <v-icon
                        v-if="open && icons[item._nodes.type].openIcon"
                        small
                        style="cursor: auto"
                        :color="icons[item._nodes.type].openColor"
                      >
                        {{ icons[item._nodes.type].openIcon }}
                      </v-icon>
                      <v-icon
                        v-else
                        small
                        style="cursor: auto"
                        :color="icons[item._nodes.type].color"
                      >
                        {{ icons[item._nodes.type].icon }}
                      </v-icon>
                    </template>
                    <span
                      class="v-treeview-node__label body-2"
                      :class="[
                        icons[item._nodes.type].class,
                        item.active ? 'font-weight-bold' : '',
                      ]"
                    >{{ item.name }}</span>
                  </div>
                </template>
                <span>{{ item.tooltip || item.name }}</span>
              </v-tooltip>
            </template>
          </v-treeview>
          <v-container v-else fluid class="px-1">
            <v-list dense expand class="nc-project-tree nc-single-env-project-tree">
              <template v-for="item in listViewArr">
                <!--                   v-if="item.children && item.children.length"-->
                <v-list-group
                  v-if="isNested(item) && showNode(item)"
                  :key="item.type"
                  color="textColor"
                  :value="isActiveList(item)"
                  @click="
                    !(item.children && item.children.length) && addTab({ ...item }, false, false)
                  "
                  @contextmenu.prevent="showCTXMenu($event, item, true, false)"
                >
                  <template #appendIcon>
                    <v-icon small color="grey">
                      mdi-chevron-down
                    </v-icon>
                  </template>
                  <template #activator>
                    <v-list-item-icon>
                      <v-icon
                        v-if="open && icons[item._nodes.type].openIcon"
                        x-small
                        style="cursor: auto"
                        :color="icons[item._nodes.type].openColor"
                      >
                        {{ icons[item._nodes.type].openIcon }}
                      </v-icon>
                      <v-icon
                        v-else
                        x-small
                        style="cursor: auto"
                        :color="icons[item._nodes.type].color"
                      >
                        {{ icons[item._nodes.type].icon }}
                      </v-icon>
                    </v-list-item-icon>
                    <v-list-item-title>
                      <v-tooltip v-if="!isNonAdminAccessAllowed(item)" top>
                        <template #activator="{ on }">
                          <span class="caption font-weight-regular" v-on="on">
                            {{ item.name }}</span>
                        </template>
                        <span class="caption">Only visible to Creator</span>
                      </v-tooltip>
                      <span
                        v-else
                        class="caption font-weight-regular"
                        @dblclick="showSqlClient = true"
                      >
                        {{ item.name }}</span>
                    </v-list-item-title>

                    <v-spacer />

                    <v-tooltip bottom>
                      <template #activator="{ on }">
                        <x-icon
                          v-if="_isUIAllowed('treeview-add-button')"
                          :color="['x-active', 'grey']"
                          small
                          v-on="on"
                          @click.prevent.stop="handleCreateBtnClick(item.type, item)"
                        >
                          mdi-plus-circle-outline
                        </x-icon>
                      </template>
                      <span
                        class="caption"
                      >Add new
                        <span class="text-capitalize">{{ item.type.slice(0, -3) }}</span></span>
                    </v-tooltip>
                  </template>

                  <v-list-item-group :value="selectedItem">
                    <v-list-item
                      v-for="child in item.children || []"
                      :key="child.key"
                      color="x-active"
                      active-class="font-weight-bold"
                      :selectable="true"
                      dense
                      :value="`${(child._nodes && child._nodes).type || ''}||${
                        (child._nodes && child._nodes.dbAlias) || ''
                      }||${child.name}`"
                      class="nested ml-3"
                      @click.stop="addTab({ ...child }, false, true)"
                      @contextmenu.prevent.stop="showCTXMenu($event, child, false, true)"
                    >
                      <v-list-item-icon>
                        <v-icon
                          v-if="icons[child._nodes.type].openIcon"
                          x-small
                          style="cursor: auto"
                          :color="icons[child._nodes.type].openColor"
                        >
                          {{ icons[child._nodes.type].openIcon }}
                        </v-icon>
                        <v-icon
                          v-else
                          x-small
                          style="cursor: auto"
                          :color="icons[child._nodes.type].color"
                        >
                          {{ icons[child._nodes.type].icon }}
                        </v-icon>
                      </v-list-item-icon>
                      <v-list-item-title>
                        <v-tooltip
                          v-if="_isUIAllowed('creator_tooltip') && child.creator_tooltip"
                          bottom
                        >
                          <template #activator="{ on }">
                            <span class="caption" v-on="on" @dblclick="showSqlClient = true">
                              {{ child.name }}
                            </span>
                          </template>
                          <span class="caption">{{ child.creator_tooltip }}</span>
                        </v-tooltip>
                        <span v-else class="caption">{{ child.name }}</span>
                      </v-list-item-title>
                      <template v-if="child.type === 'table'">
                        <v-spacer />
                        <div class="action d-flex" @click.stop>
                          <v-menu>
                            <template #activator="{ on }">
                              <v-icon small v-on="on">
                                mdi-dots-vertical
                              </v-icon>
                            </template>

                            <v-list dense>
                              <v-list-item
                                v-if="_isUIAllowed('treeview-rename-button')"
                                dense
                                @click="
                                  menuItem = child;
                                  dialogRenameTable.cookie = child;
                                  dialogRenameTable.dialogShow = true;
                                  dialogRenameTable.defaultValue = child.name;
                                "
                              >
                                <v-list-item-icon>
                                  <v-icon x-small>
                                    mdi-pencil-outline
                                  </v-icon>
                                </v-list-item-icon>
                                <v-list-item-title>
                                  <span classs="caption">Rename</span>
                                </v-list-item-title>
                              </v-list-item>
                              <v-list-item v-if="_isUIAllowed('ui-acl')" dense @click="openUIACL">
                                <v-list-item-icon>
                                  <v-icon x-small>
                                    mdi-shield-outline
                                  </v-icon>
                                </v-list-item-icon>
                                <v-list-item-title>
                                  <span classs="caption">UI ACL</span>
                                </v-list-item-title>
                              </v-list-item>
                            </v-list>
                          </v-menu>

                          <!--                          <v-icon @click.stop="" x-small>mdi-delete-outline</v-icon>-->
                        </div>
                      </template>
                    </v-list-item>
                  </v-list-item-group>
                </v-list-group>
                <v-list-item
                  v-else-if="(item.type !== 'sqlClientDir' || showSqlClient) &&
                    (item.type !=='migrationsDir' || _isUIAllowed('audit'))
                  "
                  :key="item.key"
                  :selectable="false"
                  :value="`${(item._nodes && item._nodes).type || ''}||${
                    (item._nodes && item._nodes.dbAlias) || ''
                  }||${item.name}`"
                  :class="`nc-treeview-item-${item.name}`"
                  @click.stop="addTab({ ...item }, false, false)"
                  @contextmenu.prevent="showCTXMenu($event, item, false, false)"
                >
                  <v-list-item-icon>
                    <v-icon
                      v-if="open && icons[item._nodes.type].openIcon"
                      small
                      style="cursor: auto"
                      :color="icons[item._nodes.type].openColor"
                    >
                      {{ icons[item._nodes.type].openIcon }}
                    </v-icon>
                    <v-icon
                      v-else
                      small
                      style="cursor: auto"
                      :color="icons[item._nodes.type].color"
                    >
                      {{ icons[item._nodes.type].icon }}
                    </v-icon>
                  </v-list-item-icon>
                  <v-list-item-title>
                    <v-tooltip v-if="!isNonAdminAccessAllowed(item)" top>
                      <template #activator="{ on }">
                        <span
                          class="caption font-weight-regular"
                          v-on="on"
                          @dblclick="showSqlClient = true"
                        >{{ item.name }}</span>
                      </template>
                      <span class="caption">Only visible to Creator</span>
                    </v-tooltip>
                    <span
                      v-else
                      class="caption font-weight-regular"
                      @dblclick="showSqlClient = true"
                    >{{ item.name }}</span>
                  </v-list-item-title>
                </v-list-item>
              </template>
            </v-list>
          </v-container>
          <recursive-menu
            v-model="menuVisible"
            offset-y
            :items="ctxMenuOptions()"
            :position-x="x"
            :position-y="y"
            @click="handleCTXMenuClick($event.value)"
          />
        </div>
        <div class="pr-3 advance-menu" :class="{ 'pl-3': !mini }">
          <v-divider v-if="_isUIAllowed('treeViewProjectSettings')" />

          <v-list
            v-if="_isUIAllowed('treeViewProjectSettings')"
            dense
            :class="{ 'advanced-border': overShieldIcon }"
          >
            <v-list-item>
              <v-list-item-title>
                <!-- Settings -->
                <span class="body-2 grey--text">{{ $t('treeview.settings.title') }}</span>
                <v-tooltip top>
                  <template #activator="{ on }">
                    <x-icon
                      class="mt-n1"
                      color="pink grey"
                      icon-class="ml-2"
                      small
                      v-on="on"
                      @mouseenter="overShieldIcon = true"
                      @mouseleave="overShieldIcon = false"
                    >
                      mdi-shield-lock-outline
                    </x-icon>
                  </template>
                  <!-- Only visible to Creator -->
                  <span class="caption">{{ $t('treeview.settings.tooltip') }}</span>
                </v-tooltip>
              </v-list-item-title>
            </v-list-item>

            <template v-if="_isUIAllowed('treeViewProjectSettings')">
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-list-item dense class="body-2" @click="appsTabAdd" v-on="on">
                    <v-list-item-icon>
                      <v-icon x-small>
                        mdi-storefront-outline
                      </v-icon>
                    </v-list-item-icon>
                    <!-- App Store -->
                    <v-list-item-title>
                      <span class="font-weight-regular caption">{{
                        $t('treeview.app_store')
                      }}</span>
                    </v-list-item-title>
                  </v-list-item>
                </template>
                <!-- App Store -->
                {{ $t('treeview.app_store') }}
              </v-tooltip>

              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-list-item dense class="body-2" @click="rolesTabAdd" v-on="on">
                    <v-list-item-icon>
                      <v-icon x-small>
                        mdi-account-group
                      </v-icon>
                    </v-list-item-icon>
                    <!-- Team & Auth -->
                    <v-list-item-title>
                      <span class="font-weight-regular caption">{{
                        $t('treeview.team_n_auth.title')
                      }}</span>
                    </v-list-item-title>
                  </v-list-item>
                </template>
                <!-- Roles & Users Management -->
                {{ $t('treeview.team_n_auth.tooltip') }}
              </v-tooltip>
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-list-item dense class="body-2" @click="disableOrEnableModelTabAdd" v-on="on">
                    <v-list-item-icon>
                      <v-icon x-small>
                        mdi-table-multiple
                      </v-icon>
                    </v-list-item-icon>
                    <!-- Project Metadata -->
                    <v-list-item-title>
                      <span class="font-weight-regular caption">{{
                        $t('treeview.project_metadata.title')
                      }}</span>
                    </v-list-item-title>
                  </v-list-item>
                </template>
                <!-- Meta Management -->
                {{ $t('treeview.project_metadata.tooltip') }}
              </v-tooltip>
            </template>
          </v-list>
          <v-divider />

          <!--          <v-list dense>-->
          <!--    <v-list-item dense class="body-2 pt-2">
                <div class="d-100 d-flex ">
                  <v-icon color="" @click="toggleMini" class="mr-1" small>mdi-arrow-expand-horizontal</v-icon>

                  <span v-shortkey="[ 'ctrl','shift', 'm']"
                        @shortkey="$store.commit('windows/MutToggleTheme')"></span>

                  <v-tooltip bottom>
                    <template v-slot:activator="{ on }">
                      <v-icon v-on="on" class="mt-1 ml-3" size="22" @click="$store.commit('windows/MutToggleTheme')">
                        mdi-format-color-fill
                      </v-icon>
                    </template>
                    Change theme (^⇧M)
                  </v-tooltip>

                  <span v-shortkey="[ 'ctrl','shift', 'b']"
                        @shortkey="changeTheme"></span>
                  <v-tooltip bottom>
                    <template v-slot:activator="{ on }">
                      <v-icon @dblclick="showAppStore=true" @click="changeTheme" v-on="on" size="23"
                              :style="$vuetify.theme.dark ? {}:{color:'lightgrey'}"
                              class="ml-3">mdi-bat
                      </v-icon>
                    </template>
                    <h3 class="pa-3">
                      {{ $vuetify.theme.dark ? 'It does come in Black (^⇧B)' : 'Does it come in Black ? (^⇧B)' }}
                      <i></i>
                    </h3>
                  </v-tooltip>

                </div>
              </v-list-item>-->

          <!--            <v-tooltip bottom>-->
          <!--              <template v-slot:activator="{on}">-->
          <!--                <v-list-item dense v-on="on" @click="openLink('https://github.com/sponsors/nocodb')" class="body-2">-->
          <!--                  <v-list-item-icon>-->
          <!--                    <v-icon color="red" class=" heart-anim" small> mdi-heart</v-icon>-->
          <!--                  </v-list-item-icon>-->
          <!--                  <v-list-item-title><span class="font-weight-regular caption">Sponsor Us</span></v-list-item-title>-->

          <!--                </v-list-item>-->
          <!--              </template>-->
          <!--              Sponsor Us-->
          <!--            </v-tooltip>-->
          <!--          </v-list>-->
          <!--          <v-divider></v-divider>-->

          <v-list v-if="_isUIAllowed('previewAs') || previewAs" dense>
            <v-list-item>
              <!-- Preview as -->
              <span class="body-2 grey--text">{{ $t('treeview.preview_as') }}</span>
              <v-icon small class="ml-1">
                mdi-drama-masks
              </v-icon>
              <!--                <v-icon small>mdi-menu-down</v-icon>-->
            </v-list-item>

            <v-list dense>
              <!--              <v-list-item v-for="role in rolesList" @click="setPreviewUSer(role.title)" :key="role.title">-->
              <!--                <v-icon small class="mr-1" :color="role.title === previewAs ? 'x-active' : ''">{{ roleIcon[role.title] }}</v-icon>-->
              <!--                <span class="caption text-capitalize"-->
              <!--                      :class="{ 'x-active&#45;&#45;text' : role.title === previewAs }">{{ role.title }}</span>-->
              <!--              </v-list-item>-->
              <div class="mx-4 d-flex align-center mb-2">
                <template v-for="(role, i) in rolesList">
                  <!--                  <span v-if="i" vertical :key="i" class="mx-2 caption grey&#45;&#45;text">or</span>-->
                  <v-divider v-if="i" :key="i" vertical class="mx-2 caption grey--text" />
                  <div
                    :key="role.title"
                    class="pointer text-center"
                    @click="setPreviewUSer(role.title)"
                  >
                    <v-icon
                      small
                      class="mr-1"
                      :color="role.title === previewAs ? 'x-active' : ''"
                    >
                      {{ roleIcon[role.title] }}
                    </v-icon>
                    <span
                      class="caption text-capitalize"
                      :class="{ 'x-active--text': role.title === previewAs }"
                    >{{ role.title }}</span>
                  </div>
                </template>
              </div>
              <template v-if="previewAs">
                <!--                <v-divider></v-divider>-->
                <v-list-item @click="setPreviewUSer(null)">
                  <v-icon small class="mr-1">
                    mdi-close
                  </v-icon>
                  <!-- Reset Preview -->
                  <span class="caption">{{ $t('treeview.reset_review') }}</span>
                </v-list-item>
              </template>
            </v-list>
          </v-list>

          <!--  <v-list dense>

              <v-list-item>
                <v-list-item-title>
                  <span class="body-2 grey&#45;&#45;text">Community</span>
                  <v-icon color="red" class=" heart-anim" small> mdi-heart</v-icon>
                </v-list-item-title>
              </v-list-item>
              <v-list-item dense v-on="on" @click="openLink('https://github.com/sponsors/nocodb')" class="body-2">
                <v-list-item-icon>

                </v-list-item-icon>
                <v-list-item-title><span class="font-weight-regular caption">Sponsor Us</span></v-list-item-title>

              </v-list-item>
              <v-list-item dense v-on="on" @click="openLink('https://github.com/sponsors/nocodb')" class="body-2">
                <v-list-item-icon>
                  <v-icon color="red" class=" heart-anim" small> mdi-heart</v-icon>
                </v-list-item-icon>
                <v-list-item-title><span class="font-weight-regular caption">Sponsor Us</span></v-list-item-title>

              </v-list-item>
              <v-list-item dense v-on="on" @click="openLink('https://github.com/sponsors/nocodb')" class="body-2">
                <v-list-item-icon>
                  <v-icon color="red" class=" heart-anim" small> mdi-heart</v-icon>
                </v-list-item-icon>
                <v-list-item-title><span class="font-weight-regular caption">Sponsor Us</span></v-list-item-title>

              </v-list-item>
            </v-list>-->
        </div>
      </div>
    </v-navigation-drawer>

    <dlg-table-create
      v-if="dialogGetTableName.dialogShow"
      v-model="dialogGetTableName.dialogShow"
      @create="mtdTableCreate($event)"
    />

    <dlg-view-create
      v-if="dialogGetViewName.dialogShow"
      v-model="dialogGetViewName.dialogShow"
      @create="mtdViewCreate($event)"
    />

    <!--    <textDlgSubmitCancel
          v-if="dialogGetTableName.dialogShow"
          :dialogShow="dialogGetTableName.dialogShow"
          :heading="dialogGetTableName.heading"
          :mtdDialogSubmit="mtdDialogGetTableNameSubmit"
          :mtdDialogCancel="mtdDialogGetTableNameCancel"
        />-->

    <textDlgSubmitCancel
      v-if="dialogRenameTable.dialogShow"
      :dialog-show="dialogRenameTable.dialogShow"
      :heading="dialogRenameTable.heading"
      :cookie="dialogRenameTable.cookie"
      :default-value="dialogRenameTable.defaultValue"
      :mtd-dialog-submit="mtdDialogRenameTableSubmit"
      :mtd-dialog-cancel="mtdDialogRenameTableCancel"
    />
    <!--    <textDlgSubmitCancel
          v-if="dialogGetViewName.dialogShow"
          :dialogShow="dialogGetViewName.dialogShow"
          :heading="dialogGetViewName.heading"
          :mtdDialogSubmit="mtdDialogGetViewNameSubmit"
          :mtdDialogCancel="mtdDialogGetViewNameCancel"
        />-->
    <textDlgSubmitCancel
      v-if="dialogGetFunctionName.dialogShow"
      :dialog-show="dialogGetFunctionName.dialogShow"
      :heading="dialogGetFunctionName.heading"
      :mtd-dialog-submit="mtdDialogGetFunctionNameSubmit"
      :mtd-dialog-cancel="mtdDialogGetFunctionNameCancel"
    />
    <textDlgSubmitCancel
      v-if="dialogGetProcedureName.dialogShow"
      :dialog-show="dialogGetProcedureName.dialogShow"
      :heading="dialogGetProcedureName.heading"
      :mtd-dialog-submit="mtdDialogGetProcedureNameSubmit"
      :mtd-dialog-cancel="mtdDialogGetProcedureNameCancel"
    />
    <textDlgSubmitCancel
      v-if="dialogGetSequenceName.dialogShow"
      :dialog-show="dialogGetSequenceName.dialogShow"
      :heading="dialogGetSequenceName.heading"
      :mtd-dialog-submit="mtdDialogGetSequenceNameSubmit"
      :mtd-dialog-cancel="mtdDialogGetSequenceNameCancel"
    />
    <dlgLabelSubmitCancel
      v-if="selectedNodeForDelete.dialog"
      :actions-mtd="deleteSelectedNode"
      :dialog-show="selectedNodeForDelete.dialog"
      :heading="selectedNodeForDelete.heading"
      type="error"
    />
  </div>
</template>

<script>
/* eslint-disable */

import { mapMutations, mapGetters, mapActions } from 'vuex';

import rightClickOptions from '../helpers/rightClickOptions';
import icons from '../helpers/treeViewIcons';

import textDlgSubmitCancel from './utils/dlgTextSubmitCancel';
import dlgLabelSubmitCancel from './utils/dlgLabelSubmitCancel';
import { copyTextToClipboard } from '../helpers/xutils';
import DlgTableCreate from '@/components/utils/dlgTableCreate';
import DlgViewCreate from '@/components/utils/dlgViewCreate';
import SponsorMini from '@/components/sponsorMini';

// const {clipboard} = require('electron');

export default {
  components: {
    SponsorMini,
    DlgViewCreate,
    DlgTableCreate,
    textDlgSubmitCancel,
    dlgLabelSubmitCancel,
  },
  data: () => ({
    roleIcon: {
      owner: 'mdi-account-star',
      creator: 'mdi-account-hard-hat',
      editor: 'mdi-account-edit',
      viewer: 'mdi-eye-outline',
      commenter: 'mdi-comment-account-outline',
    },
    showSqlClient: false,
    nestedMenu: {},
    overShieldIcon: false,
    activeListItem: null,
    dbIcons: {
      oracledb: 'oracle_icon@2x.png',
      pg: 'postgresql_icon@2x.png',
      mysql: 'mysql_icon@2x.png',
      mssql: 'mssql_icon@2x.png',
      sqlite3: 'sqlite.png',
    },
    mini: false,
    miniExpanded: false,
    navigation: {
      shown: true,
      width: 320,
      borderSize: 3,
    },
    loadingProjects: true,
    caseInsensitive: true,
    open: [],
    search: null,
    menuVisible: false,
    x: 0,
    y: 0,
    menuItem: null,
    menu: [{ title: 'Execute' }],
    icons,
    tree: [],
    active: [],
    viewMenu: false,
    dialogGetTableName: {
      dialogShow: false,
      heading: 'Enter New Table Name',
      field: 'Table Name',
    },
    dialogGetViewName: {
      dialogShow: false,
      heading: 'Enter New View Name',
      field: 'View Name',
    },
    dialogGetFunctionName: {
      dialogShow: false,
      heading: 'Enter New Function Name',
      field: 'Function Name',
    },
    dialogGetProcedureName: {
      dialogShow: false,
      heading: 'Enter New Procedure Name',
      field: 'Procedure Name',
    },
    dialogGetSequenceName: {
      dialogShow: false,
      heading: 'Enter New Sequence Name',
      field: 'Sequence Name',
    },
    dialogRenameTable: {
      dialogShow: false,
      heading: 'Rename Table',
      field: 'Table Name',
      cookie: null,
      defaultValue: null,
    },
    rolesList: null,
    selectedNodeForDelete: { dialog: false, item: null, heading: null },
  }),
  computed: {
    previewAs: {
      get() {
        return this.$store.state.users.previewAs;
      },
      set(previewAs) {
        this.$store.commit('users/MutPreviewAs', previewAs);
      },
    },
    selectedItem() {
      return [this.$route.query.type, this.$route.query.dbalias, this.$route.query.name].join('||');
    },
    direction() {
      return this.navigation.shown === false ? 'Open' : 'Closed';
    },
    ...mapGetters({
      projects: 'project/list',
      tabs: 'tabs/list',
      sqlMgr: 'sqlMgr/sqlMgr',
      currentProjectFolder: 'project/currentProjectFolder',
    }),
    filter() {
      return (item, search, textKey) => item[textKey].indexOf(search) > -1;
    },
    hideNode() {
      return {
        sqlClientDir: !this._isUIAllowed('sqlClientDir'),
        migrationsDir: !this._isUIAllowed('migrationsDir'),
        functionDir: !this._isUIAllowed('functionDir'),
        procedureDir: !this._isUIAllowed('procedureDir'),
      };
    },
    isTreeView() {
      return (
        this.projects &&
        (this.projects.length > 1 ||
          (this.projects[0] &&
            this.projects[0].children &&
            (this.projects[0].children.length > 1 ||
              (this.projects[0].children[0] &&
                this.projects[0].children[0].children &&
                this.projects[0].children[0].children.length > 1))))
      );
    },
    listViewArr() {
      return (
        (this.projects &&
          this.projects[0] &&
          this.projects[0].children &&
          this.projects[0].children[0] &&
          this.projects[0].children[0].children &&
          this.projects[0].children[0].children[0] &&
          this.projects[0].children[0].children[0].children) ||
        []
      );
    },
  },
  methods: {
    openUIACL() {
      this.disableOrEnableModelTabAdd();
      setTimeout(() => {
        this.$router.push({
          query: {
            ...this.$route.query,
            nested_1: 'dbacl',
          },
        });
      }, 100);
    },
    setPreviewUSer(previewAs) {
      if (!process.env.EE) {
        this.$toast.info('Available in Enterprise edition').goAway(3000);
      } else {
        this.previewAs = previewAs;
        window.location.reload();
      }
    },
    async loadRoles() {
      if (this.$store.getters['users/GtrIsAdmin']) {
        const roles = (
          await this.$axios.get('/admin/roles', {
            headers: {
              'xc-auth': this.$store.state.users.token,
            },
            params: {
              project_id: this.$route.params.project_id,
            },
          })
        ).data;
        this.rolesList = roles.filter(role => !['owner', 'creator', 'guest'].includes(role.title));
      } else {
        this.rolesList = null;
        this.previewAs = null;
      }
    },
    appsTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === `appStore`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        console.log('add app store tab');
        let item = { name: 'App Store', key: `appStore` };
        item._nodes = { env: '_noco' };
        item._nodes.type = 'appStore';
        this.$store.dispatch('tabs/ActAddTab', item);
      }
    },
    isNonAdminAccessAllowed(item) {
      return ['tableDir', 'viewDir'].includes(item.type);
    },
    changeTheme() {
      this.$store.dispatch('windows/ActToggleDarkMode', !this.$store.state.windows.darkTheme);
    },
    openLink(link) {
      window.open(link, '_blank');
    },

    /*    settingsTabAdd() {
          const tabIndex = this.tabs.findIndex(el => el.key === `projectSettings`);
          if (tabIndex !== -1) {
            this.changeActiveTab(tabIndex);
          } else {
            console.log('add roles tab');
            let item = {name: 'Settings', key: `projectSettings`}
            item._nodes = {env: 'dev'};
            item._nodes.type = 'projectSettings';
            this.$store.dispatch("tabs/ActAddTab", item);
          }

        },*/

    rolesTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === `roles`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        console.log('add roles tab');
        let item = { name: 'Team & Auth ', key: `roles` };
        item._nodes = { env: '_noco' };
        item._nodes.type = 'roles';
        this.$store.dispatch('tabs/ActAddTab', item);
      }
    },
    disableOrEnableModelTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === `disableOrEnableModel`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        console.log('add acl tab');
        let item = { name: 'Meta Management', key: `disableOrEnableModel` };
        item._nodes = { env: '_noco' };
        item._nodes.type = 'disableOrEnableModel';
        this.$store.dispatch('tabs/ActAddTab', item);
      }
    },
    toggleMini() {
      this.$store.commit('panelSize/MutSize', {
        type: 'treeView',
        size: this.$store.state.panelSize.treeView.size === 18 ? 5 : 18,
      });
      // this.onMiniHoverEnter();
      // this.mini = !this.mini;
    },
    onMiniHoverEnter() {
      if (this.mini && this.$refs.drawer) {
        const el = this.$refs.drawer.$el;
        this.$refs.drawer.width = el.style.width = '320px';
        this.miniExpanded = true;
      }
    },
    onMiniHoverLeave() {
      if (this.mini && this.$refs.drawer) {
        const el = this.$refs.drawer.$el;
        this.navigation.width = this.$refs.drawer.width = el.style.width = '50px';
        this.miniExpanded = false;
      }
    },

    ...mapMutations({
      setProject: 'project/list',
      updateProject: 'project/update',
    }),
    ...mapActions({
      loadTables: 'project/loadTables',
      loadProjects: 'project/loadProjects',
      loadViews: 'project/loadViews',
      loadProcedures: 'project/loadProcedures',
      loadSequences: 'project/loadSequences',
      loadFunctions: 'project/loadFunctions',
      changeActiveTab: 'tabs/changeActiveTab',
      // instantiateSqlMgr: "sqlMgr/instantiateSqlMgr",
      loadDefaultTabs: 'tabs/loadDefaultTabs',
      loadTablesFromParentTreeNode: 'project/loadTablesFromParentTreeNode',
      loadViewsFromParentTreeNode: 'project/loadViewsFromParentTreeNode',
      loadFunctionsFromParentTreeNode: 'project/loadFunctionsFromParentTreeNode',
      loadProceduresFromParentTreeNode: 'project/loadProceduresFromParentTreeNode',
      removeTabsByName: 'tabs/removeTabsByName',
      clearProjects: 'project/clearProjects',
    }),
    async addTab(item, open, leaf) {
      // console.log("addtab item", item, open, leaf);
      //this.$store.commit('notification/MutToggleProgressBar', true);
      try {
        if (item._nodes.type === 'tableDir' && !open) {
          //load tables
          await this.loadTables(item);
          const currentlyOpened = JSON.parse(JSON.stringify(this.open));
          currentlyOpened.push(item._nodes.key);
          this.activeListItem = item._nodes.key;
          this.open = currentlyOpened;
        } else if (item._nodes.type === 'viewDir' && !open) {
          await this.loadViews(item);
          const currentlyOpened = JSON.parse(JSON.stringify(this.open));
          currentlyOpened.push(item._nodes.key);
          this.activeListItem = item._nodes.key;
          this.open = currentlyOpened;
        } else if (item._nodes.type === 'functionDir' && !open) {
          await this.loadFunctions(item);
          const currentlyOpened = JSON.parse(JSON.stringify(this.open));
          currentlyOpened.push(item._nodes.key);
          this.activeListItem = item._nodes.key;
          this.open = currentlyOpened;
        } else if (item._nodes.type === 'procedureDir' && !open) {
          await this.loadProcedures(item);
          const currentlyOpened = JSON.parse(JSON.stringify(this.open));
          currentlyOpened.push(item._nodes.key);
          this.activeListItem = item._nodes.key;
          this.open = currentlyOpened;
        } else if (item._nodes.type === 'sequenceDir' && !open) {
          await this.loadSequences(item);
          const currentlyOpened = JSON.parse(JSON.stringify(this.open));
          currentlyOpened.push(item._nodes.key);
          this.activeListItem = item._nodes.key;
          this.open = currentlyOpened;
        } else if (item._nodes.type === 'env') {
          return;
        } else {
          // const tabIndex = this.tabs.findIndex(el => el.key === item.key);
          const tabIndex = this.tabs.findIndex(el => {
            return (
              ((!el._nodes && !item._nodes) ||
                (el._nodes &&
                  item._nodes &&
                  el._nodes.type === item._nodes.type &&
                  el._nodes.dbAlias === item._nodes.dbAlias)) &&
              item.name === el.name
            );
          });
          if (tabIndex !== -1) {
            this.changeActiveTab(tabIndex);
          } else {
            if (
              item._nodes.type === 'tableDir' ||
              item._nodes.type === 'project' ||
              item._nodes.type === 'viewDir' ||
              item._nodes.type === 'procedureDir' ||
              item._nodes.type === 'sequenceDir' ||
              item._nodes.type === 'db' ||
              item._nodes.type === 'functionDir'
            ) {
              return;
            }
            if (item._nodes.type === 'table') {
              let tableIndex = +item._nodes.key.split('.').pop();
              if (!(await this.$store.dispatch('windows/ActCheckMaxTable', { tableIndex }))) return;
            }
            this.$store.dispatch('tabs/ActAddTab', item);
          }
        }
      } catch (e) {
        console.log(e);
      } finally {
        //this.$store.commit('notification/MutToggleProgressBar', false);
      }
    },
    isActiveList(item) {
      return item.type === this.$route.query.type || item.type === `${this.$route.query.type}Dir`;
    },
    showNode(item) {
      return (
        !(
          this.$store.getters['project/GtrProjectPrefix'] &&
          ['functionDir', 'procedureDir'].includes(item.type)
        ) &&
        (['tableDir', 'viewDir'].includes(item.type) || this._isUIAllowed('advanced'))
      );
    },
    showCTXMenu(e, item, open, leaf) {
      if (!item) return;
      e.preventDefault();
      this.x = e.clientX;
      this.y = e.clientY;
      this.menuItem = item;

      this.$nextTick(() => {
        this.menuVisible = true;
      });
    },
    async loadProjectsData(id = null) {
      try {
        this.$store.commit('tabs/clear');
        this.loadingProjects = true;
        await this.loadProjects(id);

        if ('toast' in this.$route.query) {
          this.$toast
            .success(
              `Successfully generated ${(
                this.$store.getters['project/GtrProjectType'] || ''
              ).toUpperCase()} APIs`,
              {
                position: 'top-center',
              }
            )
            .goAway(5000);
        }

        try {
          this.open = [
            this.projects[0].key,
            this.projects[0].children[0].key,
            this.projects[0].children[0].children[0].key,
          ];
        } catch (error) {
          console.log('this.open set array error', error);
        }
        this.loadingProjects = false;
        if (!this.isTreeView) {
          if (this.$route.query.type) {
            const node = this.listViewArr.find(n => n.type === `${this.$route.query.type}Dir`);
            await this.addTab({ ...(node || this.listViewArr[0]) }, false, true);
          } else {
            await this.addTab({ ...this.listViewArr[0] }, false, true);
          }
        }
      } catch (error) {
        console.error('loadProjectsData', error);
      }
    },
    ctxMenuOptions() {
      if (!this.menuItem || !this.menuItem._nodes.type) return;
      const options = rightClickOptions[this.menuItem._nodes.type];
      return options;
      // if (options) {
      //   return Object.keys(options).map(k => typeof options[k] === 'object' ? Object.keys(options[k]) : k);
      // }
      // return [];
    },
    isNested(item) {
      return (
        (item.children && item.children.length) ||
        ['tableDir', 'viewDir', 'functionDir', 'procedureDir', 'sequenceDir'].includes(item.type)
      );
    },
    async handleCreateBtnClick(type, item) {
      this.menuItem = item;
      switch (type) {
        case 'tableDir':
          this.dialogGetTableName.dialogShow = true;
          break;
        case 'viewDir':
          this.dialogGetViewName.dialogShow = true;
          break;
        case 'functionDir':
          this.dialogGetFunctionName.dialogShow = true;
          break;
        case 'procedureDir':
          this.dialogGetProcedureName.dialogShow = true;
          break;
        case 'sequenceDir':
          this.dialogGetSequenceName.dialogShow = true;
          break;
      }
    },

    async handleCTXMenuClick(actionStr) {
      ///this.$store.commit('notification/MutToggleProgressBar', true);

      try {
        const item = this.menuItem;
        // const options = rightClickOptions[this.menuItem._nodes.type];
        const action = actionStr; //options[actionStr];
        if (action) {
          console.log('action and context', item, action);
          if (action === 'ENV_DB_TABLES_CREATE') {
            this.dialogGetTableName.dialogShow = true;
          } else if (action === 'ENV_DB_VIEWS_CREATE') {
            this.dialogGetViewName.dialogShow = true;
          } else if (action === 'ENV_DB_PROCEDURES_CREATE') {
            this.dialogGetProcedureName.dialogShow = true;
          } else if (action === 'ENV_DB_SEQUENCES_CREATE') {
            this.dialogGetSequenceName.dialogShow = true;
          } else if (action === 'ENV_DB_FUNCTIONS_CREATE') {
            this.dialogGetFunctionName.dialogShow = true;
          } else if (action === 'ENV_DB_FUNCTIONS_CREATE') {
            this.dialogGetFunctionName.dialogShow = true;
          } else if (action === 'ENV_DB_TABLES_REFRESH') {
            await this.loadTables(this.menuItem);
            this.$toast.success('Tables refreshed').goAway(1000);
          } else if (action === 'ENV_DB_VIEWS_REFRESH') {
            await this.loadViews(this.menuItem);
            this.$toast.success('Views refreshed').goAway(1000);
          } else if (action === 'ENV_DB_FUNCTIONS_REFRESH') {
            await this.loadFunctions(this.menuItem);
            this.$toast.success('Functions refreshed').goAway(1000);
          } else if (action === 'ENV_DB_PROCEDURES_REFRESH') {
            await this.loadProcedures(this.menuItem);
            this.$toast.success('Procedures refreshed').goAway(1000);
          } else if (action === 'ENV_DB_SEQUENCES_REFRESH') {
            await this.loadSequences(this.menuItem);
            this.$toast.success('Table refreshed').goAway(1000);
          } else if (action === 'ENV_DB_TABLES_RENAME') {
            console.log(`${item._nodes.type} Rename`);
            this.dialogRenameTable.cookie = item;
            this.dialogRenameTable.dialogShow = true;
            this.dialogRenameTable.defaultValue = item.name;
          } else if (action === 'ENV_DB_MIGRATION_DOWN') {
            await this.sqlMgr.migrator().migrationsDown({
              env: item._nodes.env,
              dbAlias: item._nodes.dbAlias,
              migrationSteps: 99999999999,
              folder: this.currentProjectFolder,
              sqlContentMigrate: 1,
            });
            console.log('migrations down done');
          } else if (action === 'SHOW_NODES') {
            console.log('\n_nodes.type = ', item._nodes.type, '\n');
            console.log('_nodes.key = ', item._nodes.key, '\n');
            console.log('_nodes = ', item._nodes, '\n');
          } else if (
            action === 'ENV_DB_TABLES_DELETE' ||
            action === 'ENV_DB_VIEWS_DELETE' ||
            action === 'ENV_DB_FUNCTIONS_DELETE' ||
            action === 'ENV_DB_PROCEDURES_DELETE' ||
            action === 'ENV_DB_SEQUENCES_DELETE'
          ) {
            console.log(`${item._nodes.type} delete`);
            this.deleteSelectedNode('showDialog', item);
          } else if (action === 'ENV_DB_TABLES_CREATE_STATEMENT') {
            await this.handleSqlStatementGeneration(
              item,
              'tableCreateStatement',
              `${item.name} Create Statement copied`
            );
          } else if (action === 'ENV_DB_TABLES_INSERT_STATEMENT') {
            await this.handleSqlStatementGeneration(
              item,
              'tableInsertStatement',
              `${item.name} Insert Statement copied`
            );
          } else if (action === 'ENV_DB_TABLES_UPDATE_STATEMENT') {
            await this.handleSqlStatementGeneration(
              item,
              'tableUpdateStatement',
              `${item.name} Update Statement copied`
            );
          } else if (action === 'ENV_DB_TABLES_DELETE_STATEMENT') {
            await this.handleSqlStatementGeneration(
              item,
              'tableSelectStatement',
              `${item.name} Delete Statement copied`
            );
          } else if (action === 'ENV_DB_TABLES_SELECT_STATEMENT') {
            await this.handleSqlStatementGeneration(
              item,
              'tableDeleteStatement',
              `${item.name} Select Statement copied`
            );
          } else {
            console.log(`No Action Fn found for ${action}`);
          }
        }
      } catch (e) {
        console.log(e);
      } finally {
        //this.$store.commit('notification/MutToggleProgressBar', false);
      }
    },

    async handleSqlStatementGeneration(item, func, msg) {
      try {
        let result = await this.$store.dispatch('sqlMgr/ActSqlOp', [
          {
            env: item._nodes.env,
            dbAlias: item._nodes.dbAlias,
          },
          func,
          { tn: item.name },
        ]);
        if (result && result.data) {
          copyTextToClipboard(result.data, 'selection');
        } else {
          copyTextToClipboard('Example String', 'selection');
        }

        let sqlClientNode = { ...item._nodes };
        let newItem = {
          _nodes: sqlClientNode,
        };

        sqlClientNode.type = 'sqlClientDir';
        sqlClientNode.key = sqlClientNode.tableDirKey.split('.');
        sqlClientNode.key.pop();
        sqlClientNode.dbKey = sqlClientNode.key.join('.');
        sqlClientNode.key.push('sqlClient');
        sqlClientNode.key = sqlClientNode.key.join('.');

        newItem.key = sqlClientNode.dbKey + '.sqlClient';
        newItem.name = 'SQL Client';
        newItem.tooltip = 'SQL Client';
        newItem.type = 'sqlClientDir';

        console.log('Generated sql client node', sqlClientNode);

        this.$toast.success(msg).goAway(2000);

        this.addTab(newItem, false, false);

        this.$store.commit('queries/MutSetClipboardQuery', result.data);
      } catch (e) {
        console.log(e);
        this.$toast.error('Something went wrong').goAway(2000);
      }
    },

    async mtdDialogRenameTableSubmit(tn, cookie) {
      console.log(tn);
      let item = cookie;
      await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
        {
          env: item._nodes.env,
          dbAlias: item._nodes.dbAlias,
        },
        'tableRename',
        {
          tn: tn,
          tn_old: item.name,
        },
      ]);
      await this.removeTabsByName(item);
      await this.loadTablesFromParentTreeNode({
        _nodes: {
          ...item._nodes,
        },
      });
      this.$store.dispatch('tabs/ActAddTab', {
        _nodes: {
          env: this.menuItem._nodes.env,
          dbAlias: this.menuItem._nodes.dbAlias,
          tn: tn,
          dbConnection: this.menuItem._nodes.dbConnection,

          type: 'table',
          dbKey: this.menuItem._nodes.dbKey,
          key: this.menuItem._nodes.key,
        },
        name: tn,
      });
      this.dialogRenameTable.dialogShow = false;
      this.dialogRenameTable.defaultValue = null;
      this.$toast.success('Table renamed succesfully').goAway(3000);
      console.log(tn, cookie);
    },
    mtdDialogRenameTableCancel() {
      console.log('mtdDialogGetTableNameCancel cancelled');
      this.dialogRenameTable.dialogShow = false;
      this.dialogRenameTable.defaultValue = null;
    },
    mtdTableCreate(table) {
      if (!this.menuItem) {
        this.menuItem = this.listViewArr.find(n => n.type === 'tableDir');
      }
      // const tables = table.name.split(',');
      this.$store.commit('notification/MutToggleProgressBar', true);
      this.dialogGetTableName.dialogShow = false;
      setTimeout(() => {
        // for (let i = 0; i < tables.length; ++i) {
        if (table.name) {
          this.$store.dispatch('tabs/ActAddTab', {
            _nodes: {
              env: this.menuItem._nodes.env,
              dbAlias: this.menuItem._nodes.dbAlias,
              tn: table.name,
              _tn: table.alias,
              type: 'table',
              dbKey: this.menuItem._nodes.dbKey,
              key: this.menuItem._nodes.key,
              dbConnection: this.menuItem._nodes.dbConnection,
              newTable: table,
            },
            name: table.alias,
          });
        }
      });
      setTimeout(() => this.$store.commit('notification/MutToggleProgressBar', false), 200);

      this.$set(this.dialogGetTableName, 'dialogShow', false);
    },
    mtdViewCreate(view) {
      // const tables = table.name.split(',');
      this.$store.commit('notification/MutToggleProgressBar', true);
      this.dialogGetViewName.dialogShow = false;
      setTimeout(() => {
        // for (let i = 0; i < tables.length; ++i) {
        if (view.name) {
          this.$store.dispatch('tabs/ActAddTab', {
            _nodes: {
              env: this.menuItem._nodes.env,
              dbAlias: this.menuItem._nodes.dbAlias,
              view_name: view.name,
              _tn: view.alias,
              type: 'view',
              dbKey: this.menuItem._nodes.key,
              key: this.menuItem._nodes.key,
              dbConnection: this.menuItem._nodes.dbConnection,
              newView: true,
            },
            name: view.alias,
          });
        }
      });
      setTimeout(() => this.$store.commit('notification/MutToggleProgressBar', false), 200);

      this.$set(this.dialogGetTableName, 'dialogShow', false);
    },
    mtdDialogGetTableNameSubmit(tn, cookie) {
      console.log(tn);

      let tables = tn.split(',');
      this.$store.commit('notification/MutToggleProgressBar', true);
      this.dialogGetTableName.dialogShow = false;
      setTimeout(() => {
        for (let i = 0; i < tables.length; ++i) {
          if (tables[i]) {
            this.$store.dispatch('tabs/ActAddTab', {
              _nodes: {
                env: this.menuItem._nodes.env,
                dbAlias: this.menuItem._nodes.dbAlias,
                tn: tables[i],

                type: 'table',
                dbKey: this.menuItem._nodes.dbKey,
                key: this.menuItem._nodes.key,
                dbConnection: this.menuItem._nodes.dbConnection,

                newTable: true,
              },
              name: tables[i],
            });
          }
        }
      });
      setTimeout(() => this.$store.commit('notification/MutToggleProgressBar', false), 200);
    },
    mtdDialogGetTableNameCancel() {
      console.log('mtdDialogGetTableNameCancel cancelled');
      this.dialogGetTableName.dialogShow = false;
    },
    mtdDialogGetViewNameSubmit(view_name) {
      console.log(view_name);
      this.$store.dispatch('tabs/ActAddTab', {
        _nodes: {
          env: this.menuItem._nodes.env,
          dbAlias: this.menuItem._nodes.dbAlias,
          view_name: view_name,

          type: 'view',
          dbKey: this.menuItem._nodes.key,
          key: this.menuItem._nodes.key,
          dbConnection: this.menuItem._nodes.dbConnection,

          newView: true,
        },
        name: view_name,
      });
      this.dialogGetViewName.dialogShow = false;
    },
    mtdDialogGetViewNameCancel() {
      console.log('mtdDialogGetTableNameCancel cancelled');
      this.dialogGetViewName.dialogShow = false;
    },
    mtdDialogGetFunctionNameSubmit(function_name) {
      console.log(function_name);
      this.$store.dispatch('tabs/ActAddTab', {
        _nodes: {
          dbKey: this.menuItem._nodes.dbKey,
          env: this.menuItem._nodes.env,
          dbAlias: this.menuItem._nodes.dbAlias,
          function_name: function_name,
          newFunction: true,
          type: 'function',
          key: this.menuItem._nodes.key,
          dbConnection: this.menuItem._nodes.dbConnection,
        },
        name: function_name,
      });
      this.dialogGetFunctionName.dialogShow = false;
    },
    mtdDialogGetFunctionNameCancel() {
      console.log('mtdDialogGetFunctionNameCancel cancelled');
      this.dialogGetFunctionName.dialogShow = false;
    },
    mtdDialogGetProcedureNameSubmit(procedure_name) {
      console.log(procedure_name);
      this.$store.dispatch('tabs/ActAddTab', {
        _nodes: {
          dbKey: this.menuItem._nodes.dbKey,
          env: this.menuItem._nodes.env,
          dbAlias: this.menuItem._nodes.dbAlias,
          procedure_name: procedure_name,
          newProcedure: true,
          type: 'procedure',
          key: this.menuItem._nodes.key,
        },
        name: procedure_name,
      });
      this.dialogGetProcedureName.dialogShow = false;
    },
    mtdDialogGetSequenceNameSubmit(sequence_name) {
      console.log(sequence_name);
      this.$store.dispatch('tabs/ActAddTab', {
        _nodes: {
          dbKey: this.menuItem._nodes.dbKey,
          env: this.menuItem._nodes.env,
          dbAlias: this.menuItem._nodes.dbAlias,
          sequence_name: sequence_name,
          newSequence: true,
          type: 'sequence',
          key: this.menuItem._nodes.key,
          dbConnection: this.menuItem._nodes.dbConnection,
        },
        name: sequence_name,
      });
      this.dialogGetSequenceName.dialogShow = false;
    },
    mtdDialogGetProcedureNameCancel() {
      console.log('mtdDialogGetProcedureNameCancel cancelled');
      this.dialogGetProcedureName.dialogShow = false;
    },
    mtdDialogGetSequenceNameCancel() {
      console.log('mtdDialogGetSequenceNameCancel cancelled');
      this.dialogGetSequenceName.dialogShow = false;
    },
    async renameSelectedNode(action = '', item) {
      if (action === 'showDialog') {
        this.selectedNodeForRename = {
          dialog: true,
          item: item,
          heading: `Rename ${item._nodes.type}`,
        };
      } else if (action === 'hideDialog') {
        this.selectedNodeForDelete = {
          dialog: false,
          item: null,
          heading: null,
        };
      } else {
      }
    },
    async deleteSelectedNode(action = '', item) {
      if (action === 'showDialog') {
        this.selectedNodeForDelete = {
          dialog: true,
          item: item,
          heading: `Click Submit to Delete The ${item._nodes.type}`,
        };
      } else if (action === 'hideDialog') {
        this.selectedNodeForDelete = {
          dialog: false,
          item: null,
          heading: null,
        };
      } else {
        item = this.selectedNodeForDelete.item;
        if (item._nodes.type === 'table') {
          const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [
            {
              env: item._nodes.env,
              dbAlias: item._nodes.dbAlias,
            },
            'columnList',
            {
              tn: item._nodes.tn,
            },
          ]);

          await this.sqlMgr.sqlOpPlus(
            {
              env: item._nodes.env,
              dbAlias: item._nodes.dbAlias,
            },
            'tableDelete',
            { tn: item._nodes.tn, columns: columns.data.list }
          );
          await this.loadTablesFromParentTreeNode({
            _nodes: {
              ...item._nodes,
            },
          });
          this.$toast.success('Table deleted successfully').goAway(3000);
        } else if (item._nodes.type === 'view') {
          const view = await this.$store.dispatch('sqlMgr/ActSqlOp', [
            {
              env: item._nodes.env,
              dbAlias: item._nodes.dbAlias,
            },
            'viewRead',
            { view_name: item._nodes.view_name },
          ]);

          await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: item._nodes.env,
              dbAlias: item._nodes.dbAlias,
            },
            'viewDelete',
            {
              view_name: item._nodes.view_name,
              oldViewDefination: view.view_definition,
            },
          ]);
          await this.loadViewsFromParentTreeNode({
            _nodes: {
              ...item._nodes,
            },
          });
          this.$toast.success('View deleted successfully').goAway(3000);
        } else if (item._nodes.type === 'function') {
          const _function = await this.$store.dispatch('sqlMgr/ActSqlOp', [
            {
              env: item._nodes.env,
              dbAlias: item._nodes.dbAlias,
            },
            'functionRead',
            {
              function_name: item._nodes.function_name,
            },
          ]);

          await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: item._nodes.env,
              dbAlias: item._nodes.dbAlias,
            },
            'functionDelete',
            {
              function_name: item._nodes.function_name,
              oldCreateFunction: _function.create_function,
            },
          ]);

          await this.loadFunctionsFromParentTreeNode({
            _nodes: {
              ...item._nodes,
            },
          });
          this.$toast.success('Function deleted successfully').goAway(3000);
        } else if (item._nodes.type === 'procedure') {
          const procedure = await this.$store.dispatch('sqlMgr/ActSqlOp', [
            {
              env: item._nodes.env,
              dbAlias: item._nodes.dbAlias,
            },
            'procedureRead',
            {
              procedure_name: item._nodes.procedure_name,
            },
          ]);

          await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: item._nodes.env,
              dbAlias: item._nodes.dbAlias,
            },
            'procedureDelete',
            {
              procedure_name: item._nodes.procedure_name,
              create_procedure: procedure.create_procedure,
            },
          ]);

          await this.loadProceduresFromParentTreeNode({
            _nodes: {
              ...item._nodes,
            },
          });
          this.$toast.success('Procedure deleted successfully').goAway(3000);
        }

        await this.removeTabsByName(item);

        this.selectedNodeForDelete = {
          dialog: false,
          item: null,
          heading: null,
        };
      }
    },
  },
  async created() {
    // this.loadDefaultTabs();
    // this.instantiateSqlMgr();
    const _id = this.$route.params.project;

    if (_id === 'external') {
    }
    await this.loadProjectsData(_id);
    this.loadDefaultTabs(true);
    this.loadRoles();
  },
  beforeCreate() {},
  mounted() {
    // this.setBorderWidth();
    // this.setEvents();
  },
  async destroyed() {
    await this.clearProjects();
  },
};
</script>
<style scoped>
/deep/ .project-tree .v-treeview-node__level {
  width: 12px;
}

/deep/ .project-tree .v-treeview-node__toggle {
  width: 12px;
}

/deep/ .v-list-item.nested {
  min-height: 25px;
}

/deep/ .v-list-item .v-list-item__icon {
  margin-right: 0;
}

/deep/ .v-list-item.nested .v-list-item__icon {
  min-height: 25px;
  margin-top: 0;
  margin-bottom: 0;
  margin-right: 0;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  60% {
    transform: scale(1);
  }
  70% {
    /*opacity: 0;*/
    transform: scale(1.35);
  }
  80% {
    transform: scale(1);
  }
  90% {
    /*opacity: 0;*/
    transform: scale(1.35);
  }
  100% {
    transform: scale(1);
  }
}

.heart-anim {
  animation-name: pulse;
  animation-duration: 2.5s;
  animation-iteration-count: infinite;
}

/deep/ .advance-menu .v-list-item--dense,
/deep/ .advance-menu .v-list--dense .v-list-item {
  min-height: 32px;
}

/deep/ .advance-menu .v-list-item--dense .v-list-item__icon,
/deep/ .advance-menu .v-list--dense .v-list-item .v-list-item__icon {
  margin-top: 4px;
  margin-bottom: 4px;
}

.font-weight-bold .caption {
  font-weight: 700 !important;
}

/deep/ .v-list-group .v-list-group__header .v-list-item__icon.v-list-group__header__append-icon {
  min-width: auto;
}

.nested .action {
  opacity: 0;
  transition: 0.4s opacity;
}

.nested:hover .action {
  opacity: 1;
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
