import { defineConfig } from 'layerguard/config'

export default defineConfig({
  layers: {
    modules: { path: 'src/modules' },
    shared: { path: 'src/shared' },
  },
  flow: [
    'modules -> shared',
  ],
  rules: {
    circular: 'error',
  },
})
