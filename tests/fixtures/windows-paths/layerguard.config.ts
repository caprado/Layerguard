import { defineConfig } from 'layerguard/config'

export default defineConfig({
  layers: {
    utils: { path: 'src\\utils' },  // Backslash path (Windows style)
    lib: { path: 'src/lib' },       // Forward slash path (Unix style)
  },
  flow: [
    'lib -> utils',  // lib can import from utils
  ],
})
