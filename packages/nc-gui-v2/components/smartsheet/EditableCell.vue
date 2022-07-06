<script setup lang="ts">
import { computed } from '@vue/reactivity'
import type { ColumnType } from 'nocodb-sdk'
import useColumn from '~/composables/useColumn'

const { column, modelValue: value } = defineProps<{ column: ColumnType; modelValue: any }>()

const emit = defineEmits(['update:modelValue'])

provide('column', column)

const localState = computed({
  get() {
    return value
  },
  set(val) {
    emit('update:modelValue', val)
  },
})

const {
  isSet,
  isEnum,
  isURL,
  isEmail,
  isJSON,
  isDate,
  isDateTime,
  isTime,
  isBoolean,
  isDuration,
  isRating,
  isCurrency,
  isAttachment,
  isTextArea,
  isString,
} = useColumn(column)
</script>

<template>
  <div class="nc-cell" @keydown.stop.left @keydown.stop.right @keydown.stop.up @keydown.stop.down>
    <!--    <RatingCell -->
    <!--      v-if="isRating" -->
    <!--      /> -->
    <!--      v-model="localState"
          :active="active"
          :is-form="isForm"
          :column="column"
          :is-public-grid="isPublic && !isForm"
          :is-public-form="isPublic && isForm"
          :is-locked="isLocked"
          v-on="$listeners"
        /> -->

    <!--    <DurationCell -->
    <!--      v-else-if="isDuration" -->
    <!--      /> -->
    <!-- &lt;!&ndash;      v-model="localState" -->
    <!--      :active="active" -->
    <!--      :is-form="isForm" -->
    <!--      :column="column" -->
    <!--      :is-locked="isLocked" -->
    <!--      v-on="parentListeners" -->
    <!--    />&ndash;&gt; -->

    <!--    <IntegerCell -->
    <!--      v-else-if="isInt" -->
    <!--      /> -->
    <!-- &lt;!&ndash;      v-model="localState" -->
    <!--      v-on="parentListeners" -->
    <!--    />&ndash;&gt; -->

    <!--    <FloatCell -->
    <!--      v-else-if="isFloat" -->
    <!--      /> -->
    <!-- &lt;!&ndash;      v-model="localState" -->
    <!--      v-on="parentListeners" -->
    <!--    />&ndash;&gt; -->

    <!--    <DatePickerCell -->
    <!--      v-else-if="isDate" -->
    <!--      /> -->
    <!-- &lt;!&ndash;      v-model="localState" -->
    <!--      v-on="parentListeners" -->
    <!--    />&ndash;&gt; -->

    <!--    <TimePickerCell -->
    <!--      v-else-if="isTime" -->
    <!--      /> -->
    <!-- &lt;!&ndash;      v-model="localState" -->
    <!--      v-on="parentListeners" -->
    <!--      @save="$emit('save')" -->
    <!--    />&ndash;&gt; -->

    <!--    <DateTimePickerCell -->
    <!--      v-else-if="isDateTime" -->
    <!--      /> -->
    <!-- &lt;!&ndash;      v-model="localState" -->
    <!--      ignore-focus -->
    <!--      v-on="parentListeners" -->
    <!--    />&ndash;&gt; -->

    <!--    <EnumCell -->
    <!--      v-else-if="isEnum && ((!isForm && !active) || isLocked || (isPublic && !isForm))" -->
    <!--      /> -->
    <!-- &lt;!&ndash;      v-model="localState" -->
    <!--      :column="column" -->
    <!--      v-on="parentListeners" -->
    <!--    />&ndash;&gt; -->
    <!--    <EnumListCell -->
    <!--      v-else-if="isEnum" -->
    <!--      /> -->
    <!-- &lt;!&ndash;      v-model="localState"&ndash;&gt; -->
    <!-- &lt;!&ndash;      :is-form="isForm"&ndash;&gt; -->
    <!-- &lt;!&ndash;      :column="column"&ndash;&gt; -->
    <!-- &lt;!&ndash;      v-on="parentListeners"&ndash;&gt; -->
    <!-- &lt;!&ndash;    />&ndash;&gt; -->

    <!--    <JsonEditableCell -->
    <!--      v-else-if="isJSON" -->
    <!--      /> -->
    <!-- &lt;!&ndash;      v-model="localState" -->
    <!--      :is-form="isForm" -->
    <!--      v-on="parentListeners" -->
    <!--      @input="$emit('save')" -->
    <!--    />&ndash;&gt; -->

    <!--    <SetListEditableCell -->
    <!--      v-else-if="isSet && (active || isForm) && !isLocked && !(isPublic && !isForm)" -->
    <!--      /> -->
    <!-- &lt;!&ndash;      v-model="localState" -->
    <!--      :column="column" -->
    <!--      v-on="parentListeners" -->
    <!--    />&ndash;&gt; -->
    <!--    <SetListCell -->
    <!--      v-else-if="isSet" -->
    <!--      /> -->
    <!-- &lt;!&ndash;      v-model="localState" -->
    <!--      :column="column" -->
    <!--      v-on="parentListeners" -->
    <!--    />&ndash;&gt; -->

    <!--    <EditableUrlCell v-else-if="isURL" -->
    <!--                     /> -->
    <!-- &lt;!&ndash;                     v-model="localState" v-on="parentListeners" &ndash;&gt; -->
    <!-- &lt;!&ndash;    />&ndash;&gt; -->

    <EditableCellText v-if="isString" v-model="localState" />
    <!-- v-on="parentListeners"
        />
    -->

    <EditableCellTextArea v-else-if="isTextArea" v-model="localState" />
    <!--      v-model="localState"
          :is-form="isForm"
          v-on="parentListeners"
        /> -->

    <EditableCellBoolean v-else-if="isBoolean" v-model="localState" />
    <!-- &lt;!&ndash;      v-model="localState" -->
    <!--      :column="column" -->
    <!--      :is-form="isForm" -->
    <!--      v-on="parentListeners" -->
    <!--    />&ndash;&gt; -->

    <EditableCellAttachment v-if="isAttachment" v-model="localState" />
    <!--      v-model="localState"
          :active="active"
          :db-alias="dbAlias"
          :meta="meta"
          :is-form="isForm"
          :column="column"
          :is-public-grid="isPublic && !isForm"
          :is-public-form="isPublic && isForm"
          :view-id="viewId"
          :is-locked="isLocked"
          v-on="$listeners"
        /> -->

    <EditableCellText v-else v-model="localState" />
    <!--  v-on="$listeners"   <span v-if="hint" class="nc-hint">{{ hint }}</span> -->

    <!--    <div v-if="(isLocked || (isPublic && !isForm)) && !isAttachment" class="nc-locked-overlay" /> -->
  </div>
</template>

<style scoped>
textarea {
  outline: none;
}

div {
  width: 100%;
  height: 100%;
  color: var(--v-textColor-base);
}

.nc-hint {
  font-size: 0.61rem;
  color: grey;
}

.nc-cell {
  position: relative;
}

.nc-locked-overlay {
  position: absolute;
  z-index: 2;
  height: 100%;
  width: 100%;
  top: 0;
  left: 0;
}
</style>
