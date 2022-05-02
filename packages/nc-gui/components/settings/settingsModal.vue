<template>
  <div>
    <slot :click="() => settingsModal = true">
      <v-icon class="mx-2" @click="settingsModal=true">
        mdi-cog-outline
      </v-icon>
    </slot>
    <v-dialog v-model="settingsModal" width="90%" overlay-opacity=".9">
      <v-card
        v-if="settingsModal"
        width="100%"
        min-height="350px"
      >
        <div class="d-flex">
          <v-navigation-drawer
            left
            permanent
            height="90vh"
            class="backgroundColor1"
          >
            <div class=" advance-menu ">
              <v-list
                v-if="_isUIAllowed('treeViewProjectSettings')"
                dense
                :class="{ 'advanced-border': overShieldIcon }"
              >
                <v-list-item>
                  <v-list-item-title>
                    <!-- Settings -->
                    <span class="body-2 font-weight-medium grey--text  text-uppercase caption">{{ $t('activity.settings') }}</span>
                  </v-list-item-title>
                </v-list-item>
                <v-list-item-group v-model="activePage" color="x-active" mandatory>
                  <v-tooltip bottom>
                    <template #activator="{ on }">
                      <v-list-item
                        v-t="['c:settings:team-auth']"
                        value="roles"
                        dense
                        class="body-2 nc-settings-teamauth"
                        v-on="on"
                      >
                        <v-list-item-icon>
                          <v-icon small>
                            mdi-account-group
                          </v-icon>
                        </v-list-item-icon>
                        <!-- Team & Auth -->
                        <v-list-item-title>
                          <span :class="{'font-weight-medium': activePage === 'roles', 'font-weight-regular':activePage !=='roles'}">{{
                            $t('title.teamAndAuth')
                          }}</span>
                        </v-list-item-title>
                      </v-list-item>
                    </template>
                    <!-- Roles & Users Management -->
                    {{ $t('title.rolesUserMgmt') }}
                  </v-tooltip>

                  <template v-if="_isUIAllowed('treeViewProjectSettings')">
                    <v-tooltip bottom>
                      <template #activator="{ on }">
                        <v-list-item
                          v-t="['c:settings:appstore']"
                          dense
                          class="body-2 nc-settings-appstore"
                          value="appStore"
                          v-on="on"
                        >
                          <v-list-item-icon>
                            <v-icon small>
                              mdi-storefront-outline
                            </v-icon>
                          </v-list-item-icon>
                          <!-- App Store -->
                          <v-list-item-title>
                            <span :class="{'font-weight-medium': activePage === 'appStore', 'font-weight-regular':activePage !=='appStore'}">{{
                              $t('title.appStore')
                            }}</span>
                          </v-list-item-title>
                        </v-list-item>
                      </template>
                      <!-- App Store -->
                      {{ $t('title.appStore') }}
                    </v-tooltip>

                    <v-tooltip bottom>
                      <template #activator="{ on }">
                        <v-list-item
                          v-t="['c:settings:proj-metadata']"
                          dense
                          class="body-2 nc-settings-projmeta"
                          value="disableOrEnableModel"
                          v-on="on"
                        >
                          <v-list-item-icon>
                            <v-icon small>
                              mdi-table-multiple
                            </v-icon>
                          </v-list-item-icon>
                          <!-- Project Metadata -->
                          <v-list-item-title>
                            <span :class="{'font-weight-medium': activePage === 'disableOrEnableModel', 'font-weight-regular':activePage !=='disableOrEnableModel'}">{{
                              $t('title.projMeta')
                            }}</span>
                          </v-list-item-title>
                        </v-list-item>
                      </template>
                      <!-- Meta Management -->
                      {{ $t('title.metaMgmt') }}
                    </v-tooltip>

                    <v-tooltip bottom>
                      <template #activator="{ on }">
                        <v-list-item
                          v-t="['c:settings:audit']"
                          dense
                          class="body-2 nc-settings-audit"
                          value="audit"
                          v-on="on"
                        >
                          <v-list-item-icon>
                            <v-icon small>
                              mdi-notebook-outline
                            </v-icon>
                          </v-list-item-icon>
                          <!-- Project Metadata -->
                          <v-list-item-title>
                            <span :class="{'font-weight-medium': activePage === 'audit', 'font-weight-regular':activePage !=='audit' }">{{
                              $t('title.audit')
                            }}</span>
                          </v-list-item-title>
                        </v-list-item>
                      </template>
                      <!-- Meta Management -->
                      {{ $t('title.auditLogs') }}
                    </v-tooltip>
                  </template>

                  <v-list-item
                    v-t="['c:settings:team-auth']"
                    value="sync"
                    dense
                    class="body-2 nc-settings-sync"
                  >
                    <v-list-item-icon>
                      <v-icon small>
                        mdi-database-sync
                      </v-icon>
                    </v-list-item-icon>
                    <!-- Team & Auth -->
                    <v-list-item-title>
                      <span :class="{'font-weight-medium': activePage === 'sync', 'font-weight-regular':activePage !=='sync'}">
                        Sync
                      </span>
                    </v-list-item-title>
                  </v-list-item>
                </v-list-item-group>

                <!--                <v-list-item @click="improtFromAirtableModal = true">
                  <v-list-item-title>Import from Airtable</v-list-item-title>
                </v-list-item>-->
              </v-list>
            </div>
          </v-navigation-drawer>
          <v-container class="flex-grow-1 py-9 px-15" style="max-height: 90vh; overflow-y: auto">
            <div v-if="activePage === 'audit'" style="height:100%">
              <audit-tab />
            </div>
            <div
              v-else-if="activePage === 'meta'"
            >
              <xc-meta />
            </div>
            <div
              v-else-if="activePage === 'roles'"
            >
              <auth-tab
                v-if="_isUIAllowed('team-auth')"
              />
            </div>
            <div
              v-else-if="activePage === 'disableOrEnableModel'"
            >
              <disable-or-enable-models
                v-if="_isUIAllowed('project-metadata')"
              />
            </div>
            <div
              v-else-if="activePage === 'sync'"
            >
              <import-from-airtable v-model="improtFromAirtableModal" />
            </div>
            <app-store v-else />
          </v-container>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import AppStore from '~/components/project/appStore'
import DisableOrEnableModels from '~/components/project/projectMetadata/disableOrEnableModels'
import AuthTab from '~/components/authTab'
import XcMeta from '~/components/project/settings/xcMeta'
import AuditTab from '~/components/project/auditTab'
import ImportFromAirtable from '~/components/imprt/importFromAirtable'

export default {
  name: 'SettingsModal',
  components: { ImportFromAirtable, AuditTab, XcMeta, AuthTab, DisableOrEnableModels, AppStore },
  data: () => ({
    settingsModal: false,
    activePage: 'role',
    improtFromAirtableModal: false
  })
}
</script>

<style scoped lang="scss">
::v-deep{
  .v-list-item__icon{
    margin-right: 0 !important;
  }
}

</style>
