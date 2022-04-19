<template>
  <v-card class="pb-2">
    <v-toolbar flat height="42" class="toolbar-border-bottom">
      <v-spacer />
      <x-btn
        outlined
        tooltip="Validation Documentation"
        color="primary"
        small
        href="https://docs.nocodb.com/en/v0.5/database/database-model-validation"
        target="_blank"
      >
        <v-icon small left>
          mdi-book-open-variant
        </v-icon>
        Validation Docs
      </x-btn>
      <x-btn
        outlined
        tooltip="Reload validation"
        color="primary"
        small
        @click="loadTableModelMeta"
      >
        <v-icon small left>
          refresh
        </v-icon>
        <!-- Reload -->
        {{ $t('general.reload') }}
      </x-btn>
      <x-btn
        outlined
        :tooltip="$t('tooltip.saveChanges')"
        color="primary"
        small
        :disabled="!edited || loading"
        @click.prevent="saveValidations"
      >
        <v-icon small left>
          save
        </v-icon>
        <!-- Save -->
        {{ $t('general.save') }}
      </x-btn>
    </v-toolbar>
    <template v-if="columns">
      <p class="title mt-6 mb-6">
        Table : <span class="text-capitalize">{{ columns.title }}</span><br>
        <span class="font-weight-thin">Write Validations For Columns</span>
      </p>

      <!--      <v-row justify="center">
              <v-col cols="4" class="d-flex align-center">
                <label class="mr-3">Table Alias</label>
                <v-text-field @input="edited = true" v-model="columns.title">

                </v-text-field>
              </v-col>
            </v-row>-->

      <v-simple-table style="max-width:800px; margin:0 auto" class="mb-10" dense>
        <template #default>
          <thead>
            <tr>
              <th>Column Name</th>
              <th>Alias</th>
              <th>Validators</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item,i) in columns.columns" :key="i">
              <td>{{ item.column_name }}</td>
              <td>
                <v-edit-dialog lazy>
                  <span> {{ item.title }}</span>
                  <template #input>
                    <v-text-field
                      v-model="item.title"
                      :label="$t('general.edit')"
                      single-line
                      @input="edited=true"
                    />
                  </template>
                </v-edit-dialog>
              </td>
              <td>
                <x-btn
                  :tooltip="`Edit/Add validation for '${item.column_name}' column`"
                  color="primary"
                  style="text-transform:capitalize"
                  x-small
                  outlined
                  @click="editOrAddValidation(item)"
                >
                  <v-icon class=" mr-1" x-small>
                    mdi-lead-pencil
                  </v-icon>
                  Validation ({{ item.validate.func.length }})
                </x-btn>
              </td>
            </tr>
          </tbody>
        </template>
      </v-simple-table>

      <!--      <v-expansion-panels accordion style="width: 70%; min-width: 500px; margin:5px auto">-->
      <!--        <v-expansion-panel-->
      <!--          v-for="(item,i) in columns.columns"-->
      <!--          :key="i"-->
      <!--        >-->
      <!--          <v-expansion-panel-header>{{ item.column_name }} <span-->
      <!--            class="caption grey&#45;&#45;text ml-2">({{ item.validate.func.length }} validations)</span>-->
      <!--          </v-expansion-panel-header>-->
      <!--          <v-expansion-panel-content>-->

      <!--            <v-toolbar class="elevation-0" flat height="42">-->
      <!--              <v-spacer>-->
      <!--              </v-spacer>-->

      <!--              <x-btn outlined tooltip="Add new validation"-->
      <!--                     color="primary"-->
      <!--                     small-->
      <!--                     @click.prevent="(item.validate.func.push(''),edited=true,scrollAndFocusLastRow())">-->
      <!--                <v-icon small left>mdi-plus</v-icon>-->
      <!--                Add Validation-->
      <!--              </x-btn>-->
      <!--            </v-toolbar>-->

      <!--            <v-simple-table v-if="item.validate.func && item.validate.func.length" dense>-->
      <!--              <thead>-->
      <!--              <tr>-->
      <!--                <th class="caption font-weight-normal">Validation Function</th>-->
      <!--                <th class="caption font-weight-normal">Error Message</th>-->
      <!--                &lt;!&ndash;                <th class="caption font-weight-normal">Optional Argument</th>&ndash;&gt;-->
      <!--                <th></th>-->
      <!--              </tr>-->
      <!--              </thead>-->
      <!--              <tbody>-->
      <!--              <tr v-for="(func,i) in item.validate.func">-->
      <!--                <td>-->
      <!--                  <v-edit-dialog-->
      <!--                    lazy-->
      <!--                  >-->
      <!--                    <span>{{ func }}</span>-->
      <!--                    <template v-slot:input>-->

      <!--                      <v-autocomplete-->
      <!--                        @change="onFunctionChange(i,item)"-->
      <!--                        dense-->
      <!--                        v-model="item.validate.func[i]"-->
      <!--                        :items="fnList"-->
      <!--                        item-text="func"-->
      <!--                      ></v-autocomplete>-->
      <!--                    </template>-->
      <!--                  </v-edit-dialog>-->
      <!--                </td>-->
      <!--                <td>-->
      <!--                  <v-edit-dialog lazy>-->
      <!--                    <span> {{ item.validate.msg[i] }}</span>-->
      <!--                    <template v-slot:input>-->
      <!--                      <v-text-field-->
      <!--                        @input="edited=true"-->
      <!--                        v-model="item.validate.msg[i]"-->
      <!--                        label="Edit"-->
      <!--                        single-line-->
      <!--                      ></v-text-field>-->
      <!--                    </template>-->
      <!--                  </v-edit-dialog>-->
      <!--                </td>-->
      <!--                &lt;!&ndash;                <td>&ndash;&gt;-->
      <!--                &lt;!&ndash;                  <v-edit-dialog lazy>&ndash;&gt;-->
      <!--                &lt;!&ndash;                    <span> {{ item.validate.args[i] }}</span>&ndash;&gt;-->
      <!--                &lt;!&ndash;                    <template v-slot:input>&ndash;&gt;-->
      <!--                &lt;!&ndash;                      <v-text-field&ndash;&gt;-->
      <!--                &lt;!&ndash;                        @input="edited=true"&ndash;&gt;-->
      <!--                &lt;!&ndash;                        v-model="item.validate.args[i]"&ndash;&gt;-->
      <!--                &lt;!&ndash;                        label="Edit"&ndash;&gt;-->
      <!--                &lt;!&ndash;                        single-line&ndash;&gt;-->
      <!--                &lt;!&ndash;                      ></v-text-field>&ndash;&gt;-->
      <!--                &lt;!&ndash;                    </template>&ndash;&gt;-->
      <!--                &lt;!&ndash;                  </v-edit-dialog>&ndash;&gt;-->
      <!--                &lt;!&ndash;                </td>&ndash;&gt;-->

      <!--                <td>-->
      <!--                  <x-icon-->
      <!--                    small-->
      <!--                    color="error" tooltip="Delete role" @click="deleteValidation(item,i)">-->
      <!--                    mdi-delete-forever-->
      <!--                  </x-icon>-->
      <!--                </td>-->
      <!--              </tr>-->
      <!--              </tbody>-->
      <!--            </v-simple-table>-->
      <!--            <div v-else class="d-flex justify-center">-->
      <!--              <v-alert dense outlined type="info" color="grey lighten-1" icon="mdi-information-outline" class="caption"-->
      <!--                       style="width:auto">-->
      <!--                No validation for '{{ item.column_name }}'-->
      <!--              </v-alert>-->
      <!--            </div>-->
      <!--          </v-expansion-panel-content>-->
      <!--        </v-expansion-panel>-->
      <!--      </v-expansion-panels>-->
    </template>

    <v-dialog v-model="validatorEditDialog" max-width="700px">
      <v-card v-if="clickedItem">
        <v-card-title class="headline justify-center mb-5">
          Validations for '{{ clickedItem.column_name }}({{ clickedItem.dt }})'
        </v-card-title>
        <v-card-text>
          <div class="d-flex">
            <v-spacer />

            <v-btn outlined x-small @click="validatorEditDialog = false">
              <!-- Cancel -->
              {{ $t('general.cancel') }}
            </v-btn>
            <x-btn
              outlined
              tooltip="Add new validation"
              color="primary"
              x-small
              @click.prevent="(clickedItem.validate.func.push(''),edited=true,scrollAndFocusLastRowInModal())"
            >
              <v-icon small left>
                mdi-plus
              </v-icon>
              Add Validation
            </x-btn>
            <v-btn outlined color="primary" x-small @click.prevent="saveValidationForColumn(clickedItem)">
              <!-- Save -->
              {{ $t('general.save') }}
            </v-btn>
          </div>
          <v-simple-table v-if="clickedItem.validate.func && clickedItem.validate.func.length" dense>
            <thead>
              <tr>
                <th class="caption font-weight-normal">
                  Validation Function
                </th>
                <th class="caption font-weight-normal">
                  Error Message
                </th>
                <!--                <th class="caption font-weight-normal">Optional Argument</th>-->
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(func,i) in clickedItem.validate.func" :key="i">
                <td>
                  <v-edit-dialog
                    lazy
                  >
                    <span>{{ func }}</span>
                    <template #input>
                      <v-autocomplete
                        v-model="clickedItem.validate.func[i]"
                        dense
                        :items="fnList"
                        item-text="func"
                        @change="onFunctionChange(i,clickedItem)"
                      />
                    </template>
                  </v-edit-dialog>
                </td>
                <td>
                  <v-edit-dialog lazy>
                    <span> {{ clickedItem.validate.msg[i] }}</span>
                    <template #input>
                      <v-text-field
                        v-model="clickedItem.validate.msg[i]"
                        :label="$t('general.edit')"
                        single-line
                        @input="edited=true"
                      />
                    </template>
                  </v-edit-dialog>
                </td>
                <!--                <td>-->
                <!--                  <v-edit-dialog lazy>-->
                <!--                    <span> {{ clickedItem.validate.args[i] }}</span>-->
                <!--                    <template v-slot:input>-->
                <!--                      <v-text-field-->
                <!--                        @input="edited=true"-->
                <!--                        v-model="clickedItem.validate.args[i]"-->
                <!--                        label="Edit"-->
                <!--                        single-line-->
                <!--                      ></v-text-field>-->
                <!--                    </template>-->
                <!--                  </v-edit-dialog>-->
                <!--                </td>-->

                <td>
                  <x-icon
                    small
                    color="error"
                    tooltip="Delete role"
                    @click="deleteValidation(clickedItem,i)"
                  >
                    mdi-delete-forever
                  </x-icon>
                </td>
              </tr>
            </tbody>
          </v-simple-table>
          <div v-else class="d-flex justify-center">
            <v-alert
              dense
              outlined
              type="info"
              color="grey lighten-1"
              icon="mdi-information-outline"
              class="caption mt-4"
              style="width:auto"
            >
              No validation for '{{ clickedItem.column_name }}'
            </v-alert>
          </div>
        </v-card-text>
        <!--        <v-card-actions>-->
        <!--          <v-spacer></v-spacer>-->
        <!--    -->
        <!--        </v-card-actions>-->
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script>

