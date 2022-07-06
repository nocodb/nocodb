<template>
  <v-dialog
    v-model="dialogShow"
    persistent
    max-width="550"
    @keydown.esc="dialogShow = false"
    @keydown.enter="$emit('create', table)"
  >
    <!-- Create A New Table -->
    <v-card class="elevation-1 backgroundColor nc-create-table-card">
      <v-form ref="form" v-model="valid">
        <v-card-title class="primary subheading white--text py-2">
          {{ $t('activity.createTable') }}
        </v-card-title>

        <v-card-text class="py-6 px-10">
          <!--hint="Enter table name"-->
          <v-text-field
            ref="input"
            v-model="table.alias"
            solo
            flat
            persistent-hint
            dense
            hide-details1
            :rules="[validateTableName, validateDuplicateAlias]"
            :hint="$t('msg.info.enterTableName')"
            class="mt-4 caption nc-table-name"
          />

          <div class="d-flex justify-end">
            <div class="grey--text caption pointer" @click="isAdvanceOptVisible = !isAdvanceOptVisible">
              {{ isAdvanceOptVisible ? 'Hide' : 'Show' }} more
              <v-icon x-small color="grey">
                {{ isAdvanceOptVisible ? 'mdi-minus-circle-outline' : 'mdi-plus-circle-outline' }}
              </v-icon>
            </div>
          </div>

          <div class="nc-table-advanced-options" :class="{ active: isAdvanceOptVisible }">
            <!--hint="Table name as saved in database"-->
            <v-text-field
              v-if="!projectPrefix"
              v-model="table.name"
              solo
              flat
              dense
              persistent-hint
              :rules="[validateDuplicate]"
              :hint="$t('msg.info.tableNameInDb')"
              class="mt-4 caption nc-table-name-alias"
            />

            <div class="mt-5">
              <label class="add-default-title grey--text">
                <!--Add Default Columns-->
                {{ $t('msg.info.addDefaultColumns') }}
              </label>

              <div class="d-flex caption justify-space-between align-center">
                <v-checkbox
                  key="chk1"
                  v-model="table.columns"
                  dense
                  class="mt-0"
                  color="info"
                  hide-details
                  value="id"
                  @click.capture.prevent.stop="
                    () => {
                      $toast.info('ID column is required, you can rename this later if required.').goAway(3000);
                      if (!table.columns.includes('id')) {
                        table.columns.push('id');
                      }
                    }
                  "
                >
                  <template #label>
                    <div>
                      <span v-if="!isIdToggleAllowed" class="caption" @dblclick="isIdToggleAllowed = true">id</span>
                      <v-select
                        v-else
                        v-model="idType"
                        style="max-width: 100px"
                        class="caption"
                        outlined
                        dense
                        hide-details
                        :items="idTypes"
                      />
                    </div>
                  </template>
                </v-checkbox>
                <v-checkbox
                  key="chk2"
                  v-model="table.columns"
                  dense
                  class="mt-0"
                  color="info"
                  hide-details
                  value="title"
                >
                  <template #label>
                    <span class="caption">title</span>
                  </template>
                </v-checkbox>
                <v-checkbox
                  key="chk3"
                  v-model="table.columns"
                  dense
                  class="mt-0"
                  color="info"
                  hide-details
                  value="created_at"
                >
                  <template #label>
                    <span class="caption">created_at</span>
                  </template>
                </v-checkbox>
                <v-checkbox
                  key="chk4"
                  v-model="table.columns"
                  dense
                  class="mt-0"
                  color="info"
                  hide-details
                  value="updated_at"
                >
                  <template #label>
                    <span class="caption">updated_at</span>
                  </template>
                </v-checkbox>
              </div>
            </div>
          </div>
        </v-card-text>
        <v-divider />

        <v-card-actions class="py-4 px-10">
          <v-spacer />
          <v-btn class="" @click="dialogShow = false">
            {{ $t('general.cancel') }}
          </v-btn>
          <v-btn
            :disabled="!(table.name && table.name.length) || !(table.alias && table.alias.length) || !valid"
            color="primary"
            class="nc-create-table-submit"
            @click="onCreateBtnClick"
          >
            {{ $t('general.submit') }}
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script>
import { validateTableName } from '~/helpers';

export default {
  name: 'DlgTableCreate',
  props: ['value'],
  data() {
    return {
      isAdvanceOptVisible: false,
      table: {
        name: '',
        columns: ['id', 'title', 'created_at', 'updated_at'],
      },
      isIdToggleAllowed: false,
      valid: false,
      idType: 'AI',
      idTypes: [
        { value: 'AI', text: 'Auto increment number' },
        { value: 'AG', text: 'Auto generated string' },
      ],
    };
  },
  computed: {
    dialogShow: {
      get() {
        return this.value;
      },
      set(v) {
        this.$emit('input', v);
      },
    },
    projectPrefix() {
      return this.$store.getters['project/GtrProjectPrefix'];
    },
    tables() {
      return this.$store.state.project.tables || [];
    },
  },
  watch: {
    'table.alias'(alias) {
      this.$set(this.table, 'name', `${this.projectPrefix || ''}${alias}`);
    },
  },
  created() {
    this.populateDefaultTitle();
  },
  mounted() {
    setTimeout(() => {
      const el = this.$refs.input.$el;
      el.querySelector('input').focus();
      el.querySelector('input').select();
    }, 100);
  },

  methods: {
    populateDefaultTitle() {
      let c = 1;
      while (this.tables.some(t => t.title === `Sheet${c}`)) {
        c++;
      }
      this.$set(this.table, 'alias', `Sheet${c}`);
    },
    validateTableName(v) {
      return validateTableName(v, this.$store.getters['project/GtrProjectIsGraphql']);
    },
    validateDuplicateAlias(v) {
      return (this.tables || []).every(t => t.title !== (v || '')) || 'Duplicate table alias';
    },
    validateLedingOrTrailingWhiteSpace(v) {
      return !/^\s+|\s+$/.test(v) || 'Leading or trailing whitespace not allowed in table name';
    },
    validateDuplicate(v) {
      return (
        (this.tables || []).every(t => t.table_name.toLowerCase() !== (v || '').toLowerCase()) || 'Duplicate table name'
      );
    },
    onCreateBtnClick() {
      this.$emit('create', {
        ...this.table,
        columns: this.table.columns.map(c => (c === 'id' && this.idType === 'AG' ? 'id_ag' : c)),
      });
    },
  },
};
</script>

<style scoped lang="scss">
::v-deep {
  .v-text-field__details {
    padding: 0 2px !important;
    .v-messages:not(.error--text) {
      .v-messages__message {
        color: grey;
        font-size: 0.65rem;
      }
    }
  }
}
.add-default-title {
  font-size: 0.65rem;
}

.nc-table-advanced-options {
  max-height: 0;
  transition: 0.3s max-height;
  overflow: hidden;
  &.active {
    max-height: 200px;
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
