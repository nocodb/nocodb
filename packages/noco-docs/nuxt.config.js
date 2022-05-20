import theme from '@nuxt/content-theme-docs'
import path from 'path'

export default theme({
  docs: {
    primaryColor: '#1348ba'
  },
  css: [
    "./assets/main.css"
  ],
  plugins: [
    {src: path.join(__dirname, 'plugins','nc.js'), ssr:false}
  ]
})

