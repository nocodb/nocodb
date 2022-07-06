<script setup lang="ts">
import { computed } from "@vue/reactivity";
import type { ColumnType } from "nocodb-sdk";
import useColumn from "~/composables/useColumn";

const { column, modelValue: value } = defineProps<{ column: ColumnType; modelValue: any }>();

const emit = defineEmits(["update:modelValue"]);

provide("column", column);

const localState = computed({
  get() {
    return value;
  },
  set(val) {
    emit("update:modelValue", val);
  }
});

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
  isString
} = useColumn(column);
</script>

<template>
  <div class="nc-cell" @keydown.stop.left @keydown.stop.right @keydown.stop.up @keydown.stop.down>
    <!--    <EditableAttachmentCell -->
    <!--      v-if="isAttachment" -->
    <!--      /> -->
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

    <RatingCell
      v-else-if="isRating"
      v-model="localState"
      :active="active"
      :is-form="isForm"
      :column="column"
      :is-public-grid="isPublic && !isForm"
      :is-public-form="isPublic && isForm"
      :is-locked="isLocked"
      v-on="$listeners"
    />

    <DurationCell
      v-else-if="isDuration"
      v-model="localState"
      :active="active"
      :is-form="isForm"
      :column="column"
      :is-locked="isLocked"
      v-on="parentListeners"
    />

    <BooleanCell
      v-else-if="isBoolean"
      v-model="localState"
      :column="column"
      :is-form="isForm"
      v-on="parentListeners"
    />

    <IntegerCell
      v-else-if="isInt"
      v-model="localState"
      v-on="parentListeners"
    />

    <FloatCell
      v-else-if="isFloat"
      v-model="localState"
      v-on="parentListeners"
    />

    <DatePickerCell
      v-else-if="isDate"
      v-model="localState"
      v-on="parentListeners"
    />

    <TimePickerCell
      v-else-if="isTime"
      v-model="localState"
      v-on="parentListeners"
      @save="$emit('save')"
    />

    <DateTimePickerCell
      v-else-if="isDateTime"
      v-model="localState"
      ignore-focus
      v-on="parentListeners"
    />

    <EnumCell
      v-else-if="isEnum && ((!isForm && !active) || isLocked || (isPublic && !isForm))"
      v-model="localState"
      :column="column"
      v-on="parentListeners"
    />
    <EnumListCell
      v-else-if="isEnum"
      v-model="localState"
      :is-form="isForm"
      :column="column"
      v-on="parentListeners"
    />

    <JsonEditableCell
      v-else-if="isJSON"
      v-model="localState"
      :is-form="isForm"
      v-on="parentListeners"
      @input="$emit('save')"
    />

    <SetListEditableCell
      v-else-if="isSet && (active || isForm) && !isLocked && !(isPublic && !isForm)"
      v-model="localState"
      :column="column"
      v-on="parentListeners"
    />
    <SetListCell
      v-else-if="isSet"
      v-model="localState"
      :column="column"
      v-on="parentListeners"
    />

    <EditableUrlCell v-else-if="isURL" v-model="localState" v-on="parentListeners" />

    <TextCell v-else-if="isString" v-model="localState" v-on="parentListeners" />

    <TextAreaCell
      v-else-if="isTextArea"
      v-model="localState"
      :is-form="isForm"
      v-on="parentListeners"
    />

    <TextCell v-else v-model="localState" v-on="$listeners" />
    <span v-if="hint" class="nc-hint">{{ hint }}</span>

    <div v-if="(isLocked || (isPublic && !isForm)) && !isAttachment" class="nc-locked-overlay" />
  </div>
</template>

<style scoped>
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
