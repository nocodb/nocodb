<template>
  <v-card width="1000" max-width="100%">
    <v-toolbar height="55" class="elevation-1">
      <div class="d-100 d-flex ">
        <h5 class="title text-center">
          <v-icon :color="iconColor">
            mdi-table-arrow-right
          </v-icon>

          <template v-if="meta">
            {{ meta.title }}
          </template>
          <template v-else>
            {{ table }}
          </template>
          : {{ primaryValue() }}
        </h5>
        <v-spacer />
        <v-btn small text @click="reload">
          <v-icon small>
            mdi-reload
          </v-icon>
        </v-btn>

        <x-icon
          v-if="!isNew && _isUIAllowed('rowComments')"
          icon-class="mr-2"
          tooltip="Toggle comments"
          small
          text
          @click="toggleDrawer = !toggleDrawer"
        >
          {{ toggleDrawer ? 'mdi-door-open' : 'mdi-door-closed' }}
        </x-icon>

        <v-btn small @click="$emit('cancel')">
          <!-- Cancel -->
          {{ $t('general.cancel') }}
        </v-btn>
        <v-btn :disabled="!_isUIAllowed('tableRowUpdate')" small color="primary" @click="save">
          <!--Save Row-->
          {{ $t('activity.saveRow') }}
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
              <div v-if="showNextPrev" class="d-flex my-4">
                <x-icon tooltip="Previous record" small outlined @click="$emit('prev', localState)">
                  mdi-arrow-left-bold-outline
                </x-icon>
                <span class="flex-grow-1" />
                <x-icon tooltip="Next record" small outlined @click="$emit('next', localState)">
                  mdi-arrow-right-bold-outline
                </x-icon>
              </div>

              <template
                v-for="(col,i) in fields"
              >
                <div
                  v-if="!col.lk && (!showFields || showFields[col.title])"
                  :key="i"
                  :class="{
                    'active-row' : active === col.title,
                    required: isValid(col, localState)
                  }"
                  class="row-col  my-4"
                >
                  <div>
                    <label :for="`data-table-form-${col.title}`" class="body-2 text-capitalize">
                      <virtual-header-cell
                        v-if="col.colOptions"
                        :column="col"
                        :nodes="nodes"
                        :is-form="true"
                        :meta="meta"
                      />
                      <header-cell
                        v-else
                        :is-form="true"
                        :is-foreign-key="col.type === UITypes.ForeignKey"
                        :value="col.title"
                        :column="col"
                        :sql-ui="sqlUi"
                      />

                    </label>
                    <virtual-cell
                      v-if="isVirtualCol(col)"
                      ref="virtual"
                      :disabled-columns="disabledColumns"
                      :column="col"
                      :row="localState"
                      :nodes="nodes"
                      :meta="meta"
                      :api="api"
                      :active="true"
                      :is-new="isNew"
                      :is-form="true"
                      :breadcrumbs="localBreadcrumbs"
                      @updateCol="updateCol"
                      @newRecordsSaved="$listeners.loadTableData|| reload"
                    />

                    <div
                      v-else-if="col.ai || (col.pk && !isNew) || disabledColumns[col.title]"
                      style="height:100%; width:100%"
                      class="caption xc-input"
                      @click="col.ai && $toast.info('Auto Increment field is not editable').goAway(3000)"
                    >
                      <input
                        style="height:100%; width: 100%"
                        readonly
                        disabled
                        :value="localState[col.title]"
                      >
                    </div>

                    <editable-cell
                      v-else
                      :id="`data-table-form-${col.title}`"
                      v-model="localState[col.title]"
                      :db-alias="dbAlias"
                      :column="col"
                      class="xc-input body-2"
                      :meta="meta"
                      :sql-ui="sqlUi"
                      :is-form="true"
                      :is-locked="isLocked"
                      @focus="active = col.title"
                      @blur="active = ''"
                      @input="$set(changedColumns,col.title, true)"
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
                <div>
                  <v-list-item v-for="log in logs" :key="log.id" class="d-flex">
                    <v-list-item-icon class="ma-0 mr-2">
                      <v-icon :color="isYou(log.user) ? 'pink lighten-2' : 'blue lighten-2'">
                        mdi-account-circle
                      </v-icon>
                    </v-list-item-icon>
                    <div class="flex-grow-1" style="min-width: 0">
                      <p class="mb-1 caption edited-text">
                        {{ isYou(log.user) ? 'You' : log.user == null ? 'Shared base' : log.user }} {{
                          log.op_type === 'COMMENT' ? 'commented' : (
                            log.op_sub_type === 'INSERT' ? 'created' : 'edited'
                          )
                        }}
                      </p>
                      <p v-if="log.op_type === 'COMMENT'" class="caption mb-0 nc-chip" :style="{background :colors[2]}">
                        {{ log.description }}
                      </p>

                      <p v-else class="caption mb-0" style="word-break: break-all;" v-html="log.details" />

                      <p class="time text-right mb-0">
                        {{ calculateDiff(log.created_at) }}
                      </p>
                    </div>
                  </v-list-item>
                </div>
              </v-list>

              <v-spacer />
              <v-divider />
              <div class="d-flex align-center justify-center">
                <v-switch
                  v-model="commentsOnly"
                  v-t="['record:comment:comments-only']"
                  class="mt-1"
                  dense
                  hide-details
                  @change="getAuditsAndComments"
                >
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
      v-if="_isUIAllowed('rowComments')"
      v-show="!toggleDrawer"
      v-t="['record:comment-toggle']"
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

