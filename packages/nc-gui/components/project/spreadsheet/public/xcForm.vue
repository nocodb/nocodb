<template>
  <v-container class="h-100 j-excel-container">
    <v-row :class="{'d-flex justify-center': submitted}">
      <template v-if="submitted">
        <v-col class="d-flex justify-center">
          <div v-if="localParams && localParams.submit" style="min-width: 350px">
            <v-alert type="success" outlined>
              <span class="title">{{ localParams.submit.message || 'Successfully submitted form data' }}</span>
            </v-alert>
            <p v-if="localParams.submit.showBlankForm" class="caption grey--text text-center">
              New form will be loaded after {{ secondsRemain }} seconds
            </p>
            <div v-if="localParams.submit.showAnotherSubmit" class=" text-center">
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
                </div>
              </div>
            </div>
            <div class="mx-auto nc-form elevation-3 pa-2  mb-10">
              <div class="nc-form-logo py-8">
              <!--                <div v-ripple class="nc-form-add-logo text-center caption pointer" @click.stop>-->
              <!--                  Add a logo-->
              <!--                </div>-->
              </div>
              <h2
                class="display-1 font-weight-bold text-left mx-4 mb-3 px-1 text--text  text--lighten-1"
              >
                {{ localParams.name }}
              </h2>

              <div
                class="body-1  text-left mx-4 py-2 px-1 text--text text--lighten-2"
              >
                {{ localParams.description }}
              </div>
              <div class="h-100">
                <div

                  v-for="(col) in columns"
                  :key="col.alias"
                  class="nc-field-wrapper item px-4 my-3 pointer"
                >
                  <div>
                    <div
                      v-if="localParams.fields && localParams.fields[col.alias]"
                      :class="{
                        'active-row' : active === col._cn,
                        required: isRequired(col, localState, localParams.fields[col.alias].required)
                      }"
                    >
                      <div class="nc-field-editables">
                        <label
                          :for="`data-table-form-${col._cn}`"
                          class="body-2 text-capitalize nc-field-labels"
                        >
                          <virtual-header-cell
                            v-if="col.virtual"
                            class="caption"
                            :column="{...col, _cn: localParams.fields[col.alias].label || col._cn}"
                            :nodes="{}"
                            :is-form="true"
                            :meta="meta"
                            :required="isRequired(col, localState, localParams.fields[col.alias].required)"
                          />
                          <header-cell
                            v-else
                            class="caption"
                            :is-form="true"
                            :value="localParams.fields[col.alias].label || col._cn"
                            :column="col"
                            :sql-ui="sqlUi"
                            :required="isRequired(col, localState, localParams.fields[col.alias].required)"
                          />

                        </label>
                        <div
                          v-if="col.virtual"
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
                            :sql-ui="sqlUi"
                            :is-new="true"
                            is-form
                            is-public
                            :hint="localParams.fields[col.alias].description"
                            :required="localParams.fields[col.alias].description"
                            :metas="metas"
                            @update:localState="state => $set(virtual,col._cn, state)"
                            @updateCol="updateCol"
                          />
                          <div
                            v-if="$v.virtual && $v.virtual.$dirty && $v.virtual[col.alias] && (!$v.virtual[col.alias].required || !$v.virtual[col.alias].minLength)"
                            class="error--text caption"
                          >
                            Field is required.
                          </div>

                          <!-- todo: optimize -->
                          <template
                            v-if="col.bt && $v.localState && $v.localState.$dirty && $v.localState[meta.columns.find(c => c.cn === col.bt.cn)._cn]"
                          >
                            <div
                              v-if="!$v.localState[meta.columns.find(c => c.cn === col.bt.cn)._cn].required"
                              class="error--text caption"
                            >
                              Field is required.
                            </div>
                          </template>
                        </div>
                        <template v-else>
                          <div
                            v-if="col.ai || disabledColumns[col._cn]"
                            style="height:100%; width:100%"
                            class="caption xc-input"
                            @click.stop
                            @click="col.ai && $toast.info('Auto Increment field is not editable').goAway(3000)"
                          >
                            <input
                              style="height:100%; width: 100%"
                              readonly
                              disabled
                              :value="localState[col._cn]"
                            >
                          </div>

                          <div
                            v-else
                            @click.stop
                          >
                            <editable-cell
                              :id="`data-table-form-${col._cn}`"
                              v-model="localState[col._cn]"
                              :db-alias="dbAlias"
                              :column="col"
                              class="xc-input body-2"
                              :meta="meta"
                              :sql-ui="sqlUi"
                              is-form
                              :hint="localParams.fields[col.alias].description"
                              @focus="active = col._cn"
                              @blur="active = ''"
                            />
                          </div>
                          <template v-if="$v.localState&& $v.localState.$dirty && $v.localState[col._cn] ">
                            <div v-if="!$v.localState[col._cn].required" class="error--text caption">
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
  </v-container>
</template>

<script>

