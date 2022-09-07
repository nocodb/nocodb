<template>
  <div>
    <h5 @click="isVisible = !isVisible">
      Sample payload <v-icon x-small> mdi-chevron-{{ isVisible ? 'up' : 'down' }} </v-icon>
    </h5>
    <div :class="{ active: isVisible }" class="nc-sample-data">
      <monaco-json-object-editor v-model="sampleData" read-only style="min-height: 300px" class="caption mb-2" />
    </div>
    <v-btn v-if="!hideTestBtn" small @click="testWebhook"> Test webhook </v-btn>
  </div>
</template>

<script>
import MonacoJsonObjectEditor from '~/components/monaco/MonacoJsonObjectEditor';
export default {
  name: 'WebhooksTest',
  components: { MonacoJsonObjectEditor },
  props: {
    modelId: String,
    hook: Object,
    hideTestBtn: Boolean,
  },
  data: () => ({
    sampleData: null,
    isVisible: false,
  }),
  watch: {
    async 'hook.operation'() {
      await this.loadSampleData();
    },
  },
  created() {
    this.loadSampleData();
  },
  methods: {
    async loadSampleData() {
      this.sampleData = {
        data: await this.$api.dbTableWebhook.samplePayloadGet(this.modelId, this.hook.operation),
        user: this.$store.state.users.user,
      };
    },
    async testWebhook() {
      try {
        await this.$api.dbTableWebhook.test(this.modelId, {
          hook: this.hook,
          payload: this.sampleData,
        });

        this.$toast.success('Webhook tested successfully').goAway(3000);
      } catch (e) {
        const msg = await this._extractSdkResponseErrorMsg(e);
        this.$toast.error(msg).goAway(3000);
      }
    },
  },
};
</script>

<style scoped>
/*tr.selected{*/
/*  background: #8ceaf6;*/
/*}*/

/deep/ label {
  font-size: 0.75rem !important;
}

.nc-sample-data {
  overflow-y: hidden;
  height: 0;
  transition: 0.3s height;
}
.nc-sample-data.active {
  height: 300px;
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