import dayjs from 'dayjs'
import { AuditOperationSubTypes, AuditOperationTypes, isVirtualCol, UITypes } from 'nocodb-sdk'
import form from '../mixins/form'
import HeaderCell from '@/components/project/spreadsheet/components/headerCell'
import EditableCell from '@/components/project/spreadsheet/components/editableCell'
import colors from '@/mixins/colors'
import VirtualCell from '@/components/project/spreadsheet/components/virtualCell'
import VirtualHeaderCell from '@/components/project/spreadsheet/components/virtualHeaderCell'

const relativeTime = require('dayjs/plugin/relativeTime')
const utc = require('dayjs/plugin/utc')
dayjs.extend(utc)
dayjs.extend(relativeTime)
export default {
  name: 'ExpandedForm',
  components: {
    VirtualHeaderCell,
    VirtualCell,
    EditableCell,
    HeaderCell
  },
  mixins: [colors, form],
  props: {
    showFields: Object,
    showNextPrev: {
      type: Boolean,
      default: false
    },
    breadcrumbs: {
      type: Array,
      default() {
        return []
      }
    },
    dbAlias: String,
    value: Object,
    table: String,
    primaryValueColumn: String,
    // hasMany: [Object, Array],
    // belongsTo: [Object, Array],
    isNew: Boolean,
    oldRow: Object,
    iconColor: {
      type: String,
      default: 'primary'
    },
    availableColumns: [Object, Array],
    queryParams: Object,
    meta: Object,
    presetValues: Object,
    isLocked: Boolean
  },
  data: () => ({
    isVirtualCol,
    UITypes,
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
      return this.isNew ? '' : this.meta.columns.filter(c => c.pk).map(c => this.localState[c.title]).join('___')
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
        return this.meta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c.column_name) &&
          !((this.meta.v || []).some(v => v.bt && v.bt.column_name === c.column_name))
        ) || []
      }
    },
    isChanged() {
      return Object.values(this.changedColumns).some(Boolean)
    },
    localBreadcrumbs() {
      return [...this.breadcrumbs, `${this.meta ? this.meta.title : this.table} ${this.primaryValue() ? `(${this.primaryValue()})` : ''}`]
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
    updateCol(_row, _cn, pid) {
      this.$set(this.localState, _cn, pid)
      this.$set(this.changedColumns, _cn, true)
    },
    isYou(email) {
      return this.$store.state.users.user && this.$store.state.users.user.email === email
    },
    async getAuditsAndComments() {
      this.loadingLogs = true

      const data = (await this.$api.utils.commentList({
        row_id: this.meta.columns.filter(c => c.pk).map(c => this.localState[c.title]).join('___'),
        fk_model_id: this.meta.id,
        comments_only: this.commentsOnly
      }))

      this.logs = data.reverse()
      this.loadingLogs = false

      this.$nextTick(() => {
        if (this.$refs.commentsList && this.$refs.commentsList.$el && this.$refs.commentsList.$el.firstElementChild) {
          this.$refs.commentsList.$el.scrollTop = this.$refs.commentsList.$el.firstElementChild.offsetHeight
        }
      })
    },
    async save() {
      try {
        const id = this.meta.columns.filter(c => c.pk).map(c => this.localState[c.title]).join('___')

        if (this.presetValues) {
          // cater presetValues
          for (const k in this.presetValues) {
            this.$set(this.changedColumns, k, true)
          }
        }

        const updatedObj = Object.keys(this.changedColumns).reduce((obj, col) => {
          obj[col] = this.localState[col]
          return obj
        }, {})

        if (this.isNew) {
          const data = (await this.$api.data.create(this.viewId || this.meta.id, updatedObj))
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
          await this.$api.data.update(this.viewId || this.meta.id, id, updatedObj)
          for (const key of Object.keys(updatedObj)) {
            // audit
            this.$api.utils.auditRowUpdate({
              fk_model_id: this.meta.id,
              column_name: key,
              row_id: id,
              value: updatedObj[key],
              prev_value: this.oldRow[key]
            }).then(() => {
            })
          }
        } else {
          return this.$toast.info('No columns to update').goAway(3000)
        }

        this.$emit('update:oldRow', { ...this.localState })
        this.changedColumns = {}
        this.$emit('input', this.localState)
        this.$emit('update:isNew', false)

        this.$toast.success(`${this.primaryValue() || 'Row'} updated successfully.`, {
          position: 'bottom-right'
        }).goAway(3000)
      } catch (e) {
        this.$toast.error(`Failed to update row : ${e.message}`).goAway(3000)
      }
      this.$tele.emit('record:add:submit')
    },
    async reload() {
      const id = this.meta.columns.filter(c => c.pk).map(c => this.localState[c.title]).join('___')
      this.$set(this, 'changedColumns', {})
      this.localState = (await this.$api.data.read(this.viewId || this.meta.id, id, { query: this.queryParams || {} }))
    },
    calculateDiff(date) {
      return dayjs.utc(date).fromNow()
    },
    async saveComment() {
      try {

        await this.$api.utils.commentRow({
          fk_model_id: this.meta.id,
          row_id: this.meta.columns.filter(c => c.pk).map(c => this.localState[c.title]).join('___'),
          description: this.comment
        })

        this.comment = ''
        this.$toast.success('Comment added successfully').goAway(3000)
        this.$emit('commented')
        await this.getAuditsAndComments()
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }

      this.$tele.emit('record:comment:insert')
    },
    primaryValue() {
      if (this.localState) {
        const value = this.localState[this.primaryValueColumn]
        const col = this.meta.columns.find(c => c.title == this.primaryValueColumn)
        if (!col) {
          return
        }
        const uidt = col.uidt
        if (uidt == UITypes.Date) {
          return (/^\d+$/.test(value) ? dayjs(+value) : dayjs(value)).format('YYYY-MM-DD')
        } else if (uidt == UITypes.DateTime) {
          return (/^\d+$/.test(value) ? dayjs(+value) : dayjs(value)).format('YYYY-MM-DD HH:mm')
        } else if (uidt == UITypes.Time) {
          let dateTime = dayjs(value)
          if (!dateTime.isValid()) {
            dateTime = dayjs(value, 'HH:mm:ss')
          }
          if (!dateTime.isValid()) {
            dateTime = dayjs(`1999-01-01 ${value}`)
          }
          if (!dateTime.isValid()) {
            return value
          }
          return dateTime.format('HH:mm:ss')
        }
        return value
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

.nc-chip {
  padding: 8px;
  border-radius: 8px;
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
