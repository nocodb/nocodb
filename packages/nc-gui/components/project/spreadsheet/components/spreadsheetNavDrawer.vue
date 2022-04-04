<template>
  <v-navigation-drawer
    permanent
    class="views-navigation-drawer"
    :style="{
      maxWidth: toggleDrawer ? '0' : '220px',
      minWidth: toggleDrawer ? '0' : '220px',
    }"
  >
    <v-container fluid class="h-100 py-0">
      <div class="d-flex flex-column h-100">
        <div class="flex-grow-1" style="overflow: auto; min-height: 350px">
          <v-list v-if="views && views.length" dense>
            <v-list-item dense>
              <!-- Views -->
              <span class="body-2 font-weight-medium">{{ $t('objects.views') }}</span>
            </v-list-item>
            <v-list-item-group v-model="selectedViewIdLocal" mandatory color="primary">
              <draggable
                :is="_isUIAllowed('viewlist-drag-n-drop') ? 'draggable' : 'div'"
                v-model="viewsList"
                draggable="div"
                v-bind="dragOptions"
                @change="onMove($event)"
              >
                <transition-group type="transition" :name="!drag ? 'flip-list' : null">
                  <v-list-item
                    v-for="(view, i) in viewsList"
                    :key="view.id"
                    v-t="['view:open']"
                    dense
                    :value="view.id"
                    active-class="x-active--text"
                    :class="`body-2  view nc-view-item nc-draggable-child nc-${viewTypeAlias[view.type]}-view-item`"
                    @click="$emit('rerender')"
                  >
                    <v-icon
                      v-if="_isUIAllowed('viewlist-drag-n-drop')"
                      small
                      :class="`nc-child-draggable-icon nc-child-draggable-icon-${view.title}`"
                      @click.stop
                    >
                      mdi-drag-vertical
                    </v-icon>
                    <v-list-item-icon class="mr-n1">
                      <v-icon
                        v-if="viewIcons[view.type]"
                        x-small
                        :color="viewIcons[view.type].color"
                      >
                        {{ viewIcons[view.type].icon }}
                      </v-icon>
                      <v-icon v-else color="primary" small>
                        mdi-table
                      </v-icon>
                    </v-list-item-icon>
                    <v-list-item-title>
                      <v-tooltip bottom>
                        <template #activator="{ on }">
                          <div
                            class="font-weight-regular"
                            style="overflow: hidden; text-overflow: ellipsis"
                          >
                            <input
                              v-if="view.edit"
                              :ref="`input${i}`"
                              v-model="view.title_temp"
                              @click.stop
                              @keydown.enter.stop="updateViewName(view, i)"
                              @blur="updateViewName(view, i)"
                            >
                            <template
                              v-else
                            >
                              <span v-on="on">{{ view.alias || view.title }}</span>
                            </template>
                          </div>
                        </template>
                        {{ view.alias || view.title }}
                      </v-tooltip>
                    </v-list-item-title>
                    <v-spacer />
                    <template v-if="_isUIAllowed('virtualViewsCreateOrEdit')">
                      <!-- Copy view -->
                      <x-icon
                        v-if="!view.edit"
                        :tooltip="$t('activity.copyView')"
                        x-small
                        color="primary"
                        icon-class="view-icon nc-view-copy-icon"
                        @click.stop="copyView(view, i)"
                      >
                        mdi-content-copy
                      </x-icon>
                      <!-- Rename view -->
                      <x-icon
                        v-if="!view.edit"
                        :tooltip="$t('activity.renameView')"
                        x-small
                        color="primary"
                        icon-class="view-icon nc-view-edit-icon"
                        @click.stop="showRenameTextBox(view, i)"
                      >
                        mdi-pencil
                      </x-icon>
                      <!-- Delete view" -->
                      <x-icon
                        v-if="!view.is_default"
                        :tooltip="$t('activity.deleteView')"
                        small
                        color="error"
                        icon-class="view-icon nc-view-delete-icon"
                        @click.stop="deleteView(view)"
                      >
                        mdi-delete-outline
                      </x-icon>
                    </template>
                    <v-icon
                      v-if="view.id === selectedViewId"
                      small
                      class="check-icon"
                    >
                      mdi-check-bold
                    </v-icon>
                  </v-list-item>
                </transition-group>
              </draggable>
            </v-list-item-group>
          </v-list>
          <template v-if="hideViews && _isUIAllowed('virtualViewsCreateOrEdit')">
            <v-divider class="advance-menu-divider" />

            <v-list
              dense
              :class="{
                'advanced-border': overShieldIcon,
              }"
            >
              <v-list-item dense>
                <!-- Create a View -->
                <span class="body-2 font-weight-medium" @dblclick="enableDummyFeat = true">
                  {{ $t('activity.createView') }}
                </span>
                <v-tooltip top>
                  <template #activator="{ on }">
                    <x-icon
                      color="pink textColor"
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
                  <span class="caption">
                    {{ $t('msg.info.onlyCreator') }}
                  </span>
                </v-tooltip>
              </v-list-item>
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-list-item dense class="body-2  nc-create-grid-view" v-on="on" @click="openCreateViewDlg(viewTypes.GRID)">
                    <v-list-item-icon class="mr-n1">
                      <v-icon color="blue" x-small>
                        mdi-grid-large
                      </v-icon>
                    </v-list-item-icon>
                    <v-list-item-title>
                      <span class="font-weight-regular">
                        <!-- Grid -->
                        {{ $t('objects.viewType.grid') }}
                      </span>
                    </v-list-item-title>
                    <v-spacer />
                    <v-icon class="mr-1" small>
                      mdi-plus
                    </v-icon>
                  </v-list-item>
                </template>
                <!-- Add Grid View -->
                {{ $t('msg.info.addView.grid') }}
              </v-tooltip>
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-list-item
                    dense
                    class="body-2 nc-create-gallery-view"
                    v-on="on"
                    @click="openCreateViewDlg(viewTypes.GALLERY)"
                  >
                    <v-list-item-icon class="mr-n1">
                      <v-icon color="orange" x-small>
                        mdi-camera-image
                      </v-icon>
                    </v-list-item-icon>
                    <v-list-item-title>
                      <span class="font-weight-regular">
                        <!-- Gallery -->
                        {{ $t('objects.viewType.gallery') }}
                      </span>
                    </v-list-item-title>

                    <v-spacer />
                    <v-icon class="mr-1" small>
                      mdi-plus
                    </v-icon>
                  </v-list-item>
                </template>
                <!-- Add Gallery View -->
                {{ $t('msg.info.addView.gallery') }}
              </v-tooltip>

              <v-tooltip
                bottom
              >
                <template #activator="{ on }">
                  <v-list-item
                    v-if="!isView"
                    dense
                    class="body-2 nc-create-form-view"
                    v-on="on"
                    @click="openCreateViewDlg(viewTypes.FORM)"
                  >
                    <v-list-item-icon class="mr-n1">
                      <v-icon x-small :color="viewIcons[viewTypes.FORM].color" class="mt-n1">
                        mdi-form-select
                      </v-icon>
                    </v-list-item-icon>
                    <v-list-item-title>
                      <span class="font-weight-regular">
                        <!-- Form -->

                        {{ $t('objects.viewType.form') }}
                      </span>
                    </v-list-item-title>

                    <v-spacer />
                    <v-icon class="mr-1" small>
                      mdi-plus
                    </v-icon>
                  </v-list-item>
                </template>
                <!-- Add Form View -->
                {{ $t('msg.info.addView.form') }}
              </v-tooltip>
            </v-list>
          </template>
        </div>

        <div
          v-if="time - $store.state.windows.miniSponsorCard > 15 * 60 * 1000"
          class="pa-2 sponsor-wrapper"
        >
          <v-icon
            small
            class="close-icon"
            @click="hideMiniSponsorCard"
          >
            mdi-close-circle-outline
          </v-icon>

          <!--          <extras />-->
          <sponsor-mini nav />
        </div>
        <!--<div class="text-center">
          <v-hover >
            <template v-slot:default="{hover}">
            <v-btn
              :color="hover ?'primary' :  'grey'" class="mb-2" small outlined href="https://github.com/sponsors/nocodb"
              target="_blank">
              <v-icon small color="red" class="mr-2">mdi-heart-outline</v-icon>
              Sponsor Us
            </v-btn>
            </template>
          </v-hover>
        </div>
