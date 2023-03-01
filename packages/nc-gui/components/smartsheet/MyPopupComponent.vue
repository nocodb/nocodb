<script lang="ts" setup></script>

<template>
  <div>Test</div>
  <!-- <div v-if="popupIsOpen" ref="popupContainer">
    <div v-for="column in fields" :key="column.id">
      <LazyCellTextArea v-if="isTextArea(column)" v-model="popUpRow?.row[column.title]" />
      <LazyCellCheckbox v-else-if="isBoolean(column, abstractType)" v-model="vModel" />
    </div>
    FOOBAR
    <div>{{ popUpRow?.row.Title }}</div>
  </div> -->
</template>
