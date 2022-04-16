<template>
  <div class="d-100">
    <v-container class="d-flex">
      <v-spacer />
      <div>
        <v-simple-table dense style="min-width: 600px; width:auto; margin:0 auto">
          <thead>
            <tr class="">
              <th class="caption grey--text">
                <!--View name-->
                {{ $t('labels.viewName') }}
              </th>
              <th class="caption grey--text">
                <!--View Link-->
                {{ $t('labels.viewLink') }}
              </th>
              <th class="caption grey--text">
                <!--Password-->
                {{ $t('labels.password') }}
              </th>
              <th class="caption grey--text">
                <!--Actions-->
                {{ $t('labels.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="currentView">
              <td class="font-weight-bold caption text-left">
                <v-icon v-if="viewIcons[currentView.type]" small :color="viewIcons[currentView.type].color">
                  {{ viewIcons[currentView.type].icon }}
                </v-icon>

                {{ currentView.title }}
              </td>
              <td class="caption text-left">
                <nuxt-link :to="sharedViewUrl(currentView)">
                  {{ `${dashboardUrl}#${sharedViewUrl(currentView)}` }}
                </nuxt-link>
              </td>
              <td class="caption">
                <template v-if="currentView.password">
                  <span>{{ currentView.showPassword ? currentView.password : '***************************' }}</span>
                  <v-icon small @click="$set(currentView, 'showPassword' , !currentView.showPassword)">
                    {{ currentView.showPassword ? 'visibility_off' : 'visibility' }}
                  </v-icon>
                </template>
              </td>
              <td class="caption">
                <v-icon small @click="copyLink(currentView)">
                  mdi-content-copy
                </v-icon>
                <v-icon small @click="deleteLink(currentView.id)">
                  mdi-delete-outline
                </v-icon>
              </td>
            </tr>

            <tr v-else>
              <td colspan="4" class="text-center caption info--text">
                <!--Current view is not shared!-->
                {{ $t('msg.info.viewNotShared') }}
              </td>
            </tr>
            <template v-if="allSharedLinks">
              <tr v-for="link of viewList" :key="link.id">
                <td class="caption text-left">
                  <v-icon v-if="viewIcons[link.type]" small :color="viewIcons[link.type].color">
                    {{ viewIcons[link.type].icon }}
                  </v-icon>

                  {{ link.title }}
                </td>
                <td class="caption text-left">
                  <nuxt-link :to="sharedViewUrl(link)">
                    {{ `${dashboardUrl}#${sharedViewUrl(link)}` }}
                  </nuxt-link>
                </td>
                <td class="caption">
                  <template v-if="link.password">
                    <span>{{ link.showPassword ? link.password : '***************************' }}</span>
                    <v-icon small @click="$set(link, 'showPassword' , !link.showPassword)">
                      {{ link.showPassword ? 'visibility_off' : 'visibility' }}
                    </v-icon>
                  </template>
                </td>
                <td class="caption">
                  <v-icon small @click="copyLink(link)">
                    mdi-content-copy
                  </v-icon>
                  <v-icon small @click="deleteLink(link.id)">
                    mdi-delete-outline
                  </v-icon>
                </td>
              </tr>
            </template>
          </tbody>
        </v-simple-table>
        <div class="mt-1 pl-2">
          <v-switch
            v-model="allSharedLinks"
            class="nc-switch-show-all"
            hide-details
          >
            <template #label>
              <span class="caption">
                <!--Show all shared views of this table-->
                {{ $t('msg.info.showAllViews') }}
              </span>
            </template>
          </v-switch>
        </div>
      </div>
      <v-spacer />
    </v-container>
  </div>
</template>

<script>
import { ViewTypes } from 'nocodb-sdk'
import viewIcons from '~/helpers/viewIcons'
import { copyTextToClipboard } from '~/helpers/xutils'

export default {
  name: 'SharedViewsList',
  props: ['modelName', 'nodes', 'selectedView', 'meta'],
  data: () => ({
    viewList: null,
    currentView: null,
    viewIcons,
    allSharedLinks: false
  }),
  computed: {
    origin() {
      return location.origin
    }
  },
  created() {
    this.loadSharedViewsList()
  },
  methods: {
    copyLink(view) {
      copyTextToClipboard(`${this.dashboardUrl}#${this.sharedViewUrl(view)}`)
      this.$toast.info('Copied to clipboard').goAway(1000)
    },
    async loadSharedViewsList() {
      // const viewList = await this.$store.dispatch('sqlMgr/ActSqlOp', [{ dbAlias: this.nodes.dbAlias }, 'listSharedViewLinks', {
      //   model_name: this.modelName
      // }])

      const viewList = (await this.$api.dbViewShare.list(this.meta.id))

      const index = viewList.findIndex((v) => {
        return this.selectedView && this.selectedView.id === v.id
      })

      if (index > -1) {
        this.currentView = viewList.splice(index, 1)[0]
      } else {
        this.currentView = null
      }

      this.viewList = viewList
    },
    async deleteLink(id) {
      try {
        await this.$api.dbViewShare.delete(id)
        this.$toast.success('Deleted shared view successfully').goAway(3000)
        await this.loadSharedViewsList()
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    },
    sharedViewUrl(view) {
      let viewType
      switch (view.type) {
        case ViewTypes.FORM:
          viewType = 'form'
          break
        case ViewTypes.KANBAN:
          viewType = 'kanban'
          break
        default:
          viewType = 'view'
      }
      return `/nc/${viewType}/${view.uuid}`
    }
  }
}
</script>

<style scoped>
th, td {
  padding: 0 5px;
}

/deep/ .nc-switch-show-all .v-input--selection-controls__input {
  transform: scale(0.5) !important;
}

</style>