-->
        <!--        <div v-if="_isUIAllowed('table-advanced')">
          <v-divider />
          <v-list
            dense
            :class="{
              'advanced-border': overAdvShieldIcon,
            }"
          >
            <v-list-item dense>
              <span
                class="body-2 font-weight-medium"
                @dblclick="$emit('update:showAdvanceOptions', !showAdvanceOptions)"
              >Advanced</span>
              <v-tooltip top>
                <template #activator="{ on }">
                  <x-icon
                    color="pink textColor"
                    icon-class="ml-2"
                    small
                    v-on="on"
                    @mouseenter="overAdvShieldIcon = true"
                    @mouseleave="overAdvShieldIcon = false"
                  >
                    mdi-shield-lock-outline
                  </x-icon>
                </template>
                <span class="caption">
                  &lt;!&ndash; Only visible to Creator &ndash;&gt;
                  {{ $t('msg.info.onlyCreator') }}
                </span>
              </v-tooltip>
            </v-list-item>
            &lt;!&ndash;            <v-tooltip bottom>&ndash;&gt;
            &lt;!&ndash;              <template v-slot:activator="{on}">&ndash;&gt;
            &lt;!&ndash;            <v-menu offset-x left>&ndash;&gt;
            &lt;!&ndash;              <template v-slot:activator="{on}">&ndash;&gt;

            &lt;!&ndash;
              TODO:
              - Add selectedView.show_as === 'kanban' when it is ready
             &ndash;&gt;
            &lt;!&ndash;            <v-list-item
              v-show="
                selectedView && (selectedView.type === 'view' || selectedView.type === 'table' || selectedView.show_as === 'form' || selectedView.show_as === 'grid' )
              "
              v-if="_isUIAllowed('shareview')"
              @click="genShareLink"
            >
              <v-icon x-small class="mr-2 nc-share-view">
                mdi-open-in-new
              </v-icon>
              <span class="caption">
                &lt;!&ndash; Share View &ndash;&gt;
                {{ $t('activity.shareView') }}
              </span>
              <v-spacer />
              <v-menu offset-y>
                <template #activator="{ on }">
                  <v-icon small @click.stop v-on="on">
                    mdi-dots-vertical
                  </v-icon>
                </template>
                <v-list dense>
                  <v-list-item dense @click="$emit('showAdditionalFeatOverlay', 'shared-views')">
                    <v-list-item-title>
                      <span class="font-weight-regular">
                        &lt;!&ndash; Views List &ndash;&gt;
                        {{ $t('activity.ListView') }}
                      </span>
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </v-list-item>&ndash;&gt;

            &lt;!&ndash;            <v-tooltip bottom>&ndash;&gt;
            &lt;!&ndash;              <template #activator="{ on }">&ndash;&gt;
            &lt;!&ndash;                <v-list-item v-on="on" @click="copyapiUrlToClipboard">&ndash;&gt;
            &lt;!&ndash;                  <v-icon x-small class="mr-2">&ndash;&gt;
            &lt;!&ndash;                    mdi-content-copy&ndash;&gt;
            &lt;!&ndash;                  </v-icon>&ndash;&gt;
            &lt;!&ndash;                  &lt;!&ndash; Copy API URL &ndash;&gt;&ndash;&gt;
            &lt;!&ndash;                  <span class="caption">{{ $t('activity.ListView') }}</span>&ndash;&gt;
            &lt;!&ndash;                </v-list-item>&ndash;&gt;
            &lt;!&ndash;              </template>&ndash;&gt;
            &lt;!&ndash;              &lt;!&ndash; Copy API URL &ndash;&gt;&ndash;&gt;
            &lt;!&ndash;              {{ $t('activity.ListView') }}&ndash;&gt;
            &lt;!&ndash;            </v-tooltip>&ndash;&gt;
            <template v-if="_isUIAllowed('model')">
              &lt;!&ndash;              <v-divider class="advance-menu-divider" />&ndash;&gt;
              <slot />
            </template>
          </v-list>
        </div>-->
      </div>
    </v-container>

    <create-view-dialog
      v-if="showCreateView"
      v-model="showCreateView"
      :nodes="nodes"
      :table="table"
      :show_as="createViewType"
      :views-count="views.length"
      :primary-value-column="primaryValueColumn"
      :meta="meta"
      :copy-view="copyViewRef"
      :alias="meta.title"
      :views-list="views"
      :selected-view-id="selectedViewId"
      @created="onViewCreate"
    />

    <v-dialog v-model="showShareModel" max-width="650px">
      <v-card class="pa-3 backgroundColor">
        <v-container @click.stop>
          <h3 class="title mb-3">
            <!-- This view is shared via a private link -->
            {{ $t('msg.info.privateLink') }}
          </h3>
          <p class="grey&#45;&#45;text body-2">
            <!-- People with private link can only see cells visible in this view -->
          </p>
          <div style="border-radius: 4px" class="share-link-box body-2 pa-2 d-flex align-center">
            {{ sharedViewUrl }}
            <v-spacer />
            <a
              v-t="['share-view:open-url']"
              :href="`${sharedViewUrl}`"
              style="text-decoration: none"
              target="_blank"
            >
              <v-icon small class="mx-2">mdi-open-in-new</v-icon>
            </a>
            <v-icon
              small
              class="pointer"
              @click="copyShareUrlToClipboard"
            >
              mdi-content-copy
            </v-icon>
          </div>

          <v-switch v-model="passwordProtect" dense @change="onPasswordProtectChange">
            <template #label>
              <!-- Restrict access with a password -->
              <span v-show="!passwordProtect" class="caption">
                {{ $t('msg.info.beforeEnablePwd') }}
              </span>
              <!-- Access is password restricted -->
              <span v-show="passwordProtect" class="caption">
                {{ $t('msg.info.afterEnablePwd') }}
              </span>
            </template>
          </v-switch>

          <div v-if="passwordProtect" class="d-flex flex-column align-center justify-center">
            <v-text-field
              v-model="shareLink.password"
              autocomplete="new-password"
              browser-autocomplete="new-password"
              class="password-field mr-2 caption"
              style="max-width: 230px"
              :type="showShareLinkPassword ? 'text' : 'password'"
              :hint="$t('placeholder.password.enter')"
              persistent-hint
              dense
              solo
              flat
            >
              <template #append>
                <v-icon small @click="showShareLinkPassword = !showShareLinkPassword">
                  {{ showShareLinkPassword ? 'visibility_off' : 'visibility' }}
                </v-icon>
              </template>
            </v-text-field>
            <v-btn color="primary" class="caption" small @click="saveShareLinkPassword">
              <!-- Save password -->
              {{ $t('placeholder.password.save') }}
            </v-btn>
          </div>
        </v-container>
      </v-card>
    </v-dialog>
  </v-navigation-drawer>
