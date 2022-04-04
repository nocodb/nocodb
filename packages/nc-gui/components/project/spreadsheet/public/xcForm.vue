<template>
  <v-container class="h-100 j-excel-container">
    <v-alert v-if="notFound" type="warning" class="mx-auto mt-10" outlined max-width="300">
      Not found
    </v-alert>

    <v-row v-else :class="{'d-flex justify-center': submitted}">
      <template v-if="submitted">
        <v-col class="d-flex justify-center">
          <div v-if="view" style="min-width: 350px">
            <v-alert type="success" outlined>
              <span class="title">{{ view.success_msg || 'Successfully submitted form data' }}</span>
            </v-alert>
            <p v-if="view.show_blank_form" class="caption grey--text text-center">
              New form will be loaded after {{ secondsRemain }} seconds
            </p>
            <div v-if="view.submit_another_form" class=" text-center">
              <v-btn color="primary" @click="submitted = false">
                Submit Another Form
              </v-btn>
            </div>
          </div>
        </v-col>
      </template>
      <template v-else>
        <v-col
          class="h-100 px-sm-1 px-md-10 "
          style="overflow-y: auto;"
        >
          <!--        <div class="my-14 d-flex align-center justify-center">-->
          <!--          <v-chip>Add cover image</v-chip>-->
          <!--        </div>-->
          <div class="nc-form-wrapper elevation-3 pb-10 ">
            <div class="mt-10 d-flex align-center justify-center flex-column">
              <div class="nc-form-banner backgroundColor darken-1 flex-column justify-center  d-flex">
                <div class="d-flex align-center justify-center flex-grow-1">
                  <!--                  <v-chip small color="backgroundColorDefault caption grey--text">
                  Add cover image
                </v-chip>-->
                  <v-img src="./icon.png" width="50" class="mx-4" />
                  <span class="display-1 font-weight-bold">NocoDB</span>
                </div>
              </div>
            </div>
            <div class="mx-auto nc-form elevation-3 pa-2  mb-10">
              <div class="nc-form-logo py-8" style="display: none">
                <!--                <div v-ripple class="nc-form-add-logo text-center caption pointer" @click.stop>-->
                <!--                  Add a logo-->
                <!--                </div>-->
              </div>
              <h2
                class="mt-4 display-1 font-weight-bold text-left mx-4 mb-3 px-1 text--text  text--lighten-1"
              >
                {{ view.heading }}
              </h2>

              <div
                class="body-1  text-left mx-4 py-2 px-1 text--text text--lighten-2"
              >
                {{ view.subheading }}
              </div>
              <div class="h-100">
                <div

                  v-for="(col) in columns"
                  :key="col.alias"
                  class="nc-field-wrapper item px-4 my-3 pointer"
                >
                  <div>
                    <div
                      :class="{
                        'active-row' : active === col.title,
                        required: isRequired(col, localState, col.required)
                      }"
                    >
                      <div class="nc-field-editables">
                        <label
                          :for="`data-table-form-${col.title}`"
                          class="body-2 text-capitalize nc-field-labels"
                        >
                          <virtual-header-cell
                            v-if="isVirtualCol(col)"
                            class="caption"
                            :column="{...col, _cn: col.label || col.title}"
                            :nodes="{}"
                            :is-form="true"
                            :meta="meta"
                            :required="isRequired(col, localState, col.required)"
                          />
                          <header-cell
                            v-else
                            class="caption"
                            :is-form="true"
                            :value="col.label || col.title"
                            :column="col"
                            :sql-ui="sqlUiLoc"
                            :required="isRequired(col, localState,col.required)"
                          />

                        </label>
                        <div
                          v-if="isVirtualCol(col)"
                          @click.stop
                        >
                          <virtual-cell
                            ref="virtual"
                            :disabled-columns="{}"
                            :column="col"
                            :row="localState"
                            :nodes="{}"
                            :meta="meta"
                            :api="api"
                            :active="true"
                            :sql-ui="sqlUiLoc"
                            :is-new="true"
                            is-form
                            is-public
                            :hint="col.description"
                            :required="col.description"
                            :metas="metas"
                            :password="password"
                            @update:localState="state => $set(virtual,col.title, state)"
                            @updateCol="updateCol"
                          />
                          <div
                            v-if="$v.virtual && $v.virtual.$dirty && $v.virtual[col.title] && (!$v.virtual[col.title].required || !$v.virtual[col.title].minLength)"
                            class="error--text caption"
                          >
                            Field is required.
                          </div>

                          <!-- todo: optimize -->
                          <template
                            v-if="col.bt && $v.localState && $v.localState.$dirty && $v.localState[meta.columns.find(c => c.column_name === col.bt.column_name).title]"
                          >
                            <div
                              v-if="!$v.localState[meta.columns.find(c => c.column_name === col.bt.column_name).title].required"
                              class="error--text caption"
                            >
                              Field is required.
                            </div>
                          </template>
                        </div>
                        <template v-else>
                          <div
                            v-if="col.ai || disabledColumns[col.title]"
                            style="height:100%; width:100%"
                            class="caption xc-input"
                            @click.stop
                            @click="col.ai && $toast.info('Auto Increment field is not editable').goAway(3000)"
                          >
                            <input
                              style="height:100%; width: 100%"
                              readonly
                              disabled
                              :value="localState[col.title]"
                            >
                          </div>

                          <div
                            v-else
                            @click.stop
                          >
                            <editable-cell
                              :id="`data-table-form-${col.title}`"
                              v-model="localState[col.title]"
                              :db-alias="dbAlias"
                              :column="col"
                              class="xc-input body-2"
                              :meta="meta"
                              :sql-ui="sqlUiLoc"
                              is-form
                              is-public
                              :hint="col.description"
                              @focus="active = col.title"
                              @blur="active = ''"
                            />
                          </div>
                          <template v-if="$v.localState&& $v.localState.$dirty && $v.localState[col.title] ">
                            <div v-if="!$v.localState[col.title].required" class="error--text caption">
                              Field is required.
                            </div>
                          </template>
                        </template>
                      </div>
                      <!--              </div>-->
                    </div>
                  </div>
                </div>
                <div class="my-10 text-center">
                  <v-btn color="primary" :loading="submitting" :disabled="submitting" @click="save">
                    Submit
                  </v-btn>
                </div>
              </div>
            </div>
          </div>
        </v-col>
      </template>
    </v-row>

    <v-dialog v-model="showPasswordModal" width="400">
      <v-card width="400" class="backgroundColor">
        <v-container fluid>
          <v-text-field
            v-model="password"
            dense
            autocomplete="shared-form-password"
            browser-autocomplete="shared-form-password"
            type="password"
            solo
            flat
            hint="Enter the password"
            persistent-hint
          />

          <div class="text-center">
            <v-btn small color="primary" @click="loadMetaData(); showPasswordModal =false">
              Unlock
            </v-btn>
          </div>
        </v-container>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>