const validatorFnList = [{ func: 'contains', args: '', msg: 'Error contains' }, {
  func: 'equals',
  args: '',
  msg: 'Error equals'
}, {
  func: 'isAfter',
  args: '',
  msg: 'Error isAfter'
}, { func: 'isAlpha', args: '', msg: 'Error isAlpha' }, {
  func: 'isAlphanumeric',
  args: '',
  msg: 'Error isAlphanumeric'
}, {
  func: 'isAscii',
  args: '',
  msg: 'Error isAscii'
}, { func: 'isBase32', args: '', msg: 'Error isBase32' }, { func: 'isBase64', args: '', msg: 'Error isBase64' }, {
  func: 'isBefore',
  args: '',
  msg: 'Error isBefore'
}, { func: 'isBIC', args: '', msg: 'Error isBIC' }, { func: 'isBoolean', args: '', msg: 'Error isBoolean' }, {
  func: 'isBtcAddress',
  args: '',
  msg: 'Error isBtcAddress'
}, { func: 'isByteLength', args: '', msg: 'Error isByteLength' }, {
  func: 'isCreditCard',
  args: '',
  msg: 'Error isCreditCard'
}, {
  func: 'isCurrency',
  args: '',
  msg: 'Error isCurrency'
}, { func: 'isDataURI', args: '', msg: 'Error isDataURI' }, { func: 'isDate', args: '', msg: 'Error isDate' }, {
  func: 'isDecimal',
  args: '',
  msg: 'Error isDecimal'
}, { func: 'isDivisibleBy', args: '', msg: 'Error isDivisibleBy' }, {
  func: 'isEAN',
  args: '',
  msg: 'Error isEAN'
}, {
  func: 'isEmail',
  args: '',
  msg: 'Error isEmail'
}, { func: 'isEmpty', args: '', msg: 'Error isEmpty' }, {
  func: 'isEthereumAddress',
  args: '',
  msg: 'Error isEthereumAddress'
}, {
  func: 'isFloat',
  args: '',
  msg: 'Error isFloat'
}, { func: 'isFQDN', args: '', msg: 'Error isFQDN' }, { func: 'isFullWidth', args: '', msg: 'Error isFullWidth' }, {
  func: 'isHalfWidth',
  args: '',
  msg: 'Error isHalfWidth'
}, { func: 'isHash', args: '', msg: 'Error isHash' }, {
  func: 'isHexadecimal',
  args: '',
  msg: 'Error isHexadecimal'
}, {
  func: 'isHexColor',
  args: '',
  msg: 'Error isHexColor'
}, { func: 'isHSL', args: '', msg: 'Error isHSL' }, { func: 'isIBAN', args: '', msg: 'Error isIBAN' }, {
  func: 'isIdentityCard',
  args: '',
  msg: 'Error isIdentityCard'
}, { func: 'isIMEI', args: '', msg: 'Error isIMEI' }, {
  func: 'isIn',
  args: '',
  msg: 'Error isIn'
}, { func: 'isInt', args: '', msg: 'Error isInt' }, {
  func: 'isIP',
  args: '',
  msg: 'Error isIP'
}, { func: 'isIPRange', args: '', msg: 'Error isIPRange' }, { func: 'isISBN', args: '', msg: 'Error isISBN' }, {
  func: 'isISIN',
  args: '',
  msg: 'Error isISIN'
}, { func: 'isISO8601', args: '', msg: 'Error isISO8601' }, {
  func: 'isISO31661Alpha2',
  args: '',
  msg: 'Error isISO31661Alpha2'
}, {
  func: 'isISO31661Alpha3',
  args: '',
  msg: 'Error isISO31661Alpha3'
}, { func: 'isISRC', args: '', msg: 'Error isISRC' }, {
  func: 'isISSN',
  args: '',
  msg: 'Error isISSN'
}, { func: 'isJSON', args: '', msg: 'Error isJSON' }, {
  func: 'isJWT',
  args: '',
  msg: 'Error isJWT'
}, { func: 'isLatLong', args: '', msg: 'Error isLatLong' }, { func: 'isLength', args: '', msg: 'Error isLength' }, {
  func: 'isLocale',
  args: '',
  msg: 'Error isLocale'
}, { func: 'isLowercase', args: '', msg: 'Error isLowercase' }, {
  func: 'isMACAddress',
  args: '',
  msg: 'Error isMACAddress'
}, {
  func: 'isMagnetURI',
  args: '',
  msg: 'Error isMagnetURI'
}, { func: 'isMD5', args: '', msg: 'Error isMD5' }, { func: 'isMimeType', args: '', msg: 'Error isMimeType' }, {
  func: 'isMobilePhone',
  args: '',
  msg: 'Error isMobilePhone'
}, { func: 'isMongoId', args: '', msg: 'Error isMongoId' }, {
  func: 'isMultibyte',
  args: '',
  msg: 'Error isMultibyte'
}, {
  func: 'isNumeric',
  args: '',
  msg: 'Error isNumeric'
}, { func: 'isOctal', args: '', msg: 'Error isOctal' }, {
  func: 'isPassportNumber',
  args: '',
  msg: 'Error isPassportNumber'
}, {
  func: 'isPort',
  args: '',
  msg: 'Error isPort'
}, { func: 'isPostalCode', args: '', msg: 'Error isPostalCode' }, {
  func: 'isRFC3339',
  args: '',
  msg: 'Error isRFC3339'
}, {
  func: 'isRgbColor',
  args: '',
  msg: 'Error isRgbColor'
}, { func: 'isSemVer', args: '', msg: 'Error isSemVer' }, {
  func: 'isSurrogatePair',
  args: '',
  msg: 'Error isSurrogatePair'
}, {
  func: 'isUppercase',
  args: '',
  msg: 'Error isUppercase'
}, { func: 'isSlug', args: '', msg: 'Error isSlug' }, {
  func: 'isTaxID',
  args: '',
  msg: 'Error isTaxID'
}, { func: 'isURL', args: '', msg: 'Error isURL' }, {
  func: 'isUUID',
  args: '',
  msg: 'Error isUUID'
}, { func: 'isVariableWidth', args: '', msg: 'Error isVariableWidth' }, {
  func: 'isWhitelisted',
  args: '',
  msg: 'Error isWhitelisted'
}, { func: 'matches', args: '', msg: 'Error matches' }]