</template>

<script>
import draggable from 'vuedraggable'
import { ViewTypes } from 'nocodb-sdk'
import CreateViewDialog from '@/components/project/spreadsheet/dialog/createViewDialog'
import Extras from '~/components/project/spreadsheet/components/extras'
import viewIcons from '~/helpers/viewIcons'
import { copyTextToClipboard } from '~/helpers/xutils'
import SponsorMini from '~/components/sponsorMini'

export default {
  name: 'SpreadsheetNavDrawer',
  components: { SponsorMini, Extras, CreateViewDialog, draggable },
  props: {
    extraViewParams: Object,
    showAdvanceOptions: Boolean,
    isView: Boolean,
    hideViews: Boolean,
    primaryValueColumn: [Number, String],
    toggleDrawer: {
      type: Boolean,
      default: false
    },
    nodes: Object,
    table: String,
    selectedViewId: [String, Number],
    selectedView: Object,
    meta: [Object, Array],
    concatenatedXWhere: String,
    sort: String,
    showFields: Object,
    filters: [Object, Array],
    sortList: [Object, Array],
    load: {
      default: true,
      type: Boolean
    },
    currentApiUrl: String,
    fieldsOrder: Array,
    viewStatus: Object,
    // columnsWidth: Object,
    // coverImageField: String,
    groupingField: String,
    // showSystemFields: Boolean,
    views: Array
  },
  data: () => ({
    drag: false,
    dragOptions: {
      animation: 200,
      group: 'description',
      disabled: false,
      ghostClass: 'ghost'
    },
    time: Date.now(),
    sponsorMiniVisible: true,
    enableDummyFeat: false,
    searchQueryVal: '',
    showShareLinkPassword: false,
    passwordProtect: false,
    sharedViewPassword: '',
    overAdvShieldIcon: false,
    overShieldIcon: false,
    viewIcons,
    copyViewRef: null,
    shareLink: {},
    showShareModel: false,
    showCreateView: false,
    loading: false,
    viewTypeAlias: { [ViewTypes.GRID]: 'grid', [ViewTypes.FORM]: 'form', [ViewTypes.GALLERY]: 'gallery' }
  }),
  computed: {
    viewsList: {
      set(v) {
        this.$emit('update:views', v)
      },
      get() {
        return this.views
      }
    },
    viewTypes() {
      return ViewTypes
    },
    newViewParams() {
      if (!this.showFields) {
        return {}
      }
      const showFields = { ...this.showFields }
      Object.keys(showFields).forEach((k) => {
        showFields[k] = true
      })
      return { showFields }
    },
    selectedViewIdLocal: {
      set(val) {
        const view = (this.views || []).find(v => v.id === val)
        this.$router.push({
          query: {
            ...this.$route.query,
            view: view && (view.id)
          }
        })
      },
      get() {
        let id
        if (this.views) {
          const view = this.views.find(v => v.id === this.$route.query.view)
          id = (view && view.id) || ((this.views && this.views[0]) || {}).id
        }
        return id
      }
    },
    sharedViewUrl() {
      let viewType

      switch (this.shareLink.type) {
        case this.viewTypes.FORM:
          viewType = 'form'
          break
        case this.viewTypes.KANBAN:
          viewType = 'kanban'
          break
        default:
          viewType = 'view'
      }
      return `${this.dashboardUrl}#/nc/${viewType}/${this.shareLink.uuid}`
    }
  },
  watch: {
    async load(v) {
      if (v) {
        await this.loadViews()
        this.onViewIdChange(this.selectedViewIdLocal)
      }
    },
    selectedViewIdLocal(id) {
      this.onViewIdChange(id)
    }
  },
  async created() {
    if (this.load) {
      await this.loadViews()
    }
    this.onViewIdChange(this.selectedViewIdLocal)
  },
  methods: {
    async onMove(event) {
      if (this.viewsList.length - 1 === event.moved.newIndex) {
        this.$set(this.viewsList[event.moved.newIndex], 'order', this.viewsList[event.moved.newIndex - 1].order + 1)
      } else if (event.moved.newIndex === 0) {
        this.$set(this.viewsList[event.moved.newIndex], 'order', this.viewsList[1].order / 2)
      } else {
        this.$set(this.viewsList[event.moved.newIndex], 'order', (this.viewsList[event.moved.newIndex - 1].order + this.viewsList[event.moved.newIndex + 1].order) / 2)
      }
      await this.$api.dbView.update(this.viewsList[event.moved.newIndex].id, {
        title: this.viewsList[event.moved.newIndex].title,
        order: this.viewsList[event.moved.newIndex].order
      })

      this.$tele.emit('view:drag')
    },
    onViewIdChange(id) {
      const selectedView = this.views && this.views.find(v => v.id === id)
      // const queryParams = {}
      this.$emit('update:selectedViewId', id)
      this.$emit('update:selectedView', selectedView)
      // if (selectedView.type === 'table') {
      //   return;
      // }
      // try {
      //   queryParams = JSON.parse(selectedView.query_params) || {}
      // } catch (e) {
      //   // console.log(e)
      // }
      // this.$emit('update:filters', queryParams.filters || [])
      // this.$emit('update:sortList', queryParams.sortList || [])
      // this.$emit('update:fieldsOrder', queryParams.fieldsOrder || [])
      // this.$emit('update:viewStatus', queryParams.viewStatus || {})
      // this.$emit('update:columnsWidth', queryParams.columnsWidth || {})
      // this.$emit('update:extraViewParams', queryParams.extraViewParams || {})
      // this.$emit('update:coverImageField', queryParams.coverImageField)
      // this.$emit('update:groupingField', queryParams.groupingField)
      // this.$emit('update:showSystemFields', queryParams.showSystemFields)
      // if (queryParams.showFields) {
      //   this.$emit('update:showFields', queryParams.showFields)
      // } else {
      //   this.$emit('mapFieldsAndShowFields')
      // }
      this.$emit('loadTableData')
    },
    hideMiniSponsorCard() {
      this.$store.commit('windows/MutMiniSponsorCard', Date.now())
    },
    openCreateViewDlg(type) {
      const mainView = this.viewsList.find(v => v.type === 'table' || v.type === 'view')
      try {
        this.copyViewRef = this.copyViewRef || {
          query_params: JSON.stringify({
            ...this.newViewParams,
            fieldsOrder: JSON.parse(mainView.query_params).fieldsOrder
          })
        }
      } catch {
      }
      this.createViewType = type
      this.showCreateView = true
      this.$tele.emit(`view:create:trigger:${type}`)
    },
    isCentrallyAligned(col) {
      return ![
        'SingleLineText',
        'LongText',
        'Attachment',
        'Date',
        'Time',
        'Email',
        'URL',
        'DateTime',
        'CreateTime',
        'LastModifiedTime'
      ].includes(col.uidt)
    },
    onPasswordProtectChange() {
      if (!this.passwordProtect) {
        this.shareLink.password = null
        this.saveShareLinkPassword()
      }
    },
    async saveShareLinkPassword() {
      try {
        await this.$api.dbViewShare.update(this.shareLink.id, {
          password: this.shareLink.password
        })

        // await this.$store.dispatch('sqlMgr/ActSqlOp', [
        //   { dbAlias: this.nodes.dbAlias },
        //   'updateSharedViewLinkPassword',
        //   {
        //     id: this.shareLink.id,
        //     password: this.shareLink.password
        //   }
        // ])
        this.$toast.success('Successfully updated').goAway(3000)
      } catch (e) {
        this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000)
      }

      this.$tele.emit('share-view:enable-pwd')
    },
    async loadViews() {
      // this.viewsList = await this.sqlOp(
      //   {
      //     dbAlias: this.nodes.dbAlias
      //   },
      //   'xcVirtualTableList',
      //   {
      //     tn: this.table
      //   }
      // )
      // this.selectedViewIdLocal = this.viewsList && this.viewsList[0] && this.viewsList[0].id

      // this.viewsList = []

      const views = (await this.$api.dbView.list(this.meta.id)).list
      this.$emit('update:views', views)
    },
    // async onViewChange() {
    //   let query_params = {}
    //   try {
    //     console.log(this.selectedView)
    //     query_params = JSON.parse(this.selectedView.query_params);
    //   } catch (e) {
    //     console.log(e)
    //   }
    //   this.$emit('update:filters', query_params.filters || []);
    //   this.$emit('update:sortList', query_params.sortList || []);
    //   if (query_params.showFields) {
    //     this.$emit('update:showFields', query_params.showFields);
    //   } else {
    //     this.$emit('mapFieldsAndShowFields');
    //   }
    //   this.$emit('loadTableData');
    // },
    copyapiUrlToClipboard() {
      copyTextToClipboard(this.currentApiUrl)
      this.clipboardSuccessHandler()
    },
    async updateViewName(view, index) {
      if (!view.edit) {
        return
      }

      // const oldTitle = view.title

      this.$set(view, 'edit', false)
      if (view.title_temp === view.title) {
        return
      }
      if (this.viewsList.some((v, i) => i !== index && (v.alias || v.title) === view.title_temp)) {
        this.$toast.info('View name should be unique').goAway(3000)
        return
      }
      try {
        if (this.selectedViewIdLocal === view.id) {
          await this.$router.push({
            query: {
              ...this.$route.query,
              view: view.title_temp
            }
          })
        }
        this.$set(view, 'title', view.title_temp)
        // await this.sqlOp({ dbAlias: this.nodes.dbAlias }, 'xcVirtualTableRename', {
        //   id: view.id,
        //   old_title: oldTitle,
        //   title: view.title_temp,
        //   alias: view.alias,
        //   parent_model_title: this.meta.table_name
        // })
        await this.$api.dbView.update(view.id, {
          title: view.title,
          order: view.order
        })
        this.$toast.success('View renamed successfully').goAway(3000)
      } catch (e) {
        this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000)
      }
    },
    showRenameTextBox(view, i) {
      this.$set(view, 'edit', true)
      this.$set(view, 'title_temp', view.title)
      this.$nextTick(() => {
        const input = this.$refs[`input${i}`][0]
        input.focus()
        input.setSelectionRange(0, input.value.length)
      })
      this.$tele.emit(`view:rename:trigger:${view.type}`)
    },
    async deleteView(view) {
      try {
        // await this.sqlOp({ dbAlias: this.nodes.dbAlias }, 'xcVirtualTableDelete', {
        //   id: view.id,
        //   title: view.alias || view.title,
        //   view_name: view.alias || view.title,
        //   parent_model_title: this.table
        // })
        await this.$api.dbView.delete(view.id)
        this.$toast.success('View deleted successfully').goAway(3000)
        await this.loadViews()
      } catch (e) {
        this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000)
      }
      this.$tele.emit(`view:delete:submit:${view.type}`)
    },
    async genShareLink() {
      // const sharedViewUrl = await this.$store.dispatch('sqlMgr/ActSqlOp', [
      //   { dbAlias: this.nodes.dbAlias },
      //   'createSharedViewLink',
      //   {
      //     model_name: this.table,
      //     // meta: this.meta,
      //     query_params: {
      //       where: this.concatenatedXWhere,
      //       sort: this.sort,
      //       fields: Object.keys(this.showFields)
      //         .filter(f => this.showFields[f])
      //         .join(','),
      //       showFields: this.showFields,
      //       fieldsOrder: this.fieldsOrder,
      //       extraViewParams: this.extraViewParams,
      //       selectedViewId: this.selectedViewId,
      //       columnsWidth: this.columnsWidth
      //     },
      //     view_name: this.selectedView.title,
      //     type: this.selectedView.type,
      //     show_as: this.selectedView.show_as,
      //     password: this.sharedViewPassword
      //   }
      // ])
      const shared = (await this.$api.dbViewShare.create(this.selectedViewId))

      // todo: url
      this.shareLink = shared
      this.showShareModel = true
    },
    copyView(view, i) {
      this.createViewType = view.type
      this.showCreateView = true
      this.copyViewRef = view
      this.$tele.emit(`view:copy:trigger${view.type}`)
    },
    async onViewCreate(viewMeta) {
      this.copyViewRef = null
      await this.loadViews()
      this.selectedViewIdLocal = viewMeta.id
      // await this.onViewChange();
      this.$tele.emit(`view:create:submit:${viewMeta.type}`)
    },
    clipboard(str) {
      const el = document.createElement('textarea')
      el.addEventListener('focusin', e => e.stopPropagation())
      el.value = str
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    },
    clipboardSuccessHandler() {
      this.$toast.info('Copied to clipboard').goAway(1000)
    },
    copyShareUrlToClipboard() {
      this.clipboard(this.sharedViewUrl)
      this.clipboardSuccessHandler()
      this.$tele.emit('share-view:copy-url')
    }
  }
}
</script>

