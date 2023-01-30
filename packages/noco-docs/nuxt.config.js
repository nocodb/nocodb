import theme from '@nuxt/content-theme-docs'
import path from 'path'

export default theme({
  docs: {
    primaryColor: '#4351e8'
  },
  css: [
    "./assets/main.css"
  ],
  plugins: [
    {src: path.join(__dirname, 'plugins','nc.js'), ssr:false}
  ]
})

