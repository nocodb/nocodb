<template>
  <v-card width="1000" max-width="100%">
    <v-toolbar height="55" class="elevation-1">
      <div class="d-100 d-flex ">
        <h5 class="title text-center">
          <v-icon :color="iconColor">
            mdi-table-arrow-right
          </v-icon>
          {{ table }} : {{ localState[primaryValueColumn] }}
        </h5>
        <v-spacer />
        <v-btn small text @click="reload">
          <v-icon small>
            mdi-reload
          </v-icon>
        </v-btn>

        <x-icon
          :tooltip="`${showSystemFields ? 'Hide' : 'Show'} system fields`"
          icon.class="mr-3 mt-n1"
          small
          @click="showSystemFields = !showSystemFields"
        >
          mdi-table-headers-eye
        </x-icon>

        <x-icon
          v-if="!isNew"
          icon-class="mr-2"
          tooltip="Toggle comments"
          small
          text
          @click="toggleDrawer = !toggleDrawer"
        >
          {{ toggleDrawer ? 'mdi-door-open' : 'mdi-door-closed' }}
        </x-icon>

        <v-btn small @click="$emit('cancel')">
          Cancel
        </v-btn>
        <v-btn small color="primary" @click="save">
          Save Row
        </v-btn>
      </div>
    </v-toolbar>
    <div class="form-container ">
      <v-card-text
        class=" py-0 px-0 "
        :class="{
          'px-10' : isNew || !toggleDrawer,
        }"
      >
        <v-breadcrumbs
          v-if="localBreadcrumbs && localBreadcrumbs.length"
          class="caption pt-0 pb-2 justify-center d-100"
          :items="localBreadcrumbs.map(text => ({text}))"
        />

        <v-container fluid style="height:70vh" class="py-0">
          <v-row class="h-100">
            <v-col class="h-100 px-10" style="overflow-y: auto" cols="8" :offset="isNew || !toggleDrawer ? 2 : 0">
              <template
                v-for="(col,i) in fields"
              >
                <div
                  v-if="!col.lk"
                  :key="i"
                  :class="{
                    'active-row' : active === col._cn,
                    required: isRequired(col, localState)
                  }"
                  class="row-col  my-4"
                >
                  <div>
                    <label :for="`data-table-form-${col._cn}`" class="body-2 text-capitalize">
                      <virtual-header-cell
                        v-if="col.virtual"
                        :column="col"
                        :nodes="nodes"
                        :is-form="true"
                        :meta="meta"
                      />
                      <header-cell
                        v-else
                        :is-form="true"
                        :is-foreign-key="col.cn in belongsTo || col.cn in hasMany"
                        :value="col._cn"
                        :column="col"
                        :sql-ui="sqlUi"
                      />

                    </label>
                    <virtual-cell
                      v-if="col.virtual"
                      ref="virtual"
                      :disabled-columns="disabledColumns"
                      :column="col"
                      :row="localState"
                      :nodes="nodes"
                      :meta="meta"
                      :api="api"
                      :active="true"
                      :sql-ui="sqlUi"
                      :is-new="isNew"
                      :is-form="true"
                      :breadcrumbs="localBreadcrumbs"
                      @updateCol="updateCol"
                      @newRecordsSaved="$listeners.loadTableData|| reload"
                    />

                    <div
                      v-else-if="col.ai || (col.pk && !isNew) || disabledColumns[col._cn]"
                      style="height:100%; width:100%"
                      class="caption xc-input"
                      @click="col.ai && $toast.info('Auto Increment field is not editable').goAway(3000)"
                    >
                      <input
                        style="height:100%; width: 100%"
                        readonly
                        disabled
                        :value="localState[col._cn]"
                      >
                    </div>

                    <editable-cell
                      v-else
                      :id="`data-table-form-${col._cn}`"
                      v-model="localState[col._cn]"
                      :db-alias="dbAlias"
                      :column="col"
                      class="xc-input body-2"
                      :meta="meta"
                      :sql-ui="sqlUi"
                      is-form
                      @focus="active = col._cn"
                      @blur="active = ''"
                      @input="$set(changedColumns,col._cn, true)"
                    />
                  </div>
                </div>
              </template>
            </v-col>
            <v-col
              v-if="!isNew && toggleDrawer"
              cols="4"
              class="d-flex flex-column h-100 flex-grow-1 blue-grey  "
              :class="{
                'lighten-5':!$vuetify.theme.dark,
                'darken-4':$vuetify.theme.dark
              }"
            >
              <v-skeleton-loader v-if="loadingLogs && !logs" type="list-item-avatar-two-line@8" />

              <v-list
                v-else
                ref="commentsList"
                width="100%"
                style="overflow-y: auto; overflow-x: auto"
                class="blue-grey "
                :class="{
                  'lighten-5':!$vuetify.theme.dark,
                  'darken-4':$vuetify.theme.dark
                }"
              >
                <v-list-item v-for="log in logs" :key="log.id" class="d-flex">
                  <v-list-item-icon class="ma-0 mr-2">
                    <v-icon :color="isYou(log.user) ? 'pink lighten-2' : 'blue lighten-2'">
                      mdi-account-circle
                    </v-icon>
                  </v-list-item-icon>
                  <div class="flex-grow-1">
                    <p class="mb-1 caption edited-text">
                      {{ isYou(log.user) ? 'You' : log.user }} {{
                        log.op_type === 'COMMENT' ? 'commented' : (
                          log.op_sub_type === 'INSERT' ? 'created' : 'edited'
                        )
                      }}
                    </p>
                    <p v-if="log.op_type === 'COMMENT'" class="caption mb-0">
                      <v-chip small :color="colors[2]">
                        {{ log.description }}
                      </v-chip>
                    </p>

                    <p v-else class="caption mb-0" style="word-break: break-all;" v-html="log.details" />

                    <p class="time text-right mb-0">
                      {{ calculateDiff(log.created_at) }}
                    </p>
                  </div>
                </v-list-item>
              </v-list>

              <v-spacer />
              <v-divider />
              <div class="d-flex align-center justify-center">
                <v-switch v-model="commentsOnly" class="mt-1" dense hide-details @change="getAuditsAndComments">
                  <template #label>
                    <span class="caption grey--text">Comments only</span>
                  </template>
                </v-switch>
              </div>
              <div class="flex-shrink-1 mt-2 d-flex pl-4">
                <v-icon color="pink lighten-2" class="mr-2">
                  mdi-account-circle
                </v-icon>
                <v-text-field
                  v-model="comment"
                  dense
                  placeholder="Comment"
                  flat
                  solo
                  hide-details
                  class="caption comment-box"
                  :class="{ focus : showborder }"
                  @focusin=" showborder = true"
                  @focusout=" showborder = false"
                  @keyup.enter.prevent="saveComment"
                >
                  <template v-if="comment" #append>
                    <x-icon tooltip="Save" small @click="saveComment">
                      mdi-keyboard-return
                    </x-icon>
                  </template>
                </v-text-field>
              </div>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
    </div>

    <v-btn
      v-show="!toggleDrawer"
      class="comment-icon"
      color="primary"
      fab
      @click="toggleDrawer = !toggleDrawer"
    >
      <v-icon>mdi-comment-multiple-outline</v-icon>
    </v-btn>
  </v-card>
