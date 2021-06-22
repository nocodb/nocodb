<template>
  <v-chip small :color="color"
          @click="active && $emit('edit',item)"
  >{{value}}
    <div v-show="active" class="mr-n1 ml-2 mt-n1">
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
  props:{
    color:String,
    value:String,
    active:Boolean,
    item:Object
  },
  name: "item-chip"
}
</script>

<style scoped>

</style>
