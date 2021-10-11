<template>
  <v-container fluid class="h-100 py-0">
    <v-row class="h-100 my-0" :class="{'d-flex justify-center': submitted}">
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
        <v-col v-if="isEditable" class="h-100 col-md-4 col-lg-3">
          <v-card class="h-100 overflow-auto pa-4 pa-md-6 backgroundColor elevation-0 nc-form-left-nav">
            <div class="d-flex grey--text">
              <span class="">Fields</span>
              <v-spacer />
              <span
                v-if="hiddenColumns.length"
                class="pointer caption mr-2"
                style="border-bottom: 2px solid rgb(218,218,218)"
                @click="addAllColumns()"
              >add all</span>
              <span
                v-if="columns.length"
                class="pointer caption"
                style="border-bottom: 2px solid rgb(218,218,218)"
                @click="columns=[]"
              >remove all</span>
            </div>
            <draggable
              v-if="showFields "
              v-model="hiddenColumns"
              draggable=".item"
              group="form-inputs"
              @start="drag=true"
              @end="drag=false"
            >
              <v-card
                v-for="(col) in hiddenColumns"
                :key="col.alias"
                class="pa-2 my-2 item pointer elevation-0"
                @mousedown="moved=false"
                @mousemove="moved=false"
                @mouseup="handleMouseUp(col)"
              >
                <div class="d-flex">
                  <label :for="`data-table-form-${col._cn}`" class="body-2 text-capitalize flex-grow-1">
                    <virtual-header-cell
                      v-if="col.virtual"
                      class="caption"
                      :column="col"
                      :nodes="nodes"
                      :is-form="true"
                      :meta="meta"
                    />
                    <header-cell
                      v-else
                      class="caption"
                      :is-form="true"
                      :value="col._cn"
                      :column="col"
                      :sql-ui="sqlUi"
                    />

                  </label>
                  <v-icon color="grey">
                    mdi-drag
                  </v-icon>
                </div>
              </v-card>
              <div class="mt-4 nc-drag-n-drop-to-hide py-3 text-center grey--text text--lighter-1">
                Drag and drop fields here to hide
              </div>
            </draggable>

            <v-menu
              v-model="addNewColMenu"
              fixed
              z-index="99"
              content-class="elevation-0"
            >
              <template #activator="{on}">
                <div class="grey--text caption text-center mt-4" v-on="on">
                  <v-icon size="20" color="grey">
                    mdi-plus
                  </v-icon>
                  Add new field to this table
                </div>
              </template>
              <edit-column
                v-if="addNewColMenu"
                :meta="meta"
                :nodes="nodes"
                :sql-ui="sqlUi"
                @close="addNewColMenu = false"
                @saved="onNewColCreation"
              />
            </v-menu>
          </v-card>
        </v-col>
        <v-col
          :class="{'col-12' : !isEditable, 'col-lg-9 col-md-8': isEditable}"
          class="h-100 px-sm-1 px-md-10 "
          style="overflow-y: auto"
        >
          <!--        <div class="my-14 d-flex align-center justify-center">-->
          <!--          <v-chip>Add cover image</v-chip>-->
          <!--        </div>-->
          <div class="nc-form-wrapper elevation-3 ma-3  pb-10">
            <div class="mt-10 d-flex align-center justify-center flex-column">
              <div class="nc-form-banner backgroundColor darken-1 flex-column justify-center  d-flex">
                <div class="d-flex align-center justify-center flex-grow-1">
                  <!--                  <v-chip small color="backgroundColorDefault caption grey&#45;&#45;text">
                    Add cover image
                  </v-chip>-->
                </div>
              </div>
            </div>
            <div class="mx-auto nc-form elevation-3 pa-2 ">
              <div class="nc-form-logo py-8">
                <!--                <div v-ripple class="nc-form-add-logo text-center caption pointer" @click.stop>-->
                <!--                  Add a logo-->
                <!--                </div>-->
              </div>
              <editable
                :is="isEditable ? 'editable' : 'h2'"
                v-model.lazy="localParams.name"
                class="display-1 font-weight-bold text-left mx-4 mb-3 px-1 text--text  text--lighten-1"
                :class="{'nc-meta-inputs': isEditable}"
                placeholder="Form Title"
              >
                {{ localParams.name }}
              </editable>

              <editable
                :is="isEditable ? 'editable' : 'div'"
                v-model.lazy="localParams.description"
                :class="{'nc-meta-inputs': isEditable}"
                class="body-1  text-left mx-4 py-2 px-1 text--text text--lighten-2"
                placeholder="Add form description"
              >
                {{ localParams.description }}
              </editable>
              <draggable
                v-model="columns"
                draggable=".item"
                group="form-inputs"
                class="h-100"
                @start="drag=true"
                @end="drag=false"
              >
                <div
                  v-for="(col,i) in columns"
                  :key="col.alias"
                  class="nc-field-wrapper item px-4 my-3 pointer"
                  :class="{'nc-editable':isEditable , 'active-row': isActiveRow(col) , 'py-4': !isActiveRow(col) , 'pb-4':isActiveRow(col)}"
                >
                  <div
                    v-click-outside="() => onClickOutside(col)"
                    @click="activeRow= col.alias"
                  >
                    <template
                      v-if="_isUIAllowed('editFormView')"
                    >
                      <v-icon small class="nc-field-remove-icon" @click="columns = columns.filter((_,j) => i !== j)">
                        mdi-eye-off-outline
                      </v-icon>
                    </template>

                    <div
                      v-if="localParams.fields && localParams.fields[col.alias]"
                      :class="{
                        'active-row' : active === col._cn,
                        required: isRequired(col, localState, localParams.fields[col.alias].required)
                      }"
                    >
                      <div class="nc-field-editables" :class="{'nc-show' : isActiveRow(col)}">
                        <div class="d-flex align-center pb-2 mt-2">
                          <v-icon small color="grey">
                            mdi-drag
                          </v-icon>

                          <label
                            class="grey--text caption ml-2"
                            @click="localParams.fields[col.alias].required= !localParams.fields[col.alias].required"
                          >Required</label>
                          <v-switch
                            v-model="localParams.fields[col.alias].required"
                            class="nc-required-switch ml-1 mt-0"
                            hide-details
                            flat
                            color="primary"
                            dense
                            inset
                          />
                        </div>
                        <editable
                          v-model="localParams.fields[col.alias].label"
                          style="width:300px;white-space: pre-wrap"
                          placeholder=" Enter form input label"
                          class="caption pa-1 backgroundColor darken-1 mb-2 "
                        />
                        <editable
                          v-model="localParams.fields[col.alias].description"
                          style="width:300px;white-space: pre-wrap"
                          placeholder=" Add some help text"
                          class="caption pa-1 backgroundColor darken-1 mb-2"
                          @keydown.enter.prevent
                        />
                      </div>
                      <label
                        :class="{'nc-show' : !isActiveRow(col)}"
                        :for="`data-table-form-${col._cn}`"
                        class="body-2 text-capitalize nc-field-labels"
                      >
                        <virtual-header-cell
                          v-if="col.virtual"
                          class="caption"
                          :column="{...col, _cn: localParams.fields[col.alias].label || col._cn}"
                          :nodes="nodes"
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
                          :nodes="nodes"
                          :meta="meta"
                          :api="api"
                          :active="true"
                          :sql-ui="sqlUi"
                          :is-new="true"
                          :is-form="true"
                          :hint="localParams.fields[col.alias].description"
                          :required="localParams.fields[col.alias].description"
                          @update:localState="state => $set(virtual,col.alias, state)"
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
                          v-if="col.ai || (col.pk && !isNew) || disabledColumns[col._cn]"
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
                <div
                  v-if="!columns.length"
                  class="nc-drag-n-drop-to-show py-4 mx-8  my-10 text-center grey--text text--lighter-1"
                >
                  Drag and drop fields here to add
                </div>
              </draggable>
              <div class="my-10 text-center">
                <v-btn color="primary" :loading="loading" :disabled="loading" @click="save">
                  Submit
                </v-btn>
                <!--            <span class="caption grey&#45;&#45;text pointer">Edit label</span>-->
              </div>
              <div v-if="isEditable && localParams.submit" style="max-width: 700px" class="mx-auto mt-4 px-4 mb-4">
                <!--            <v-switch v-model="localParams.nocoBranding" dense inset hide-details>
                <template #label>
                  <span class="caption">Show NocoDB branding</span>
                </template>
              </v-switch>
              <v-switch v-model="localParams.submitRedirectUrl" dense inset hide-details>
                <template #label>
                  <span class="caption">Redirect to URL after form submission</span>
                </template>
              </v-switch>-->

                <div class="caption grey--text  mt-10 mb-2">
                  After form is submitted:
                </div>
                <label class="caption grey--text font-weight-bold">Show this message:</label>
                <v-textarea
                  v-model="localParams.submit.message"
                  rows="3"
                  hide-details
                  solo

                  class="caption"
                />

                <v-switch v-model="localParams.submit.showAnotherSubmit" dense inset hide-details class="nc-switch">
                  <template #label>
                    <span class="font-weight-bold grey--text caption">Show "Submit Another Form" button</span>
                  </template>
                </v-switch>
                <v-switch v-model="localParams.submit.showBlankForm" dense inset hide-details class="nc-switch">
                  <template #label>
                    <span class="font-weight-bold grey--text caption">Show a blank form after 5 seconds</span>
                  </template>
                </v-switch>
                <v-switch
                  v-if="localParams.emailMe"
                  v-model="localParams.emailMe[$store.state.users.user.email]"
                  dense
                  inset
                  hide-details
                  class="nc-switch"
                  @change="checkSMTPStatus"
                >
                  <template #label>
                    <span class="caption font-weight-bold grey--text ">Email me at <span class="font-eright-bold">{{
                      $store.state.users.user.email
                    }}</span></span>
                  </template>
                </v-switch>
              </div>
            </div>
          </div>
        </v-col>
      </template>
    </v-row>
  </v-container>