import { validationMixin } from 'vuelidate'
import { required, minLength } from 'vuelidate/lib/validators'
import { ErrorMessages, isVirtualCol, RelationTypes, UITypes } from 'nocodb-sdk'
import form from '../mixins/form'
import VirtualHeaderCell from '../components/virtualHeaderCell'
import HeaderCell from '../components/headerCell'
import VirtualCell from '../components/virtualCell'
import EditableCell from '../components/editableCell'
import { SqlUI } from '../../../../helpers/sqlUi'

export default {
  name: 'XcForm',
  components: {
    EditableCell,
    VirtualCell,
    HeaderCell,
    VirtualHeaderCell
  },
  mixins: [form, validationMixin],
  data() {
    return {
      viewMeta: null,
      view: {},
      active: null,
      loading: false,
      showPasswordModal: false,
      password: '',
      submitting: false,
      submitted: false,
      client: null,
      meta: null,
      columns: [],
      query_params: {},
      localParams: {},
      localState: {},
      dbAlias: '',
      virtual: {},
      metas: {},
      secondsRemain: null,
      notFound: false
    }
  },
  computed: {

    sqlUiLoc() {
      // todo: replace with correct client
      return this.client && SqlUI.create({ client: this.client })
    }
  },
  watch: {
    submitted(val) {
      if (val && this.view.show_blank_form) {
        this.secondsRemain = 5
        const intvl = setInterval(() => {
          if (--this.secondsRemain < 0) {
            this.submitted = false
            clearInterval(intvl)
          }
        }, 1000)
      }
    }
  },
  async mounted() {
    await this.loadMetaData()
  },
  methods: {
    isVirtualCol,
    async loadMetaData() {
      this.loading = true
      try {
        this.viewMeta = (await this.$api.public.sharedViewMetaGet(this.$route.params.id, {
          password: this.password
        }))

        this.view = this.viewMeta.view
        this.meta = this.viewMeta.model
        this.metas = this.viewMeta.relatedMetas
        this.columns = this.meta.columns.filter(c => c.show)
        this.client = this.viewMeta.client
      // try {
      //   // eslint-disable-next-line camelcase
      //   const {
      //     meta,
      //     // model_name,
      //     client,
      //     query_params: qp,
      //     db_alias: dbAlias,
      //     relatedTableMetas
      //   } = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'sharedViewGet', {
      //     view_id: this.$route.params.id,
      //     password: this.password
      //   }])
      //   this.client = client
      //   this.meta = meta
      //   this.query_params = qp
      //   this.dbAlias = dbAlias
      //   this.metas = relatedTableMetas
      //
      //   const showFields = this.query_params.showFields || {}
      //   let fields = this.query_params.fieldsOrder || []
      //   if (!fields.length) {
      //     fields = Object.keys(showFields)
      //   }
      //   // eslint-disable-next-line camelcase
      //
      //   let columns = this.meta.columns
      //   if (this.meta && this.meta.v) {
      //     columns = [...columns, ...this.meta.v.map(v => ({ ...v, virtual: 1 }))]
      //   }
      //
      //   {
      //     const _ref = {}
      //     columns.forEach((c) => {
      //       if (c.virtual && c.bt) {
      //         c.prop = `${c.bt.rtn}Read`
      //       }
      //       if (c.virtual && c.mm) {
      //         c.prop = `${c.mm.rtn}MMList`
      //       }
      //       if (c.virtual && c.hm) {
      //         c.prop = `${c.hm.table_name}List`
      //       }
      //
      //       // if (c.virtual && c.lk) {
      //       //   c.alias = `${c.lk._lcn} (from ${c.lk._ltn})`
      //       // } else {
      //       c.alias = c.title
      //       // }
      //       if (c.alias in _ref) {
      //         c.alias += _ref[c.alias]++
      //       } else {
      //         _ref[c.alias] = 1
      //       }
      //     })
      //   }
      //   // this.modelName = model_name
      //   this.columns = columns.filter(c => showFields[c.alias]).sort((a, b) => fields.indexOf(a.alias) - fields.indexOf(b.alias))
      //
      //   this.localParams = (this.query_params.extraViewParams && this.query_params.extraViewParams.formParams) || {}
      } catch (e) {
        if (e.response && e.response.status === 404) {
          this.notFound = true
        } else if (await this._extractSdkResponseErrorMsg(e) === ErrorMessages.INVALID_SHARED_VIEW_PASSWORD) {
          this.showPasswordModal = true
        }
      }

      this.loadingData = false
    },
    async save() {
      try {
        this.$v.$touch()
        if (this.$v.localState.$invalid || this.$v.virtual.$invalid) {
          this.$toast.error('Provide values of all required field').goAway(3000)
          return
        }

        this.submitting = true
        // const id = this.meta.columns.filter(c => c.pk).map(c => this.localState[c.title]).join('___')

        // const updatedObj = Object.keys(this.changedColumns).reduce((obj, col) => {
        //   obj[col] = this.localState[col]
        //   return obj
        // }, {})

        // if (this.isNew) {

        // const formData = new FormData()
        const data = { ...this.localState, ...this.virtual }
        const attachment = {}

        for (const col of this.meta.columns) {
          if (col.uidt === UITypes.Attachment) {
            attachment[`_${col.title}`] = data[col.title]
            delete data[col.title]
          }
        }

        await this.$api.public.dataCreate(this.$route.params.id, {
          data,
          password: this.password,
          ...attachment
        })

        this.virtual = {}
        this.localState = {}

        this.submitted = true

        this.$toast.success(this.view.success_msg || 'Saved successfully.', {
          position: 'bottom-right'
        }).goAway(3000)
      } catch
      (e) {
        console.log(e)
        this.$toast.error(`Failed to update row : ${e.message}`).goAway(3000)
      }
      this.submitting = false
    },
    updateCol(_, column, id) {
      this.$set(this.localState, column, id)
    }
  },

  validations() {
    const obj = {
      localState: {},
      virtual: {}
    }
    for (const column of this.columns) {
      // if (!this.localParams || !this.localParams.fields || !this.localParams.fields[column.alias]) {
      //   continue
      // }
      if (!isVirtualCol(column) && (((column.rqd || column.notnull) && !column.cdf) || (column.pk && !(column.ai || column.cdf)) || column.required)) {
        obj.localState[column.title] = { required }
      } else if (column.uidt === UITypes.LinkToAnotherRecord && column.colOptions && column.colOptions.type === RelationTypes.BELONGS_TO) {
        const col = this.meta.columns.find(c => c.id === column.colOptions.fk_child_column_id)

        if ((col && col.rqd && !col.cdf) || column.required) {
          obj.localState[col.title] = { required }
        }
      } else if (isVirtualCol(column) && column.required) {
        obj.virtual[column.title] = {
          minLength: minLength(1),
          required
        }
      }
    }
    return obj
  }
}
</script>

