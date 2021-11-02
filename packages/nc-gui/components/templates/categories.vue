<template>
  <v-list dense height="20px">
    <v-list-item dense>
      <v-list-item-subtitle>
        <span class="caption">Categories</span>
      </v-list-item-subtitle>
    </v-list-item>
    <v-list-item-group v-model="category">
      <v-list-item v-for="c in categories" :key="c.title" :value="c.title" dense>
        <v-list-item-title>
                <span
                  :class="{'font-weight-black' : category === c.title } "
                >
                  {{
                    c.title
                  }}<span />
                </span>
        </v-list-item-title>
      </v-list-item>
    </v-list-item-group>
  </v-list>
</template>

<script>
import categories from './templates.categories'
export default {
  name: "categories",
  props:{value:String},
  data:()=>({
    categories
  }),
  computed:{
    category:{
      get(){
        return this.value;
      },
      set(v){
        this.$emit('input', v)
      }
    }
  }
}
</script>

<style scoped>

</style>
