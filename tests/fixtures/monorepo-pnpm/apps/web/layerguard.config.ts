import { defineConfig } from 'layerguard/config'

export default defineConfig({
  layers: {
    pages: { path: 'src/pages' },
    components: { path: 'src/components' },
  },
  flow: [
    'pages -> components',
  ],
})
