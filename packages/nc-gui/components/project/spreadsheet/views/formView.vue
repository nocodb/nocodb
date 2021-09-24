<template>
  <v-container fluid class="h-100 py-0">
    <v-row class="h-100 my-0">
      <v-col v-if="isEditable" class="h-100 col-md-4 col-lg-3">
        <v-card class="h-100 overflow-auto pa-2 backgroundColor elevation-0 nc-form-left-nav">
          <div class="d-flex grey--text">
            <span class="">Fields</span>
            <v-spacer />
            <span
              class="pointer caption mr-2 font-weight-bold"
              style="border-bottom: 2px solid grey"
              @click="columns=[...allColumns]"
            >add all</span>
            <span class="pointer caption font-weight-bold" style="border-bottom: 2px solid grey" @click="columns=[]">remove all</span>
          </div>
          <draggable
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
                    :column="col"
                    :nodes="nodes"
                    :is-form="true"
                    :meta="meta"
                  />
                  <header-cell
                    v-else
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
            <div class="mt-1 nc-drag-n-drop-to-hide py-3 text-center grey--text text--lighter-1">
              Drag and drop field here to hide
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
                <v-icon samll color="grey">
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
        class="h-100 px-10 "
        style="overflow-y: auto"
      >
        <!--        <div class="my-14 d-flex align-center justify-center">-->
        <!--          <v-chip>Add cover image</v-chip>-->
        <!--        </div>-->
        <div class="my-10 d-flex align-center justify-center flex-column">
          <editable
            :is="isEditable ? 'editable' : 'h3'"
            v-model.lazy="localParams.name"
            class="title text-center"
            :class="{'nc-meta-inputs': isEditable}"
            placeholder="Form Title"
          >
            {{ localParams.name }}
          </editable>

          <editable
            :is="isEditable ? 'editable' : 'div'"
            v-model.lazy="localParams.description"
            :class="{'nc-meta-inputs': isEditable}"
            class="caption  text-center"
            placeholder="Add form description"
          >
            {{ localParams.description }}
          </editable>
        </div>

        <div style="max-width:600px" class="mx-auto">
          <draggable
            :is="_isUIAllowed('editFormView') ? 'draggable' : 'div'"
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
              class="nc-field-wrapper item px-4 py-4"
              :class="{'nc-editable':isEditable}"
            >
              <template
                v-if="_isUIAllowed('editFormView')"
              >
                <!--                <v-overlay-->
                <!--                  :value="true"-->
                <!--                  absolute-->
                <!--                  :color="$store.state.windows.darkTheme ? 'black': 'white'"-->
                <!--                  opacity="0"-->
                <!--                />-->
                <v-icon small class="nc-field-remove-icon" @click="columns = columns.filter((_,j) => i !== j)">
                  mdi-eye-off-outline
                </v-icon>
              </template>
              <!--                <div
                  v-if="!col.lk"
                  :key="i"
                  class="row-col  my-4"
                >
                  <div>
                    <label :for="`data-table-form-${col._cn}`" class="body-2  mt-n1 text-capitalize">
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
                        :value="col._cn"
                        :column="col"
                        :sql-ui="sqlUi"
                      />

                    </label>
                    <virtual-cell
                      v-if="col.virtual"
                      ref="virtual"
                      :disabled-columns="{}"
                      :column="col"
                      :row="localState"
                      :nodes="nodes"
                      :meta="meta"
                      :api="api"
                      :active="false"
                      :sql-ui="sqlUi"
                      :is-form="true"
                      :dummy="true"
                    />
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
                      :dummy="true"
                    />
                  </div>
                </div>-->
              <!--              </template>-->
              <!--            </v-card>-->

              <div
                :class="{
                  'active-row' : active === col._cn,
                  required: isRequired(col, localState)
                }"
              >
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
                    :value="col._cn"
                    :column="col"
                    :sql-ui="sqlUi"
                  />

                </label>
                <virtual-cell
                  v-if="col.virtual"
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
                />
              </div>
              <!--              </div>-->
            </div>

            <div v-if="!columns.length" class="mt-1 nc-drag-n-drop-to-show py-4 text-center grey--text text--lighter-1">
              Drag and drop field here to add
            </div>
          </draggable>
          <div class="my-10 text-center">
            <v-btn color="primary" @click="save">
              Submit
            </v-btn>
          </div>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>

