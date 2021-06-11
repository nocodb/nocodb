<template>
  <v-navigation-drawer
    class="views-navigation-drawer"
    :style="{
        maxWidth:toggleDrawer ? '0': '220px',
        minWidth:toggleDrawer ? '0': '220px'
      }">
    <v-container fluid class="h-100 py-0">
      <div class="d-flex flex-column h-100">

        <div class="flex-grow-1" style="overflow: auto; min-height:350px">
          <v-list dense>


            <v-list-item dense>
              <!-- Views -->
              <span class="body-2 grey--text">{{ $t('nav_drawer.title') }}</span>
            </v-list-item>
            <v-list-item-group
              v-model="selectedViewIdLocal"
              color="primary"
            >

              <v-list-item dense v-for="(view,i) in viewsList"
                           :key="i"
                           :value="view.id"
                           active-class="x-active--text"
                           class="body-2 text-capitalize view">
                <v-list-item-icon class="mr-n1">
                  <v-icon color="primary" x-small v-if="viewIcons[view.show_as]"
                          :color="viewIcons[view.show_as].color">{{ viewIcons[view.show_as].icon }}
                  </v-icon>
                  <v-icon color="primary" small v-else>mdi-table</v-icon>
                </v-list-item-icon>
                <v-list-item-title>
                  <v-tooltip bottom>
                    <template v-slot:activator="{on}">
                      <div class="font-weight-regular" style="overflow: hidden; text-overflow: ellipsis">
                        <input
                          :ref="`input${i}`"
                          v-model="view.title"
                          @click.stop v-if="view.edit"
                          @keydown.enter.stop="updateViewName(view)"
                          @blur="updateViewName(view)"
                        >
                        <template
                          v-else
                        ><span v-on="on">{{ view.alias || view.title }}</span></template>
                      </div>
                    </template>
                    {{ view.alias || view.title }}
                  </v-tooltip>
                </v-list-item-title>
                <v-spacer></v-spacer>
                <template v-if="_isUIAllowed('virtualViewsCreateOrEdit')">
                  <!-- Copy view -->
                  <x-icon v-if="view.type === 'vtable' && !view.edit"
                          v-bind:tooltip="$t('nav_drawer.virtual_views.action.copy')"
                          x-small color="primary"
                          @click.stop="copyView(view,i)"
                          iconClass="view-icon">
                    mdi-content-copy
                  </x-icon>
                  <!-- Rename view -->
                  <x-icon v-if="view.type === 'vtable' && !view.edit"
                          v-bind:tooltip="$t('nav_drawer.virtual_views.action.rename')"
                          x-small color="primary"
                          @click.stop="showRenameTextBox(view,i)"
                          iconClass="view-icon">
                    mdi-pencil
                  </x-icon>
                  <!-- Delete view" -->
                  <x-icon v-if="view.type === 'vtable'"
                          v-bind:tooltip="$t('nav_drawer.virtual_views.action.delete')"
                          small color="error" @click.stop="deleteView(view)"
                          iconClass="view-icon">
                    mdi-delete-outline
                  </x-icon>
                </template>
                <v-icon v-if="view.id === selectedViewId" small class="check-icon">mdi-check-bold</v-icon>


              </v-list-item>

            </v-list-item-group>
          </v-list>
          <template v-if="hideViews && _isUIAllowed('virtualViewsCreateOrEdit')">
            <v-divider class="advance-menu-divider">
            </v-divider>

            <v-list dense :class="{
                  'advanced-border' : overShieldIcon
                }">
              <v-list-item dense>
                <!-- Create a View -->
                <span class="body-2 grey--text" @dblclick="enableDummyFeat = true">
                  {{ $t('nav_drawer.virtual_views.title')}}
                </span>
                <v-tooltip top>

                  <template v-slot:activator="{on}">
                    <x-icon v-on="on" color="pink grey"
                            @mouseenter="overShieldIcon = true"
                            @mouseleave="overShieldIcon = false"
                            icon-class="ml-2" small>mdi-shield-lock-outline
                    </x-icon>
                  </template>
                  <!-- Only visible to Creator -->
                  <span class="caption">
                    {{ $t('nav_drawer.virtual_views.caption')}}
                  </span>
                </v-tooltip>
              </v-list-item>
              <v-tooltip bottom>
                <template v-slot:activator="{on}">
                  <v-list-item v-on="on" dense @click="openCreateViewDlg('grid')"
                               class="body-2">
                    <v-list-item-icon class="mr-n1">
                      <v-icon color="blue" x-small>mdi-grid-large</v-icon>
                    </v-list-item-icon>
                    <v-list-item-title><span class="font-weight-regular">
                      <!-- Grid -->
                      {{ $t('nav_drawer.virtual_views.grid')}}
                      </span></v-list-item-title>
                    <v-spacer></v-spacer>
                    <v-icon class="mr-1" small>mdi-plus</v-icon>

                  </v-list-item>
                </template>
                <!-- Add Grid View -->
                {{ $t('nav_drawer.virtual_views.grid.create')}}
              </v-tooltip>
              <v-tooltip bottom>
                <template v-slot:activator="{on}">
                  <v-list-item v-on="on" dense @click="openCreateViewDlg('gallery')"
                               class="body-2">
                    <v-list-item-icon class="mr-n1">
                      <v-icon color="orange" x-small>mdi-camera-image</v-icon>
                    </v-list-item-icon>
                    <v-list-item-title><span class="font-weight-regular">
                      <!-- Gallery -->
                      
                {{ $t('nav_drawer.virtual_views.gallery')}}
                      </span></v-list-item-title>

                    <v-spacer></v-spacer>
                    <v-icon class="mr-1" small>mdi-plus</v-icon>
                  </v-list-item>
                </template>
                <!-- Add Gallery View -->
                {{ $t('nav_drawer.virtual_views.gallery.create')}}
              </v-tooltip>

              <v-tooltip bottom>
                <template v-slot:activator="{on}">
                  <v-list-item v-on="on" dense @click="enableDummyFeat ? openCreateViewDlg('calendar') : comingSoon()"
                               class="body-2">
                    <v-list-item-icon class="mr-n1">
                      <v-icon x-small>mdi-calendar</v-icon>
                    </v-list-item-icon>
                    <v-list-item-title><span class="font-weight-regular">
                      <!-- Calendar -->
                      {{ $t('nav_drawer.virtual_views.calendar')}}
                      </span></v-list-item-title>

                    <v-spacer></v-spacer>
                    <v-icon class="mr-1" small>mdi-plus</v-icon>

                  </v-list-item>
                </template>
                <!-- Add Calendar View -->
                {{ $t('nav_drawer.virtual_views.calendar.create')}}
              </v-tooltip>
              <v-tooltip bottom>
                <template v-slot:activator="{on}">
                  <v-list-item v-on="on" dense @click="enableDummyFeat ? openCreateViewDlg('kanban') : comingSoon()"
                               openClass="body-2">
                    <v-list-item-icon class="mr-n1">
                      <v-icon x-small>mdi-tablet-dashboard</v-icon>
                    </v-list-item-icon>
                    <v-list-item-title><span class="font-weight-regular">
                      <!-- Kanban -->
                      {{ $t('nav_drawer.virtual_views.kanban')}}
                      </span></v-list-item-title>

                    <v-spacer></v-spacer>
                    <v-icon class="mr-1" small>mdi-plus</v-icon>

                  </v-list-item>
                </template>
                <!-- Add Kanban View -->
                {{ $t('nav_drawer.virtual_views.kanban.create')}}
              </v-tooltip>
              <v-tooltip bottom>
                <template v-slot:activator="{on}">
                  <v-list-item v-on="on" dense @click="$toast.info('Coming soon').goAway(3000)"
                               class="body-2">
                    <v-list-item-icon class="mr-n1">
                      <v-icon x-small class="mt-n1">mdi-form-select</v-icon>
                    </v-list-item-icon>
                    <v-list-item-title><span class="font-weight-regular">
                      <!-- Form -->

                      {{ $t('nav_drawer.virtual_views.form')}}
                      </span></v-list-item-title>

                    <v-spacer></v-spacer>
                    <v-icon class="mr-1" small>mdi-plus</v-icon>

                  </v-list-item>
                </template>
                <!-- Add Form View -->
                {{ $t('nav_drawer.virtual_views.form.create')}}
              </v-tooltip>
            </v-list>
          </template>
        </div>

        <div class="pa-2 sponsor-wrapper" v-if="(time - $store.state.windows.miniSponsorCard) > (15 * 60 * 1000) ">
          <v-icon small class="close-icon" @click="hideMiniSponsorCard">mdi-close-circle-outline</v-icon>
          <sponsor-mini :nav="true"></sponsor-mini>
        </div>
        <!--<div class="text-center">
          <v-hover >
            <template v-slot:default="{hover}">
            <v-btn
              :color="hover ?'primary' :  'grey'" class="mb-2" small outlined href="https://github.com/sponsors/xgenecloud"
              target="_blank">
              <v-icon small color="red" class="mr-2">mdi-heart-outline</v-icon>
              Sponsor Us
            </v-btn>
            </template>
          </v-hover>
        </div>
