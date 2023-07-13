<template>
  <div>
    <NuxtWelcome />
  </div>
</template>


<script lang="ts" setup>
import {onMounted} from "@vue/runtime-core";
import ImportWorker from './workers/importWorker?worker';

onMounted(() => {
  const worker = new ImportWorker()
  worker.postMessage('Hello World')
  worker.onmessage = (e) => {
    console.log(e.data)
  }
})
</script>
