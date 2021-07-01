<template>
  <v-chip small text-color="textColor" :color="isDark ? '' : 'primary lighten-5'"
          @click="active && $emit('edit',item)"
  >{{ value }}
    <div v-show="active" class="mr-n1 ml-2">
      <x-icon
        :color="['text' , 'textLight']"
        x-small
        icon.class="unlink-icon"
        @click.stop="$emit('unlink',item)"
      >mdi-close-thick
      </x-icon>
    </div>
  </v-chip>
</template>

<script>
export default {
  props: {
    value: String,
    active: Boolean,
    item: Object
  },
  name: "item-chip"
}
</script>

<style scoped>

</style>