import draggable from 'vuedraggable'
import VirtualHeaderCell from '../components/virtualHeaderCell'
import HeaderCell from '../components/headerCell'
import VirtualCell from '../components/virtualCell'
import EditableCell from '../components/editableCell'
import Editable from '../components/editable'
import EditColumn from '../components/editColumn'
import form from '../mixins/form'

export default {
  name: 'FormView',
  components: { EditColumn, Editable, EditableCell, VirtualCell, HeaderCell, VirtualHeaderCell, draggable },
  mixins: [form],
  props: ['meta', 'availableColumns', 'nodes', 'sqlUi', 'formParams', 'showFields', 'fieldsOrder', 'allColumns', 'dbAlias', 'api'],
  data: () => ({
    localState: {},
    moved: false,
    addNewColMenu: false,
    addNewColModal: false
    // hiddenColumns: []
  }),
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
        return this.allColumns.filter(c => !this.showFields[c.alias])
      }
    },
    columns: {
      get() {
        return this.allColumns.filter(c => this.showFields[c.alias]).sort((a, b) => ((this.fieldsOrder.indexOf(a.alias) + 1) || Infinity) - ((this.fieldsOrder.indexOf(b.alias) + 1) || Infinity))
      },
      set(val) {
        const showFields = val.reduce((o, v) => {
          o[v.alias] = true
          return o
        }, this.allColumns.reduce((o, v) => {
          o[v.alias] = false
          return o
        }, {}))
        const fieldsOrder = val.map(v => v.alias)
        this.$emit('update:showFields', showFields)
        this.$emit('update:fieldsOrder', fieldsOrder)
      }
    }
  },
  mounted() {
    this.localParams = Object.assign({ name: this.meta._tn, description: 'Form view description' }, this.localParams)
    // this.columns = [...this.availableColumns]
    // this.hiddenColumns = this.meta.columns.filter(c => this.availableColumns.find(c1 => c.cn === c1.cn && c._cn === c1._cn))
  },
  methods: {
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
        // const id = this.meta.columns.filter(c => c.pk).map(c => this.localState[c._cn]).join('___')

        // const updatedObj = Object.keys(this.changedColumns).reduce((obj, col) => {
        //   obj[col] = this.localState[col]
        //   return obj
        // }, {})

        // if (this.isNew) {
        const data = await this.api.insert(this.localState)
        this.localState = {} // { ...this.localState, ...data }

        // save hasmany and manytomany relations from local state
        if (this.$refs.virtual && Array.isArray(this.$refs.virtual)) {
          for (const vcell of this.$refs.virtual) {
            if (vcell.save) {
              await vcell.save(this.localState)
            }
          }
        }

        //   await this.reload()
        // }
        // else if (Object.keys(updatedObj).length) {
        //   if (!id) {
        //     return this.$toast.info('Update not allowed for table which doesn\'t have primary Key').goAway(3000)
        //   }
        //   await this.api.update(id, updatedObj, this.oldRow)
        // } else {
        //   return this.$toast.info('No columns to update').goAway(3000)
        // }

        // this.$emit('update:oldRow', { ...this.localState })
        // this.changedColumns = {}
        // this.$emit('input', this.localState)
        // this.$emit('update:isNew', false)

        this.$toast.success(`${this.localState[this.primaryValueColumn]} saved successfully.`, {
          position: 'bottom-right'
        }).goAway(3000)
      } catch (e) {
        console.log(e)
        this.$toast.error(`Failed to update row : ${e.message}`).goAway(3000)
      }
    }
  }
}
</script>

<style scoped lang="scss">

.nc-field-wrapper {

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

.required > div > label + * {
  border: 1px solid red;
  border-radius: 4px;
  background: var(--v-backgroundColorDefault-base);
}

.nc-meta-inputs {
  width: 400px;
  min-height: 40px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--v-backgroundColor-base);
  }

  &:active, &:focus {
    border: 1px solid #7f828b33;
  }
}

.nc-drag-n-drop-to-hide, .nc-drag-n-drop-to-show {
  border: 2px dotted #a1a1a1;
  border-radius: 4px;
  font-size: .6rem;
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

</style>
