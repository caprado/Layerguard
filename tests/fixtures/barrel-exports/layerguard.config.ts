import { defineConfig } from 'layerguard/config'

export default defineConfig({
  layers: {
    api: { path: 'src/api' },
    services: { path: 'src/services' },
    repository: { path: 'src/repository' },
  },
  flow: [
    'api -> services',
    'services -> repository',
  ],
})
