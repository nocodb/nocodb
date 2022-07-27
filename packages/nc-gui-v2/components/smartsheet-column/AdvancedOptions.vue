<script setup lang="ts">

import useProject from "~/composables/useProject";

const {sqlUi} = useProject()

// const dataTypes = computed(() => sqlUi?.value?.getDataTypeListForUiType(this.newColumn, this.idType)
</script>

<template>
  <div class="p-4 border-[2px] radius-1 border-grey w-full">
    <div class="flex justify-space-between">
      <a-form-item label="NN" :label-col="2">
        <a-checkbox size="small" class="nc-column-name-input"/>
      </a-form-item>
      <a-form-item label="PK">
        <a-checkbox size="small" class="nc-column-name-input"/>
      </a-form-item>
      <a-form-item label="AI">
        <a-checkbox size="small" class="nc-column-name-input"/>
      </a-form-item>
      <a-form-item label="UN">
        <a-checkbox size="small" class="nc-column-name-input"/>
      </a-form-item>
      <a-form-item label="AU">
        <a-checkbox size="small" class="nc-column-name-input"/>
      </a-form-item>
    </div>

<!--    <a-form-item :label="$t('labels.databaseType')">
      <a-select size="small" class="nc-column-name-input">
        <a-select-option v-for="opt in dataTypes" :key="opt.name" :value="opt.name">
          <div class="flex gap-1 align-center text-xs">
            <component :is="opt.icon" class="text-grey" />
            {{ opt.name }}
          </div>
        </a-select-option>
      </a-select>
    </a-form-item>-->

    <!--      <div class="d-flex justify-space-between caption">
            <v-checkbox
              v-model="newColumn.rqd"
              :disabled="newColumn.pk || !sqlUi.columnEditable(newColumn)"
              class="mr-2 mt-0"
              dense
              hide-details
              label="NN"
              @change="newColumn.altered = newColumn.altered || 2"
            >
              <template #label>
                <span class="caption font-weight-bold">NN</span>
              </template>
            </v-checkbox>
            <v-checkbox
              v-model="newColumn.pk"
              :disabled="!sqlUi.columnEditable(newColumn)"
              class="mr-2 mt-0"
              dense
              hide-details
              label="PK"
              @change="newColumn.altered = newColumn.altered || 2"
            >
              <template #label>
                <span class="caption font-weight-bold">PK</span>
              </template>
            </v-checkbox>
            <v-checkbox
              v-model="newColumn.ai"
              :disabled="sqlUi.colPropUNDisabled(newColumn) || !sqlUi.columnEditable(newColumn)"
              class="mr-2 mt-0"
              dense
              hide-details
              label="AI"
              @change="newColumn.altered = newColumn.altered || 2"
            >
              <template #label>
                <span class="caption font-weight-bold">AI</span>
              </template>
            </v-checkbox>
            <v-checkbox
              v-model="newColumn.un"
              class="mr-2 mt-0"
              dense
              hide-details
              label="UN"
              :disabled="sqlUi.colPropUNDisabled(newColumn) || !sqlUi.columnEditable(newColumn)"
              @change="newColumn.altered = newColumn.altered || 2"
            >
              <template #label>
                <span class="caption font-weight-bold">UN</span>
              </template>
            </v-checkbox>

            <v-checkbox
              v-model="newColumn.au"
              class="mr-2 mt-0"
              dense
              hide-details
              label="UN"
              :disabled="sqlUi.colPropAuDisabled(newColumn) || !sqlUi.columnEditable(newColumn)"
              @change="newColumn.altered = newColumn.altered || 2"
            >
              <template #label>
                <span class="caption font-weight-bold">AU</span>
              </template>
            </v-checkbox>

            &lt;!&ndash; label="Type in Database" &ndash;&gt;
            <v-autocomplete
              v-model="newColumn.dt"
              hide-details
              class="caption data-type"
              :label="$t('labels.databaseType')"
              dense
              outlined
              :items="dataTypes"
              @change="onDataTypeChange"
            />
            &lt;!&ndash; label="Length / Values" &ndash;&gt;
            <v-text-field
              v-if="!isSelect"
              v-model="newColumn.dtxp"
              dense
              :disabled="sqlUi.getDefaultLengthIsDisabled(newColumn.dt) || !sqlUi.columnEditable(newColumn)"
              class="caption"
              :label="$t('labels.lengthValue')"
              outlined
              hide-details
              @input="newColumn.altered = newColumn.altered || 2"
            />

            <v-text-field
              v-model="newColumn.dtxs"
              dense
              :disabled="!sqlUi.columnEditable(newColumn)"
              class="caption"
              label="Scale"
              outlined
              hide-details
              @input="newColumn.altered = newColumn.altered || 2"
            />
            <v-textarea
              v-model="newColumn.cdf"
              :label="$t('placeholder.defaultValue')"
              :hint="sqlUi.getDefaultValueForDatatype(newColumn.dt)"
              persistent-hint
              rows="3"
              outlined
              dense
              class="caption"
              @input="
                newColumn.altered = newColumn.altered || 2
                newColumn.cdf = newColumn.cdf || null
              "
            />
          </div>-->
  </div>
</template>

<style scoped></style>
