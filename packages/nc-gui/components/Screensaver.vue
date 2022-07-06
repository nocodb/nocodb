<template>
  <div class="body">
    <canvas />
  </div>
</template>

<script>
export default {
  name: 'Screensaver',
  mounted() {
    // Initialising the canvas
    const canvas = this.$el.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    // Setting the width and height of the canvas
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Setting up the letters
    let letters =
      'ABCDEFGHIJKLMNOPQRSTUVXYZABCDEFGHIJKLMNOPQRSTUVXYZABCDEFGHIJKLMNOPQRSTUVXYZABCDEFGHIJKLMNOPQRSTUVXYZABCDEFGHIJKLMNOPQRSTUVXYZABCDEFGHIJKLMNOPQRSTUVXYZ';
    letters = letters.split('');

    // Setting up the columns
    const fontSize = 10;
    const columns = canvas.width / fontSize;

    // Setting up the drops
    const drops = [];
    for (let i = 0; i < columns; i++) {
      drops[i] = 1;
    }

    // Setting up the draw function
    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, .1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < drops.length; i++) {
        const text = letters[Math.floor(Math.random() * letters.length)];
        ctx.fillStyle = '#0f0';
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        drops[i]++;
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.95) {
          drops[i] = 0;
        }
      }
    }

    // Loop the animation
    setInterval(draw, 33);
  },
};
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
}

.body {
  background: #000;
  position: fixed;
  width: 100%;
  height: 100vh;
  top: 0;
  left: 0;
  z-index: 999999;
}

canvas {
  display: block;
}
</style>
