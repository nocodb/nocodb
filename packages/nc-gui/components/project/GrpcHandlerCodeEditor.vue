<template>
  <v-dialog v-model="dialogShow" persistent max-width="800">
    <v-card>
      <v-progress-linear
        v-if="progressbar"
        indeterminate
        color="green"
      />
      <div class="px-2">
        <v-card-title class=" headline">
          Instant API Editor
          <v-spacer />
          <v-btn small :disabled="progressbar" @click="dialogShow = false">
            <!-- Cancel -->
            {{ $t('general.cancel') }}
          </v-btn>
          <v-btn color="primary" small :disabled="progressbar" @click="saveCode">
            <v-icon small class="mr-1">
              mdi-content-save
            </v-icon>
            <!-- Save -->
            {{ $t('general.save') }}
          </v-btn>
        </v-card-title>

        <v-card-text>
          <!--          <v-textarea-->
          <!--            v-model="code"-->
          <!--          ></v-textarea>-->

          <monaco-ts-editor
            v-model="code"
            style="min-height: 450px"
          />
        </v-card-text>
      </div>
    </v-card>
  </v-dialog>
</template>

<script>
import MonacoTsEditor from '../monaco/MonacoTsEditor'

export default {
  name: 'GrpcHandlerCodeEditor',
  components: { MonacoTsEditor },
  props: {
    value: Boolean,
    service: String,
    serviceData: Object,
    nodes: Object
  },
  data: () => ({
    progressbar: false,
    code: ''
  }),
  computed: {
    dialogShow: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    }
  },
  watch: {
    async service(val) {
      try {
        this.code = JSON.parse(this.serviceData.functions)[0]
      } catch (e) {
        const functionCode = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'defaultRpcServiceCodeGet', {
          tn: this.nodes.table_name || this.nodes.view_name,
          service: this.service,
          relation_type: this.serviceData.relation_type,
          tnc: this.serviceData.tnc
        }])
        if (functionCode) {
          this.code = functionCode
        }
      }
    }
  },
  methods: {
    async saveCode() {
      try {
        this.progressbar = true
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcRpcHandlerUpdate', {
          tn: this.nodes.table_name || this.nodes.view_name,
          service: this.service,
          functions: [this.code]
        }])
        this.$toast.success('API Handler updated successfully').goAway(3000)
        this.dialogShow = false
      } catch (e) {
        console.log('Error', e)
        this.$toast.error('Some internal error occurred').goAway(3000)
      }
      this.progressbar = false
    }
  }
}
</script>

<style scoped>

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
