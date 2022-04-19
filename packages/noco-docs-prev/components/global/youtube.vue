<template>
  <div>
    <iframe type="text/html" width="100%" style="height:100%"
            :src="`https://www.youtube.com/embed/${id}`"
            frameborder="0" allowfullscreen></iframe>
  </div>
</template>

<script>
export default {
  name: "youtube",
  props: {
    id: String
  }
}
</script>

<style scoped>
div {
  background-color: red;
  width: 100%;
  padding-top: min(500px,56%);
  position: relative;
}

iframe {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
}
</style>