import { validationMixin } from 'vuelidate'
import { required, minLength } from 'vuelidate/lib/validators'
import form from '../mixins/form'
import VirtualHeaderCell from '../components/virtualHeaderCell'
import HeaderCell from '../components/headerCell'
import VirtualCell from '../components/virtualCell'
import EditableCell from '../components/editableCell'
import { SqlUI } from '../../../../helpers/sqlUi'

export default {
  name: 'XcForm',
  components: { EditableCell, VirtualCell, HeaderCell, VirtualHeaderCell },
  mixins: [form, validationMixin],
  data() {
    return {
      active: null,
      loading: false,
      submitting: false,
      client: null,
      meta: null,
      columns: [],
      query_params: {},
      localParams: {},
      localState: {},
      dbAlias: '',
      virtual: {},
      metas: {}
    }
  },
  computed: {

    sqlUi() {
      // todo: replace with correct client
      return this.client && SqlUI.create({ client: this.client })
    }
  },
  async mounted() {
    await this.loadMetaData()
  },
  methods: {
    async loadMetaData() {
      this.loading = true
      try {
        // eslint-disable-next-line camelcase
        const {
          meta,
          // model_name,
          client,
          query_params: qp,
          db_alias: dbAlias,
          relatedTableMetas
        } = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'sharedViewGet', {
          view_id: this.$route.params.id,
          password: this.password
        }])
        this.client = client
        this.meta = JSON.parse(meta)
        this.query_params = JSON.parse(qp)
        this.dbAlias = dbAlias
        this.metas = relatedTableMetas

        const fields = this.query_params.fields.split(',')
        // eslint-disable-next-line camelcase

        let columns = this.meta.columns
        if (this.meta && this.meta.v) {
          columns = [...columns, ...this.meta.v.map(v => ({ ...v, virtual: 1 }))]
        }

        {
          const _ref = {}
          columns.forEach((c) => {
            if (c.virtual && c.bt) {
              c.prop = `${c.bt.rtn}Read`
            }
            if (c.virtual && c.mm) {
              c.prop = `${c.mm.rtn}MMList`
            }
            if (c.virtual && c.hm) {
              c.prop = `${c.hm.tn}List`
            }

            if (c.virtual && c.lk) {
              c.alias = `${c.lk._lcn} (from ${c.lk._ltn})`
            } else {
              c.alias = c._cn
            }
            if (c.alias in _ref) {
              c.alias += _ref[c.alias]++
            } else {
              _ref[c.alias] = 1
            }
          })
        }

        // this.modelName = model_name
        this.columns = columns.filter(c => fields.includes(c.alias))

        this.localParams = (this.query_params.extraViewParams && this.query_params.extraViewParams.formParams) || {}
      } catch (e) {
        console.log(e)
        this.showPasswordModal = true
      }

      this.loadingData = false
    },
    async save() {
      try {
        this.$v.$touch()
        if (this.$v.localState.$invalid) {
          this.$toast.error('Provide values of all required field').goAway(3000)
          return
        }

        this.submitting = true
        // const id = this.meta.columns.filter(c => c.pk).map(c => this.localState[c._cn]).join('___')

        // const updatedObj = Object.keys(this.changedColumns).reduce((obj, col) => {
        //   obj[col] = this.localState[col]
        //   return obj
        // }, {})

        // if (this.isNew) {

        await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'sharedViewInsert', {
          view_id: this.$route.params.id,
          password: this.password,
          data: this.localState,
          nested: this.virtual
        }])

        //
        // data = { ...this.localState, ...data }
        //
        // // save hasmany and manytomany relations from local state
        // if (this.$refs.virtual && Array.isArray(this.$refs.virtual)) {
        //   for (const vcell of this.$refs.virtual) {
        //     if (vcell.save) {
        //       await vcell.save(data)
        //     }
        //   }
        // }
        //

        this.virtual = {}
        this.localState = {}

        this.submitted = true

        this.$toast.success(this.localParams.submit.message || 'Saved successfully.', {
          position: 'bottom-right'
        }).goAway(3000)
      } catch (e) {
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
    const obj = { localState: {}, virtual: {} }
    for (const column of this.columns) {
      if (!this.localParams || !this.localParams.fields || !this.localParams.fields[column.alias]) {
        continue
      }
      if (!column.virtual && (((column.rqd || column.notnull) && !column.default) || (column.pk && !(column.ai || column.default)) || this.localParams.fields[column.alias].required)) {
        obj.localState[column._cn] = { required }
      } else if (column.bt) {
        const col = this.meta.columns.find(c => c.cn === column.bt.cn)

        console.log(col, this.meta.columns, column)

        if ((col.rqd && !col.default) || this.localParams.fields[column.alias].required) {
          obj.localState[col._cn] = { required }
        }
      } else if (column.virtual && this.localParams.fields[column.alias].required && (column.mm || column.hm)) {
        obj.virtual[column.alias] = { minLength: minLength(1), required }
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