<style scoped lang="scss">
::v-deep {
  .v-list-item--dense .v-list-item__icon,
  .v-list--dense .v-list-item .v-list-item__icon {
    margin-top: 4px;
    margin-bottom: 4px;
  }

  .v-list-item--dense,
  .v-list--dense .v-list-item {
    min-height: 32px;
  }

  .advance-menu-divider {
    width: calc(100% - 26px);
    margin-left: 13px;
    border-style: dashed;
    margin-top: 5px;
    margin-bottom: 5px;
  }

  .view .view-icon {
    display: none;
    transition: 0.3s display;
  }

  .view:hover .view-icon {
    display: inline-block;
  }

  .view:hover .check-icon {
    display: none;
  }

  .password-field.v-text-field.v-text-field--solo {
    .v-text-field__details {
      padding: 0 2px !important;

      .v-messages__message {
        color: grey;
        font-size: 0.65rem;
      }
    }

    .v-input__control {
      min-height: 28px !important;
    }
  }
}

.share-link-box {
  position: relative;
  z-index: 2;
}

.share-link-box::before {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: var(--v-primary-base);
  opacity: 0.2;
  content: '';
  z-index: 1;
  pointer-events: none;
}

.views-navigation-drawer {
  border-left: 1px solid #80808033;
}

.sponsor-wrapper {
  position: relative;

  .close-icon {
    position: absolute;
    right: 10px;
    top: 10px;
    z-index: 9;
    opacity: 0;
    transition: 0.4s opacity;
  }

  &:hover .close-icon {
    opacity: 1;
  }
}

.nc-draggable-child .nc-child-draggable-icon {
  opacity: 0;
  transition: .3s opacity;
  position: absolute;
  left: 0;
}

.nc-draggable-child:hover .nc-child-draggable-icon {
  opacity: 1;
}

.nc-draggable-child:hover .nc-child-draggable-icon {
  opacity: 1;
}

.flip-list-move {
  transition: transform 0.5s;
}
.no-move {
  transition: transform 0s;
}
.ghost {
  opacity: 0.5;
  background: grey;
}

</style>