-->
        <div v-if="_isUIAllowed('table-advanced')">
          <v-divider></v-divider>
          <v-list dense :class="{
                  'advanced-border' : overAdvShieldIcon
                }">

            <v-list-item dense>
              <span class="body-2 grey--text" @dblclick="$emit('update:showAdvanceOptions', !showAdvanceOptions)">Advanced</span>
              <v-tooltip top>

                <template v-slot:activator="{on}">
                  <x-icon v-on="on" color="pink grey"
                          @mouseenter="overAdvShieldIcon = true"
                          @mouseleave="overAdvShieldIcon = false"
                          icon-class="ml-2" small>mdi-shield-lock-outline
                  </x-icon>
                </template>
                <span class="caption">
                  <!-- Only visible to Creator -->
                  {{$t('nav_drawer.virtual_views.caption')}}
                  </span>
              </v-tooltip>
            </v-list-item>
            <!--            <v-tooltip bottom>-->
            <!--              <template v-slot:activator="{on}">-->
            <!--            <v-menu offset-x left>-->
            <!--              <template v-slot:activator="{on}">-->
            <v-list-item
              v-show="selectedView && (selectedView.type === 'view' || selectedView.type === 'table')"
              v-if="_isUIAllowed('shareview')"
              @click="genShareLink"
            >
              <v-icon x-small class="mr-2">mdi-open-in-new</v-icon>
              <span class="caption"> 
                <!-- Share View -->
                {{ $t('nav_drawer.advanced.title1') }}
              </span>
              <v-spacer></v-spacer>
              <v-menu offset-y>
                <template v-slot:activator="{on}">
                  <v-icon small @click.stop v-on="on">mdi-dots-vertical</v-icon>
                </template>
                <v-list dense>
                  <v-list-item dense @click="$emit('showAdditionalFeatOverlay','shared-views')">
                    <v-list-item-title>
                      <span class="font-weight-regular">
                        <!-- Views List -->
                        {{ $t('nav_drawer.advanced.option1') }}
                      </span>
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </v-list-item>
            <!--              </template>-->
            <!--              <v-card dense class="backgroundColor">-->
            <!--                <v-container fluid @click.stop>-->

            <!--                  <v-text-field-->
            <!--                    label="Password"-->
            <!--                    hint="Enter shared view password"-->
            <!--                    flat-->
            <!--                    solo-->
            <!--                    dense-->
            <!--                    v-model="sharedViewPassword"-->
            <!--                  ></v-text-field>-->
            <!--                  <div class="text-right">-->
            <!--                    <v-btn small color="primary" @click="genShareLink()">Create</v-btn>-->
            <!--                  </div>-->
            <!--                </v-container>-->
            <!--              </v-card>-->

            <!--            </v-menu>-->
            <!--              </template>-->
            <!--              Generate shared view url-->
            <!--            </v-tooltip>-->

            <v-tooltip bottom>
              <template v-slot:activator="{on}">
                <v-list-item v-on="on"
                             @click="copyapiUrlToClipboard">
                  <v-icon x-small class="mr-2">mdi-content-copy</v-icon>
                  <!-- Copy API URL -->
                  <span class="caption">{{ $t('nav_drawer.advanced.option1') }}</span>
                </v-list-item>
              </template>
              <!-- Copy API URL -->
              {{ $t('nav_drawer.advanced.option1') }}
            </v-tooltip>
            <template
              v-if="_isUIAllowed('model')">
              <v-divider class="advance-menu-divider"></v-divider>
              <slot></slot>

            </template>
          </v-list>

        </div>

      </div>
    </v-container>


    <create-view-dialog
      v-if="showCreateView"
      :nodes="nodes"
      :table="table"
      :show_as="createViewType"
      v-model="showCreateView"
      @created="onViewCreate"
      :views-count="viewsList.length"
      :primaryValueColumn="primaryValueColumn"
      :meta="meta"
      :copy-view="copyViewRef"
      :alias="meta._tn"
    ></create-view-dialog>


    <v-dialog v-model="showShareModel"
              max-width="650px"
    >
      <v-card class="pa-3 backgroundColor">
        <v-container @click.stop>
          <h3 class="title mb-3">
            <!-- This view is shared via a private link -->
            {{ $t('nav_drawer.share_view.title')}}
          </h3>
          <p class="grey&#45;&#45;text body-2">
            <!-- People with private link can only see cells visible in this view -->
          </p>
          <div style="border-radius: 4px"
               class="share-link-box body-2  pa-2 d-flex align-center">
            {{ shareLink.url }}
            <v-spacer>
            </v-spacer>
            <a :href="shareLink.url" style="text-decoration: none" target="_blank">
              <v-icon small class="mx-2">mdi-open-in-new</v-icon>
            </a>
            <v-icon small
                    class="pointer"
                    @click="copyShareUrlToClipboard"
            >mdi-content-copy
            </v-icon>
          </div>

          <v-switch dense v-model="passwordProtect" @change="onPasswordProtectChange">
            <template v-slot:label>
              <!-- Restrict access with a password -->
              <span class="caption" v-show="!passwordProtect">
                {{ $t('nav_drawer.share_view.toggle.option1')}}
              </span>
              <!-- Access is password restricted -->
              <span class="caption" v-show="passwordProtect">
                {{ $t('nav_drawer.share_view.toggle.option2')}}
              </span>
            </template>
          </v-switch>

          <div v-if="passwordProtect" class="d-flex flex-column align-center justify-center">
            <v-text-field
              browser-autocomplete="new-password"
              class="password-field mr-2 caption"
              style="max-width: 230px"
              :type="showShareLinkPassword ?  'text' : 'password'"
              v-bind:hint="$t('nav_drawer.share_view.password.caption')"
              persistent-hint
              dense
              v-model="shareLink.password"
              solo
              flat>
              <template v-slot:append>
                <v-icon small @click="showShareLinkPassword = !showShareLinkPassword">
                  {{ showShareLinkPassword ? 'visibility_off' : 'visibility' }}
                </v-icon>
              </template>

            </v-text-field>
            <v-btn color="primary" class="caption" small @click="saveShareLinkPassword">
              <!-- Save password -->
                {{ $t('nav_drawer.share_view.password.button')}}
            </v-btn>
          </div>
        </v-container>

      </v-card>
    </v-dialog>

  </v-navigation-drawer>
