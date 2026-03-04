import { defineConfig } from 'archgate/config'

export default defineConfig({
  layers: {
    handlers: { path: 'src/handlers' },
    services: { path: 'src/services' },
  },
  flow: [
    'handlers -> services',
  ],
})
