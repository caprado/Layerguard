import { defineConfig } from 'archgate/config'

export default defineConfig({
  layers: {
    components: { path: 'src/components' },
    hooks: { path: 'src/hooks' },
  },
  flow: [
    'components -> hooks',
  ],
})
