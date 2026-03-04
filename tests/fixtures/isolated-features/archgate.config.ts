import { defineConfig } from 'archgate/config'

export default defineConfig({
  layers: {
    components: {
      path: 'src/components',
      sublayers: {
        features: {
          path: 'src/components/features',
          isolated: true,
        },
        shared: {
          path: 'src/components/shared',
        },
      },
    },
  },
  flow: ['components -> components'], // Dummy flow to satisfy validation
})
