import { defineConfig } from 'layerguard/config'

export default defineConfig({
  layers: {
    handlers: { path: 'src/handlers' },
    services: { path: 'src/services' },
  },
  flow: [
    'handlers -> services',
  ],
})
