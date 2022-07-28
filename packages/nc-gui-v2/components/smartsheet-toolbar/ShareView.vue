<script lang="ts" setup>
import { useClipboard } from '@vueuse/core'
import { ViewTypes } from 'nocodb-sdk'
import { useSmartsheetStoreOrThrow } from '~/composables/useSmartsheetStore'
import MdiOpenInNewIcon from '~icons/mdi/open-in-new'
import MdiCopyIcon from '~icons/mdi/content-copy'

const { isUIAllowed } = useUIPermission()
const { view, $api } = useSmartsheetStoreOrThrow()

const { copy } = useClipboard()

let showShareModel = $ref(false)
const shared = ref()

const source = ref('Hello')

const genShareLink = async () => {
  shared.value = await $api.dbViewShare.create(view.value.id as string)
  // shared.meta = shared.meta && typeof shared.meta === 'string' ? JSON.parse(shared.meta) : shared.meta;
  // // todo: url
  // this.shareLink = shared;
  // this.passwordProtect = shared.password !== null;
  // this.allowCSVDownload = shared.meta.allowCSVDownload;
  showShareModel = true
}

const sharedViewUrl = computed(() => {
  if (!shared.value) return
  let viewType

  switch (shared.value.type) {
    case ViewTypes.FORM:
      viewType = 'form'
      break
    case ViewTypes.KANBAN:
      viewType = 'kanban'
      break
    default:
      viewType = 'view'
  }

  // todo: get dashboard url
  return `#/nc/${viewType}/${shared.value.uuid}`
})
</script>

<template>
  <div>
    <a-button v-t="['c:view:share']" outlined class="nc-btn-share-view nc-toolbar-btn" size="small">
      <div class="flex align-center gap-1" @click="genShareLink">
        <MdiOpenInNewIcon class="text-grey" />
        <!-- Share View -->
        {{ $t('activity.shareView') }}
      </div>
    </a-button>

    <!-- This view is shared via a private link -->
    <a-modal v-model:visible="showShareModel" size="small" :title="$t('msg.info.privateLink')">
      <div class="share-link-box nc-share-link-box">
        <div class="flex-1 h-min">{{ sharedViewUrl }}</div>
        <!--        <v-spacer /> -->
        <a v-t="['c:view:share:open-url']" :href="sharedViewUrl" target="_blank">
          <MdiOpenInNewIcon class="text-sm text-grey mt-1" />
        </a>
        <MdiCopyIcon class="text-grey text-sm cursor-pointer" @click="copy(sharedViewUrl)" />
      </div>
      <!--
                <v-expansion-panels v-model="advanceOptionsPanel" class="mx-auto" flat>
                  <v-expansion-panel>
                    <v-expansion-panel-header hide-actions>
                      <v-spacer />
                      <span class="grey&#45;&#45;text caption"
                        >More Options
                        <v-icon color="grey" small> mdi-chevron-{{ advanceOptionsPanel === 0 ? 'up' : 'down' }} </v-icon></span
                      >
                    </v-expansion-panel-header>
                    <v-expansion-panel-content>
                      <v-checkbox
                        v-model="passwordProtect"
                        class="caption"
                        :label="$t('msg.info.beforeEnablePwd')"
                        hide-details
                        dense
                        @change="onPasswordProtectChange"
                      />
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
                          &lt;!&ndash; Save password &ndash;&gt;
                          {{ $t('placeholder.password.save') }}
                        </v-btn>
                      </div>
                      <v-checkbox
                        v-if="selectedView && selectedView.type === viewTypes.GRID"
                        v-model="allowCSVDownload"
                        class="caption"
                        label="Allow Download"
                        hide-details
                        dense
                        @change="onAllowCSVDownloadChange"
                      />
                    </v-expansion-panel-content>
                  </v-expansion-panel>
                </v-expansion-panels> -->
      <!--      </v-container> -->
      <!--      </v-card> -->
    </a-modal>
  </div>
</template>

<style scoped>
.share-link-box {
  @apply flex p-2 w-full items-center align-center gap-1 bg-gray-100 rounded;
}
</style>
