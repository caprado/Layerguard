import { defineConfig } from 'archgate/config'

export default defineConfig({
  layers: {
    helpers: { path: 'src/helpers' },
    validators: { path: 'src/validators' },
  },
  flow: [
    'helpers -> validators',
  ],
})