</template>

<script>

import HeaderCell from '@/components/project/spreadsheet/components/headerCell'
import EditableCell from '@/components/project/spreadsheet/components/editableCell'
import dayjs from 'dayjs'
import colors from '@/mixins/colors'
import VirtualCell from '@/components/project/spreadsheet/components/virtualCell'
import VirtualHeaderCell from '@/components/project/spreadsheet/components/virtualHeaderCell'

const relativeTime = require('dayjs/plugin/relativeTime')
const utc = require('dayjs/plugin/utc')
dayjs.extend(utc)
dayjs.extend(relativeTime)
export default {
  name: 'ExpandedForm',
  components: { VirtualHeaderCell, VirtualCell, EditableCell, HeaderCell },
  mixins: [colors],
  props: {
    breadcrumbs: {
      type: Array,
      default() {
        return []
      }
    },
    dbAlias: String,
    value: Object,
    meta: Object,
    sqlUi: [Object, Function],
    table: String,
    primaryValueColumn: String,
    api: [Object],
    hasMany: [Object, Array],
    belongsTo: [Object, Array],
    isNew: Boolean,
    oldRow: Object,
    iconColor: {
      type: String,
      default: 'primary'
    },
    availableColumns: [Object, Array],
    nodes: [Object],
    queryParams: Object,
    disabledColumns: {
      type: Object,
      default() {
        return {}
      }
    }
  },
  data: () => ({
    showborder: false,
    loadingLogs: true,
    toggleDrawer: false,
    logs: null,
    active: '',
    localState: {},
    changedColumns: {},
    comment: null,
    showSystemFields: false,
    commentsOnly: false
  }),
  computed: {
    primaryKey() {
      return this.isNew ? '' : this.meta.columns.filter(c => c.pk).map(c => this.localState[c._cn]).join('___')
    },
    edited() {
      return !!Object.keys(this.changedColumns).length
    },
    fields() {
      if (this.availableColumns) {
        return this.availableColumns
      }

      const hideCols = ['created_at', 'updated_at']

      if (this.showSystemFields) {
        return this.meta.columns || []
      } else {
        return this.meta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c.cn) &&
          !((this.meta.v || []).some(v => v.bt && v.bt.cn === c.cn))
        ) || []
      }
    },
    isChanged() {
      return Object.values(this.changedColumns).some(Boolean)
    },
    localBreadcrumbs() {
      return [...this.breadcrumbs, `${this.table} (${this.localState && this.localState[this.primaryValueColumn]})`]
    }
  },
  watch: {
    value(obj) {
      this.localState = { ...obj }
      if (!this.isNew && this.toggleDrawer) {
        this.getAuditsAndComments()
      }
    },
    isNew(n) {
      if (!n && this.toggleDrawer) {
        this.getAuditsAndComments()
      }
    },
    meta() {
      if (!this.isNew && this.toggleDrawer) {
        this.getAuditsAndComments()
      }
    },
    toggleDrawer(td) {
      if (td) {
        this.getAuditsAndComments()
      }
    }
  },
  created() {
    this.localState = { ...this.value }
    if (!this.isNew && this.toggleDrawer) {
      this.getAuditsAndComments()
    }
  },
  methods: {
    isRequired(_columnObj, rowObj) {
      let columnObj = _columnObj
      if (columnObj.bt) {
        columnObj = this.meta.columns.find(c => c.cn === columnObj.bt.cn)
      }

      return (columnObj.rqd &&
        (rowObj[columnObj._cn] === undefined || rowObj[columnObj._cn] === null) &&
        !columnObj.default)
    },
    updateCol(_row, _cn, pid) {
      this.$set(this.localState, _cn, pid)
      this.$set(this.changedColumns, _cn, true)
    },
    isYou(email) {
      return this.$store.state.users.user && this.$store.state.users.user.email === email
    },
    async getAuditsAndComments() {
      this.loadingLogs = true
      const data = await this.$store.dispatch('sqlMgr/ActSqlOp', [{ dbAlias: this.dbAlias }, 'xcModelRowAuditAndCommentList', {
        model_id: this.meta.columns.filter(c => c.pk).map(c => this.localState[c._cn]).join('___'),
        model_name: this.meta._tn,
        comments: this.commentsOnly
      }])
      this.logs = data.list
      this.loadingLogs = false
    },
    async save() {
      try {
        const id = this.meta.columns.filter(c => c.pk).map(c => this.localState[c._cn]).join('___')

        const updatedObj = Object.keys(this.changedColumns).reduce((obj, col) => {
          obj[col] = this.localState[col]
          return obj
        }, {})

        if (this.isNew) {
          const data = await this.api.insert(updatedObj)
          this.localState = { ...this.localState, ...data }

          // save hasmany and manytomany relations from local state
          if (this.$refs.virtual && Array.isArray(this.$refs.virtual)) {
            for (const vcell of this.$refs.virtual) {
              if (vcell.save) {
                await vcell.save(this.localState)
              }
            }
          }

          await this.reload()
        } else if (Object.keys(updatedObj).length) {
          if (!id) {
            return this.$toast.info('Update not allowed for table which doesn\'t have primary Key').goAway(3000)
          }
          await this.api.update(id, updatedObj, this.oldRow)
        } else {
          return this.$toast.info('No columns to update').goAway(3000)
        }

        this.$emit('update:oldRow', { ...this.localState })
        this.changedColumns = {}
        this.$emit('input', this.localState)
        this.$emit('update:isNew', false)

        this.$toast.success(`${this.localState[this.primaryValueColumn]} updated successfully.`, {
          position: 'bottom-right'
        }).goAway(3000)
      } catch (e) {
        this.$toast.error(`Failed to update row : ${e.message}`).goAway(3000)
      }
    },
    async reload() {
      const id = this.meta.columns.filter(c => c.pk).map(c => this.localState[c._cn]).join('___')
      // const where = this.meta.columns.filter(c => c.pk).map(c => `(${c._cn},eq,${this.localState[c._cn]})`).join('~and')
      this.$set(this, 'changedColumns', {})
      this.localState = await this.api.read(id, this.queryParams || {})
      // const data = await this.api.list({ ...(this.queryParams || {}), where }) || [{}]
      // this.localState = data[0] || this.localState
      if (!this.isNew && this.toggleDrawer) {
        this.getAuditsAndComments()
      }
    },
    calculateDiff(date) {
      return dayjs.utc(date).fromNow()
    },
    async saveComment() {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [
          { dbAlias: this.dbAlias },
          'xcAuditCommentInsert', {
            model_id: this.meta.columns.filter(c => c.pk).map(c => this.localState[c._cn]).join('___'),
            model_name: this.meta._tn,
            description: this.comment
          }
        ])
        this.comment = ''
        this.$toast.success('Comment added successfully').goAway(3000)
        this.$emit('commented')
        await this.getAuditsAndComments()
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }
}
</script>

