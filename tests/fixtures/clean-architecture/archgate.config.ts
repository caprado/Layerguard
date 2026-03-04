import { defineConfig } from 'archgate/config'

export default defineConfig({
  layers: {
    handlers: { path: 'src/handlers' },
    services: { path: 'src/services' },
    repository: { path: 'src/repository' },
  },
  flow: [
    'handlers -> services',
    'services -> repository',
  ],
})
