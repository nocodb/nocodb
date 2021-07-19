<template>
  <div>
    <v-toolbar flat height="38" class="toolbar-border-bottom">
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
        Reload
      </x-btn>
      <x-btn
        v-if="_isUIAllowed('newUser')"
        v-ge="['roles','add new']"
        outlined
        tooltip="Generate new API token"
        color="primary"
        small
        :disabled="loading"
        @click="newTokenDialog = true"
      >
        <v-icon small left>
          mdi-plus
        </v-icon>
        New Token
      </x-btn>
    </v-toolbar>

    <v-container fluid>
      <v-simple-table v-if="tokens" dense class="mx-auto caption text-center" style="max-width:700px">
        <thead>
          <tr class="">
            <th class="caption text-center">
              Description
            </th>
            <th class="caption text-center">
              Token
            </th>
            <th class="caption text-center">
              Actions
            </th>
          </tr>
        </thead>
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
        <tr>
          <td colspan="3" class="text-center">
            <x-btn tooltip="Generate new api token" outlined x-small color="primary" @click="newTokenDialog = true">
              <v-icon>mdi-plus</v-icon>
              Add New Token
            </x-btn>
          </td>
        </tr>
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
                label="Description"
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
    copyToken(token) {
      this.$clipboard(token)
      this.$toast.info('Copied to clipboard').goAway(1000)
    },
    async loadApiTokens() {
      this.tokens = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcApiTokenList'])
    },
    async generateToken() {
      try {
        this.newTokenDialog = false
        this.tokens = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcApiTokenCreate', this.tokenObj])
        this.$toast.success('Token generated successfully').goAway(3000)
        this.tokenObj = {}
        await this.loadApiTokens()
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    },
    async deleteToken(item) {
      try {
        this.tokens = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcApiTokenDelete', { id: item.id }])
        this.$toast.success('Token deleted successfully').goAway(3000)
        await this.loadApiTokens()
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }
}
</script>

<style scoped>

</style>
