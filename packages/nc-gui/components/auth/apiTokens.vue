<template>
  <div>
    <v-toolbar flat height="38" class="mt-5">
      <v-spacer />

      <x-btn
        v-ge="['roles','reload']"
        outlined
        tooltip="Reload API tokens"
        color="primary"
        small
        :disabled="loading"
        @click="loadApiTokens"
        @click.prevent
      >
        <v-icon small left>
          refresh
        </v-icon>
        <!-- Reload -->
        {{ $t('general.reload') }}
      </x-btn>
      <x-btn
        v-if="_isUIAllowed('newUser')"
        v-ge="['roles','add new']"
        outlined
        tooltip="Generate new API token"
        color="primary"
        small
        :disabled="loading"
        @click="showNewTokenDlg"
      >
        <v-icon small left>
          mdi-plus
        </v-icon>
        <!--New Token-->
        {{ $t('activity.newToken') }}
      </x-btn>
    </v-toolbar>

    <v-container fluid>
      <v-simple-table v-if="tokens" dense class="mx-auto caption text-center" style="max-width:700px">
        <thead>
          <tr class="">
            <th class="caption text-center">
              <!--Description-->
              {{ $t('labels.description') }}
            </th>
            <th class="caption text-center">
              <!--Token-->
              {{ $t('labels.token') }}
            </th>
            <th class="caption text-center">
              <!--Actions-->
              {{ $t('labels.action') }}
            </th>
          </tr>
        </thead>

        <tr v-if="!tokens.length">
          <td colspan="3">
            <div
              class="text-center caption grey--text"
            >
              No tokens available
            </div>
          </td>
        </tr>

        <tr v-for="(token,i) in tokens" :key="i">
          <td class="caption text-center">
            {{ token.description }}
          </td>
          <td class="caption text-center">
            <div class="d-flex justify-center">
              <span v-if="token.show">{{ token.token }}</span>
              <span v-else>****************************************</span>
            </div>
          </td>
          <td class="caption">
            <x-icon
              x-small
              icon.class="ml-2"
              :tooltip="`${token.show ?'Hide':'Show' } API token`"
              @click="$set(token,'show' ,!token.show)"
            >
              {{ token.show ? 'visibility_off' : 'visibility' }}
            </x-icon>

            <!--              <v-spacer></v-spacer>-->
            <x-icon x-small icon.class="ml-2" tooltip="Copy token to clipboard" @click="copyToken(token.token)">
              mdi-content-copy
            </x-icon>
            <x-icon
              tooltip="Remove API token"
              class="ml-2"
              color="error"
              x-small
              @click.prevent.stop="deleteToken(token)"
            >
              mdi-delete-outline
            </x-icon>
          </td>
        </tr>
        <!--        <tr>
          <td colspan="3" class="text-center">
            <x-btn tooltip="Generate new api token" outlined x-small color="primary" @click="showNewTokenDlg">
              <v-icon>mdi-plus</v-icon>
              &lt;!&ndash;Add New Token&ndash;&gt;
              {{ $t('activity.newToken') }}
            </x-btn>
          </td>
        </tr>-->
      </v-simple-table>
    </v-container>

    <v-dialog v-model="newTokenDialog" width="400">
      <v-card class="px-15 py-5 " style="min-height: 100%">
        <h4 class="text-center text-capitalize mt-2 d-100 display-1">
          <template>Generate Token</template>
        </h4>

        <v-form v-model="valid" @submit.prevent="generateToken">
          <v-row class="mt-4">
            <v-col cols="12">
              <v-text-field
                v-model="tokenObj.description"
                filled
                dense
                :label="$t('labels.description')"
              />
            </v-col>
          </v-row>
        </v-form>

        <v-card-actions class="justify-center">
          <x-btn
            v-ge="['rows','save']"
            tooltip="Generate new api token"
            color="primary"
            btn.class="mt-5  mb-3 pr-5"
            @click="generateToken"
          >
            Generate
          </x-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { copyTextToClipboard } from '~/helpers/xutils'

export default {
  name: 'ApiTokens',
  data: () => ({
    tokens: null,
    newTokenDialog: false,
    tokenObj: {},
    valid: true
  }),
  created() {
    this.loadApiTokens()
  },
  methods: {
    showNewTokenDlg() {
      this.newTokenDialog = true
      this.$tele.emit('api-mgmt:token:generate:trigger')
    },
    copyToken(token) {
      copyTextToClipboard(token)
      this.$toast.info('Copied to clipboard').goAway(1000)

      this.$tele.emit('api-mgmt:token:copy')
    },
    async loadApiTokens() {
      this.tokens = (await this.$api.apiToken.list(this.$store.state.project.projectId))
    },
    async generateToken() {
      try {
        this.newTokenDialog = false
        await this.$api.apiToken.create(this.$store.state.project.projectId, this.tokenObj)
        this.$toast.success('Token generated successfully').goAway(3000)
        this.tokenObj = {}
        await this.loadApiTokens()
      } catch (e) {
        console.log(e)
        this.$toast.error(e.message).goAway(3000)
      }

      this.$tele.emit('api-mgmt:token:generate:submit')
    },
    async deleteToken(item) {
      try {
        await this.$api.apiToken.delete(this.$store.state.project.projectId, item.token)
        // this.tokens = //await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcApiTokenDelete', { id: item.id }])
        this.$toast.success('Token deleted successfully').goAway(3000)
        await this.loadApiTokens()
      } catch (e) {
        console.log(e)
        this.$toast.error(e.message).goAway(3000)
      }

      this.$tele.emit('api-mgmt:token:delete')
    }
  }
}
</script>

<style scoped>

</style>