<style scoped lang="scss">
.nc-form-wrapper {
  max-width: 800px;
  margin: 0 auto;
}

.nc-form-wrapper {
  border-radius: 4px;

  .nc-form {
    position: relative;
    border-radius: 4px;
    z-index: 2;
    background: var(--v-backgroundColorDefault-base);
    width: 80%;
    max-width: 600px;
    margin: 0 auto;
    margin-top: -100px;
  }
}

.nc-field-wrapper {

  &.active-row {
    border-radius: 4px;
    border: 1px solid var(--v-backgroundColor-darken1);
  }

  position: relative;

  .nc-field-remove-icon {
    opacity: 0;
    position: absolute;
    right: 10px;
    top: 10px;
    transition: 200ms opacity;
    z-index: 9
  }

  &.nc-editable:hover {
    background: var(--v-backgroundColor-base);

    .nc-field-remove-icon {
      opacity: 1;
    }
  }
}

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

  .nc-hint {
    padding-left: 3px;
  }

  .nc-required-switch, .nc-switch {
    .v-input--selection-controls__input {
      transform: scale(0.65) !important;
    }
  }

  .v-breadcrumbs__item:nth-child(odd) {
    font-size: .72rem;
    color: grey;
  }

  .v-breadcrumbs li:nth-child(even) {
    padding: 0 6px;
    font-size: .72rem;
    color: var(--v-textColor-base);
  }

  .comment-icon {
    position: absolute;
    right: 60px;
    bottom: 60px;
  }

  .nc-field-wrapper {

    //.required {
    //  & > input,
    //  .xc-input > input,
    //  .xc-input .v-input__slot input,
    //  .xc-input > div > input,
    //  & > select,
    //  .xc-input > select,
    //  textarea:not(.inputarea) {
    //    border: 1px solid rgba(255, 0, 0, 0.98);
    //    border-radius: 4px;
    //    background: var(--v-backgroundColorDefault-base);
    //  }
    //}

    div > input,
    div > .xc-input > input,
    div > .xc-input > div > input,
    div > select,
    div > .xc-input > select,
    div textarea:not(.inputarea) {
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

      background: var(--v-backgroundColorDefault-base);
    }

    .v-input__slot {
      padding: 0 !important;
    }
  }
}

.nc-meta-inputs {
  //width: 400px;
  min-height: 40px;
  border-radius: 4px;
  //display: flex;
  //align-items: center;
  //justify-content: center;

  &:hover {
    background: var(--v-backgroundColor-base);
  }

  &:active, &:focus {
    border: 1px solid #7f828b33;
  }
}

.nc-drag-n-drop-to-hide, .nc-drag-n-drop-to-show {
  border: 2px dashed #c4c4c4;
  border-radius: 4px;
  font-size: .62rem;

  color: grey
}

.nc-form-left-nav {
  max-height: 100%;
}

.required > div > label + * {
  //border: 1px solid red;
  border-radius: 4px;
  background: var(--v-backgroundColorDefault-base);
}

.nc-form-banner {
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  padding-bottom: 100px;

  .nc-form-logo {
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 70%;
    padding: 0 20px;
    background: var(--v-backgroundColorDefault-base);

    .nc-form-add-logo {
      border-radius: 4px;
      color: grey;
      border: 2px dashed var(--v-backgroundColor-darken1);
      padding: 15px 15px;
    }
  }
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
