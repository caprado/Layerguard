import { defineConfig } from 'layerguard/config'

export default defineConfig({
  layers: {
    components: { path: 'src/components' },
    hooks: { path: 'src/hooks' },
  },
  flow: [
    'components -> hooks',
  ],
})