</template>

<script>

import draggable from 'vuedraggable'
import { validationMixin } from 'vuelidate'
import { required, minLength } from 'vuelidate/lib/validators'
import VirtualHeaderCell from '../components/virtualHeaderCell'
import HeaderCell from '../components/headerCell'
import VirtualCell from '../components/virtualCell'
import EditableCell from '../components/editableCell'
import Editable from '../components/editable'
import EditColumn from '../components/editColumn'
import form from '../mixins/form'

// todo: generate hideCols based on default values
const hiddenCols = ['created_at', 'updated_at']

export default {
  name: 'FormView',
  components: { EditColumn, Editable, EditableCell, VirtualCell, HeaderCell, VirtualHeaderCell, draggable },
  mixins: [form, validationMixin],
  props: ['meta', 'availableColumns', 'nodes', 'sqlUi', 'formParams', 'showFields', 'fieldsOrder', 'allColumns', 'dbAlias', 'api', 'id'],
  data: () => ({
    localState: {},
    moved: false,
    addNewColMenu: false,
    addNewColModal: false,
    activeRow: null,
    active: null,
    isNew: true,
    submitted: false,
    secondsRemain: null,
    loading: false,
    virtual: {}
    // hiddenColumns: []
  }),
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
        if ((col.rqd && !col.default) || this.localParams.fields[column.alias].required) {
          obj.localState[col._cn] = { required }
        }
      } else if (column.virtual && this.localParams.fields[column.alias].required && (column.mm || column.hm)) {
        obj.virtual[column.alias] = { minLength: minLength(1), required }
      }
    }

    return obj
  },
  computed: {
    isEditable() {
      return this._isUIAllowed('editFormView')
    },
    localParams: {
      get() {
        return this.formParams || {}
      },
      set(params) {
        this.$emit('update:formParams', params)
      }
    },
    hiddenColumns: {
      get() {
        return this.allColumns.filter(c => !this.showFields[c.alias] && !hiddenCols.includes(c.cn) && !(c.pk && c.ai) && !(this.meta.v || []).some(v => v.bt && v.bt.cn === c.cn))
      }
    },
    columns: {
      get() {
        return this.allColumns.filter(c => this.showFields[c.alias] && !hiddenCols.includes(c.cn)).sort((a, b) => ((this.fieldsOrder.indexOf(a.alias) + 1) || Infinity) - ((this.fieldsOrder.indexOf(b.alias) + 1) || Infinity))
      },
      set(val) {
        const showFields = val.reduce((o, v) => {
          o[v.alias] = true
          return o
        }, this.allColumns.reduce((o, v) => {
          o[v.alias] = this.isDbRequired(v)
          return o
        }, {}))
        const fieldsOrder = val.map(v => v.alias)
        this.$emit('update:showFields', showFields)
        this.$emit('update:fieldsOrder', fieldsOrder)
      }
    }
  },
  watch: {
    'meta.columns'() {
      this.meta.columns.forEach((c) => {
        this.localParams.fields[c.alias] = this.localParams.fields[c.alias] || {}
      })
    },
    submitted(val) {
      if (val && this.localParams.submit.showBlankForm) {
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
  mounted() {
    const localParams = Object.assign({
      name: this.meta._tn,
      description: 'Form view description',
      submit: {},
      emailMe: {},
      fields: {}
    }, this.localParams)
    this.availableColumns.forEach((c) => {
      localParams.fields[c.alias] = localParams.fields[c.alias] || {}
    })
    this.localParams = localParams
    // this.columns = [...this.availableColumns]
    // this.hiddenColumns = this.meta.columns.filter(c => this.availableColumns.find(c1 => c.cn === c1.cn && c._cn === c1._cn))
  },
  methods: {
    addAllColumns() {
      this.columns = [...this.allColumns.filter(c => !hiddenCols.includes(c.cn))]
    },
    isDbRequired(column) {
      let isRequired = (!column.virtual && column.rqd && !column.default && this.meta.belongsTo.every(bt => column.cn !== bt.cn)) ||
        (column.pk && !(column.ai || column.default))

      if (column.bt) {
        const col = this.meta.columns.find(c => c.cn === column.bt.cn)
        if ((col.rqd && !col.default) || this.localParams.fields[column.alias].required) {
          isRequired = true
        }
      }

      return isRequired
    },
    async checkSMTPStatus() {
      if (this.localParams.emailMe[this.$store.state.users.user.email]) {
        const emailPlugin = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcPluginRead', { title: 'SMTP' }])
        if (!emailPlugin.active) {
          this.$set(this.localParams.emailMe, this.$store.state.users.user.email, false)
          this.$toast.info('Please activate SMTP plugin in App store for enabling email notification').goAway(5000)
        }
      }
    },
    updateCol(_, column, id) {
      this.$set(this.localState, column, id)
    },
    isActiveRow(col) {
      return this.activeRow === col.alias
    },
    onClickOutside(col) {
      this.activeRow = this.activeRow === col.alias ? null : this.activeRow
    },
    handleMouseUp(col) {
      if (!this.moved) {
        this.columns = [...this.columns, col]
      }
    },
    onNewColCreation(col) {
      this.addNewColMenu = false
      this.addNewColModal = false
      this.$emit('onNewColCreation', col)
    },
    async save() {
      try {
        this.$v.$touch()
        if (this.$v.localState.$invalid) {
          this.$toast.error('Provide values of all required field').goAway(3000)

          return
        }

        this.loading = true
        // const id = this.meta.columns.filter(c => c.pk).map(c => this.localState[c._cn]).join('___')

        // const updatedObj = Object.keys(this.changedColumns).reduce((obj, col) => {
        //   obj[col] = this.localState[col]
        //   return obj
        // }, {})

        // if (this.isNew) {

        // todo: add params option in GraphQL
        let data = await this.api.insert(this.localState, { params: { form: this.id } })
        data = { ...this.localState, ...data }

        // save hasmany and manytomany relations from local state
        if (this.$refs.virtual && Array.isArray(this.$refs.virtual)) {
          for (const vcell of this.$refs.virtual) {
            if (vcell.save) {
              await vcell.save(data)
            }
          }
        }

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
      this.loading = false
    }
  }
}
</script>

<style scoped lang="scss">

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
  border: 1px solid red;
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

//.nc-field-labels,
.nc-field-editables {
  max-height: 0;
  transition: .4s max-height;
  overflow-y: hidden;
  display: block;

  &.nc-show {
    max-height: 500px;
  }
}

</style>