export default {
  name: 'Validation',
  props: ['nodes'],
  data: () => ({
    fnList: validatorFnList,
    columns: null,
    validators: [{}, {}],
    tableMeta: null,
    edited: false,
    loading: false,
    clickedItem: null,
    validatorEditDialog: false
  }),
  async created() {
    await this.loadTableModelMeta()
  },
  methods: {

    editOrAddValidation(item) {
      this.clickedItem = JSON.parse(JSON.stringify(item))
      this.validatorEditDialog = true
    },

    // async loadColumnList() {
    //   const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
    //     env: this.nodes.env,
    //     dbAlias: this.nodes.dbAlias
    //   }, 'columnList', {
    //     table_name: this.nodes.table_name
    //   }]);
    //   console.log("table ", result.data.list);
    //   this.columns = result.data.list;
    // },
    async loadTableModelMeta() {
      this.edited = false
      this.tableMeta = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'tableXcModelGet', {
        table_name: this.nodes.table_name
      }])
      this.columns = JSON.parse(this.tableMeta.meta)
    },

    scrollAndFocusLastRow() {
      this.$nextTick(() => {
        const menuActivator = this.$el && this.$el.querySelector('.v-expansion-panel--active table tr:last-child .v-small-dialog__activator__content')
        if (menuActivator) {
          menuActivator.click()
          this.$nextTick(() => {
            const inputField = document.querySelector('.menuable__content__active input')
            inputField && inputField.select()
          })
        }
      })
    },
    scrollAndFocusLastRowInModal() {
      this.$nextTick(() => {
        const modal = document.querySelector('.v-dialog--active')
        modal.scrollTop = 99999
        const menuActivator = modal.querySelector('table tr:last-child .v-small-dialog__activator__content')
        if (menuActivator) {
          menuActivator.click()
          this.$nextTick(() => {
            const inputField = document.querySelector('.menuable__content__active input')
            inputField && inputField.select()
          })
        }
      })
    },
    async saveValidations() {
      this.edited = false
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcModelSet', {
          table_name: this.nodes.table_name,
          meta: this.columns
        }])
        this.$toast.success('Successfully updated validations').goAway(3000)
      } catch (e) {
        this.$toast.error('Failed to update validations').goAway(3000)
      }
    },
    async saveValidationForColumn(clickedItem) {
      if (clickedItem) {
        const item = this.columns.columns.find(it => it.column_name === clickedItem.column_name)
        if (item) {
          Object.assign(item, clickedItem)
          await this.saveValidations()
          this.validatorEditDialog = false
          this.clickedItem = null
        }
      }
    },
    onFunctionChange(i, item) {
      this.edited = true
      const fn = validatorFnList.find(({ func }) => func === item.validate.func[i])
      item.validate.msg[i] = `Validation failed : ${item.validate.func[i]}(${this.nodes.table_name}.${item.column_name})`
      item.validate.args[i] = fn.args
    },
    deleteValidation(item, i) {
      this.edited = true
      item.validate.func.splice(i, 1)
      item.validate.args.splice(i, 1)
      item.validate.msg.splice(i, 1)
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
