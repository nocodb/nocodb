<template>
  <div class="container">

    <Card style="width:500px">
      <template #title>
        Signup
      </template>
      <template #content>
        <InputText type="text" v-model="value" label="Email"/>
       </template>
      <template #footer>
        <Button label="Small" icon="pi pi-check" class="p-button-sm"  />
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useToast } from "primevue/usetoast";
const text = ref();
const toast = useToast();
const greet = () => {
  toast.add({severity: 'info', summary: 'Hello '  + text.value});
}
</script>

<style lang="scss">
.container {
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  div {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 1rem;
  }
}
</style>
