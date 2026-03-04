import { defineConfig } from 'archgate/config'

export default defineConfig({
  layers: {
    lib: { path: 'src/lib' },
    utils: { path: 'src/utils' },
  },
  flow: [
    'lib -> utils',
  ],
  rules: {
    unlayeredImports: 'error',
  },
})