<style scoped lang="scss">
.row-col > label {
  color: grey;
  font-weight: 700;
}

.row-col:focus > label, .active-row > label {
  color: var(--v-primary-base);
}

.title.text-center {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

::v-deep {

  .v-breadcrumbs__item:nth-child(odd) {
    font-size: .72rem;
    color: grey;
  }

  .v-breadcrumbs li:nth-child(even) {
    padding: 0 6px;
    font-size: .72rem;
    color: var(--v-textColor-base);
  }

  position: relative;

  .comment-icon {
    position: absolute;
    right: 60px;
    bottom: 60px;
  }

  /* todo: refactor */
  .row-col {
    & > div > input,
      //& > div div > input,
    & > div > .xc-input > input,
    & > div > .xc-input > div > input,
    & > div > select,
    & > div > .xc-input > select,
    & > div textarea:not(.inputarea) {
      border: 1px solid #7f828b33;
      padding: 1px 5px;
      font-size: .8rem;
      border-radius: 4px;
      min-height: 44px;

      &:focus {
        border: 1px solid var(--v-primary-base);
      }

      &:hover:not(:focus) {
        box-shadow: 0 0 2px dimgrey;
      }

    }

  }

  &.v-card {

    &.theme--dark .v-card__text {
      background: #363636;

      .row-col {
        //& > div div > input,
        & > div > input,
        & > div > .xc-input > input,
        & > div > .xc-input > div > input,
        & > div > select,
        & > div > .xc-input > select,
        & > div textarea:not(.inputarea) {
          background: #1e1e1e;
        }
      }
    }

    &.theme--light .v-card__text {
      background-color: #f1f1f1 !important;

      .row-col {
        & > div > input,
          //& > div div > input,
        & > div > .xc-input > input,
        & > div > .xc-input > div > input,
        & > div > select,
        & > div > .xc-input > select,
        & > div textarea:not(.inputarea) {
          background: white;
        }
      }
    }

  }

}

h5 {
  color: var(--v-textColor-base);
}

.form-container {
  max-height: calc(100vh - 200px);
  min-height: 200px;
  overflow: auto;
}

.time, .edited-text {
  font-size: .65rem;
  color: grey;
}

.comment-box.focus {
  border: 1px solid #4185f4;
}

.required > div > label + * {
  border: 1px solid red;
  border-radius: 4px;
  //min-height: 42px;
  //display: flex;
  //align-items: center;
  //justify-content: flex-end;
  background: var(--v-backgroundColorDefault-base);
}
</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Ayush Sahu <aztrexdx@gmail.com>
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