</template>

<script>
import CreateViewDialog from "@/components/project/spreadsheet/dialog/createViewDialog";
import SponsorMini from "@/components/sponsorMini";

export default {
  name: "spreadsheetNavDrawer",
  components: {SponsorMini, CreateViewDialog},
  props: {
    showAdvanceOptions: Boolean,
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
    columnsWidth: Object,
  },
  data: () => ({
    time: Date.now(),
    sponsorMiniVisible: true,
    enableDummyFeat: false,
    searchQueryVal: '',
    showShareLinkPassword: false,
    passwordProtect: false,
    sharedViewPassword: '',
    overAdvShieldIcon: false,
    overShieldIcon: false,
    viewsList: [],
    viewIcons: {
      grid: {icon: 'mdi-grid-large', color: 'blue'},
      form: {icon: 'mdi-form-select', color: 'pink'},
      calendar: {icon: 'mdi-calendar', color: 'purple'},
      gallery: {icon: 'mdi-camera-image', color: 'orange'},
      kanban: {icon: 'mdi-tablet-dashboard', color: 'green'},
    },
    copyViewRef: null,
    shareLink: {},
    showShareModel: false,
    showCreateView: false,
  }),
  async created() {
    if (this.load) {
      await this.loadViews();
    }
  },
  computed: {
    selectedViewIdLocal: {
      get() {
        return this.selectedViewId;
      }, set(id) {
        const selectedView = this.viewsList && this.viewsList.find(v => v.id === id);
        let query_params = {}

        this.$emit('update:selectedViewId', id);
        this.$emit('update:selectedView', selectedView);
        // if (selectedView.type === 'table') {
        //   return;
        // }
        try {
          query_params = JSON.parse(selectedView.query_params) || {};
        } catch (e) {
          // console.log(e)
        }
        this.$emit('update:filters', query_params.filters || []);
        this.$emit('update:sortList', query_params.sortList || []);
        this.$emit('update:fieldsOrder', query_params.fieldsOrder || []);
        this.$emit('update:viewStatus', query_params.viewStatus || {});
        this.$emit('update:columnsWidth', query_params.columnsWidth || {});
        if (query_params.showFields) {
          this.$emit('update:showFields', query_params.showFields);
        } else {
          this.$emit('mapFieldsAndShowFields');
        }
        this.$emit('loadTableData');
      }
    }
  },
  watch: {
    async load(v) {
      if (v) {
        await this.loadViews();
      }
    }
  },
  methods: {
    hideMiniSponsorCard() {
      this.$store.commit('windows/MutMiniSponsorCard', Date.now());
    },
    openCreateViewDlg(type) {
      this.createViewType = type;
      this.showCreateView = true;
    },
    isCentrallyAligned(col) {
      return !['SingleLineText',
        'LongText',
        'Attachment',
        'Date',
        'Time',
        'Email',
        'URL',
        'DateTime',
        'CreateTime',
        'LastModifiedTime'].includes(col.uidt)
    },
    onPasswordProtectChange() {
      if (!this.passwordProtect) {
        this.shareLink.password = null;
        this.saveShareLinkPassword()
      }
    },
    async saveShareLinkPassword() {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{dbAlias: this.nodes.dbAlias}, 'updateSharedViewLinkPassword', {
          id: this.shareLink.id,
          password: this.shareLink.password
        }]);
        this.$toast.success('Successfully updated').goAway(3000);
      } catch (e) {
        this.$toast.error(e.message).goAway(3000);
      }
    },
    async loadViews() {
      this.viewsList = await this.sqlOp({
        dbAlias: this.nodes.dbAlias
      }, 'xcVirtualTableList', {
        tn: this.table
      });
      this.selectedViewIdLocal = this.viewsList && this.viewsList[0] && this.viewsList[0].id;
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
      this.$clipboard(this.currentApiUrl)
      this.clipboardSuccessHandler()
    }, async updateViewName(view) {
      try {
        await this.sqlOp({dbAlias: this.nodes.dbAlias}, 'xcVirtualTableRename', {
          id: view.id,
          title: view.title,
          alias: view.alias,
          parent_model_title: this.meta._tn
        });
        this.$toast.success('View renamed successfully').goAway(3000);
      } catch (e) {
        this.$toast.error(e.message).goAway(3000);
      }
      await this.loadViews();
    },
    showRenameTextBox(view, i) {
      this.$set(view, 'edit', true);
      this.$nextTick(() => {
        const input = this.$refs[`input${i}`][0];
        input.focus();
        input.setSelectionRange(0, input.value.length)
      });
    }, async deleteView(view) {
      try {
        await this.sqlOp({dbAlias: this.nodes.dbAlias}, 'xcVirtualTableDelete', {
          id: view.id,
          title: view.alias || view.title,
          parent_model_title: this.table
        });
        this.$toast.success('View deleted successfully').goAway(3000);
        await this.loadViews();
      } catch (e) {
        this.$toast.error(e.message).goAway(3000);
      }
    }, async genShareLink() {
      this.showShareModel = true;
      const sharedViewUrl = await this.$store.dispatch('sqlMgr/ActSqlOp', [{dbAlias: this.nodes.dbAlias}, 'createSharedViewLink', {
        model_name: this.table,
        meta: this.meta,
        query_params: {
          where: this.concatenatedXWhere,
          sort: this.sort,
          fields: Object.keys(this.showFields).filter(f => this.showFields[f]).join(',')
        },
        password: this.sharedViewPassword
      }])
      this.shareLink = sharedViewUrl;
    },
    copyView(view, i) {
      this.createViewType = view.show_as;
      this.showCreateView = true;
      this.copyViewRef = view;
    }, async onViewCreate(viewMeta) {
      this.copyViewRef = null;
      await this.loadViews();
      this.selectedViewIdLocal = viewMeta.id;
      // await this.onViewChange();
    },
    clipboard(str) {
      const el = document.createElement('textarea');
      el.addEventListener('focusin', e => e.stopPropagation());
      el.value = str;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    },
    clipboardSuccessHandler() {
      this.$toast.info('Copied to clipboard').goAway(1000)
    },
    copyShareUrlToClipboard() {
      this.clipboard(this.shareLink.url)
      this.clipboardSuccessHandler()
    },

  }
}
</script>

<style scoped lang="scss">

::v-deep {
  .v-list-item--dense .v-list-item__icon, .v-list--dense .v-list-item .v-list-item__icon {
    margin-top: 4px;
    margin-bottom: 4px;
  }

  .v-list-item--dense, .v-list--dense .v-list-item {
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
    transition: .3s display;
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
        font-size: .65rem;
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
  opacity: .2;
  content: "";
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
    transition: .4s opacity;
  }

  &:hover .close-icon {
    opacity: 1;
  }
}
</style>
