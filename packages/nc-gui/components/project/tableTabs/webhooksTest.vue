<template>
  <div>
    <h5>Sample payload</h5>
    <monaco-json-object-editor v-model="sampleData" read-only style="min-height: 300px" class="caption mb-2" />
    <v-btn small @click="testWebhook">
      Test webhook
    </v-btn>
  </div>
</template>

<script>

import MonacoJsonObjectEditor from '~/components/monaco/MonacoJsonObjectEditor'
export default {
  name: 'WebhooksTest',
  components: { MonacoJsonObjectEditor },
  props: {
    modelId: String,
    hook: Object
  },
  data: () => ({
    sampleData: null
  }),
  watch: {
    async 'hook.operation'() {
      await this.loadSampleData()
    }
  },
  created() {
    this.loadSampleData()
  },
  methods: {
    async   loadSampleData() {
      this.sampleData = {
        data: (await this.$api.dbTableWebhook.samplePayloadGet(this.modelId, this.hook.operation)),
        user: this.$store.state.users.user
      }
    },
    async testWebhook() {
      try {
        const res = await this.$api.dbTableWebhook.test(this.modelId, {
          hook: this.hook,
          payload: this.sampleData
        })

        this.$toast.success('Webhook tested successfully').goAway(3000)
      } catch (_e) {
        const e = await this._extractSdkResponseError(_e)
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }
}
</script>

<style scoped>
/*tr.selected{*/
/*  background: #8ceaf6;*/
/*}*/

/deep/ label {
  font-size: 0.75rem !important
}
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
