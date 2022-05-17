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
  name: 'HandlerCodeEditor',
  components: { MonacoTsEditor },
  props: {
    value: Boolean,
    method: String,
    route: String,
    nodes: Object,
    isMiddleware: {
      type: Boolean,
      default: false
    }
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
    async route(val) {
      try {
        if (this.isMiddleware) {
          this.code = JSON.parse(val.functions)[0]
        } else {
          this.code = JSON.parse(val[this.method].functions)[0]
        }
      } catch (e) {
        let functions
        if (this.isMiddleware) {
          functions = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias,
            table_name: this.nodes.table_name || this.nodes.view_name
          }, 'defaultRestMiddlewareCodeGet', {
            title: this.route.title,
            relation_type: this.route.relation_type,
            table_name: this.nodes.table_name || this.nodes.view_name
          }])
        } else {
          functions = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias,
            table_name: this.nodes.table_name || this.nodes.view_name
          }, 'defaultRestHandlerCodeGet', {
            type: this.method,
            path: this.route[this.method].path,
            title: this.route[this.method].title,
            relation_type: this.route[this.method].relation_type,
            tnp: this.route[this.method].table_namep,
            tnc: this.route[this.method].table_namec,
            table_name: this.nodes.table_name || this.nodes.view_name
          }])
        }
        if (functions && functions.length) {
          this.code = functions[0]
        }
      }
    }
  },
  methods: {
    async saveCode() {
      try {
        this.progressbar = true
        if (this.isMiddleware) {
          await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          }, 'xcRoutesMiddlewareUpdate', {
            table_name: this.nodes.table_name || this.nodes.view_name,
            type: this.method,
            functions: [this.code],
            title: this.route.title
          }])
        } else {
          await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          }, 'xcRoutesHandlerUpdate', {
            type: this.method,
            title: this.route[this.method].title,
            functions: [this.code],
            path: this.route[this.method].path,
            relation_type: this.route[this.method].relation_type,
            table_name: this.nodes.table_name || this.nodes.view_name
          }])
        }
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
