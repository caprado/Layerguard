/**
 * layerguard init command
 *
 * Interactive setup to create layerguard.config.ts
 */

import * as p from '@clack/prompts'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { LayerguardConfig, LayerConfig, SublayerConfig } from '../config/types.js'
import {
  detectFramework,
  scanForLayers,
  suggestFlowRules,
  shouldBeIsolated,
  type DetectedFramework,
  type DirectoryInfo,
} from './detect.js'
import { getAllPresets, getPresetByFramework, type Preset } from './presets.js'
import {
  generateConfigContent,
  writeConfigFile,
  configFileExists,
} from './generator.js'

/**
 * Options for the init command
 */
export interface InitCommandOptions {
  /**
   * Project root directory
   */
  cwd?: string

  /**
   * Skip interactive prompts (use defaults)
   */
  yes?: boolean
}

/**
 * Run the init command
 */
export async function runInit(options: InitCommandOptions = {}): Promise<void> {
  const { cwd = process.cwd(), yes = false } = options

  // Check if config already exists
  const existingConfig = configFileExists(cwd)
  if (existingConfig) {
    p.intro('layerguard init')
    p.log.warn(`Config file already exists: ${existingConfig}`)

    if (!yes) {
      const overwrite = await p.confirm({
        message: 'Do you want to overwrite it?',
        initialValue: false,
      })

      if (p.isCancel(overwrite) || !overwrite) {
        p.outro('Setup cancelled')
        return
      }
    }
  }

  // Start the interactive flow
  p.intro('Welcome to layerguard')

  // Detect framework
  const detection = detectFramework(cwd)
  const hasSrcDir = fs.existsSync(path.join(cwd, 'src'))

  let framework: DetectedFramework | undefined
  let usePreset = false
  let selectedPreset: Preset | undefined

  if (detection.framework !== 'unknown') {
    p.log.info(detection.details)

    if (!yes) {
      const useDetected = await p.confirm({
        message: `Use ${detection.details}?`,
        initialValue: true,
      })

      if (p.isCancel(useDetected)) {
        p.outro('Setup cancelled')
        return
      }

      if (useDetected) {
        framework = detection.framework
        selectedPreset = getPresetByFramework(framework, hasSrcDir)

        if (selectedPreset) {
          const usePresetChoice = await p.confirm({
            message: `Use recommended preset (${selectedPreset.name})?`,
            initialValue: true,
          })

          if (p.isCancel(usePresetChoice)) {
            p.outro('Setup cancelled')
            return
          }

          usePreset = usePresetChoice
        }
      }
    } else {
      framework = detection.framework
      selectedPreset = getPresetByFramework(framework, hasSrcDir)
      usePreset = true
    }
  }

  let config: LayerguardConfig

  if (usePreset && selectedPreset) {
    // Use preset config
    config = {
      layers: selectedPreset.layers,
      flow: selectedPreset.flow,
    }
    if (selectedPreset.framework) {
      config.framework = selectedPreset.framework
    }
  } else {
    // Custom configuration
    if (!yes) {
      // Ask if they want to choose a preset or go custom
      const presetChoice = await p.select({
        message: 'How would you like to set up layerguard?',
        options: [
          {
            value: 'scan',
            label: 'Scan my project',
            hint: 'Detect directories and suggest layers',
          },
          {
            value: 'preset',
            label: 'Choose a preset',
            hint: 'Use a pre-configured template',
          },
        ],
      })

      if (p.isCancel(presetChoice)) {
        p.outro('Setup cancelled')
        return
      }

      if (presetChoice === 'preset') {
        const presets = getAllPresets()
        const presetOptions = presets.map((preset) => ({
          value: preset,
          label: preset.name,
          hint: preset.description,
        }))

        const chosenPreset = await p.select({
          message: 'Choose a preset:',
          options: presetOptions,
        })

        if (p.isCancel(chosenPreset)) {
          p.outro('Setup cancelled')
          return
        }

        config = {
          layers: chosenPreset.layers,
          flow: chosenPreset.flow,
        }
        if (chosenPreset.framework) {
          config.framework = chosenPreset.framework
        }
      } else {
        // Scan project and configure
        const customConfig = await runCustomSetup(cwd, framework)
        if (!customConfig) {
          p.outro('Setup cancelled')
          return
        }
        config = customConfig
      }
    } else {
      // Non-interactive: use generic preset
      const preset = getPresetByFramework(framework ?? 'unknown', hasSrcDir)
      config = {
        layers: preset?.layers ?? {},
        flow: preset?.flow ?? [],
      }
      if (preset?.framework) {
        config.framework = preset.framework
      }
    }
  }

  // Add default rules
  config.rules = {
    circular: 'error',
    typeOnlyImports: 'ignore',
  }

  // Add default ignore patterns
  config.ignore = ['**/*.test.ts', '**/*.spec.ts', 'tests/**', 'dist/**']

  // Preview config
  if (!yes) {
    p.log.step('Preview:')
    console.log('')
    console.log(generateConfigContent(config, { typescript: detection.isTypeScript }))
    console.log('')

    const confirm = await p.confirm({
      message: 'Write this config file?',
      initialValue: true,
    })

    if (p.isCancel(confirm) || !confirm) {
      p.outro('Setup cancelled')
      return
    }
  }

  // Write config
  const filepath = writeConfigFile(cwd, config, {
    typescript: detection.isTypeScript,
  })

  p.outro(`Config written to ${path.basename(filepath)}`)
  console.log('')
  console.log('Run `layerguard check` to validate your architecture.')
  console.log('Run `layerguard show` to visualize the architecture.')
}

/**
 * Run custom setup with directory scanning
 */
async function runCustomSetup(
  cwd: string,
  framework?: DetectedFramework
): Promise<LayerguardConfig | null> {
  // Scan for directories
  const directories = scanForLayers(cwd)

  if (directories.length === 0) {
    p.log.warn('No directories found to use as layers.')
    return {
      layers: {},
      flow: [],
    }
  }

  // Select layers
  const layerOptions = directories.map((dir) => ({
    value: dir,
    label: dir.path,
    hint: dir.isCommon
      ? `${dir.fileCount} files (common pattern)`
      : `${dir.fileCount} files`,
  }))

  const selectedLayers = await p.multiselect({
    message: 'Select directories to use as layers:',
    options: layerOptions,
    initialValues: directories.filter((d) => d.isCommon).slice(0, 5),
    required: true,
  })

  if (p.isCancel(selectedLayers)) {
    return null
  }

  // Build layers config
  const layers: Record<string, LayerConfig> = {}
  const layerNames: string[] = []

  for (const dir of selectedLayers as DirectoryInfo[]) {
    const layerName = dir.name
    layerNames.push(layerName)

    const layerConfig: LayerConfig = { path: dir.path }

    // Check if this layer has subdirectories that could be sublayers
    if (dir.subdirs.length > 0) {
      const setupSublayers = await p.confirm({
        message: `${layerName} has subdirectories. Set up sublayers?`,
        initialValue: false,
      })

      if (p.isCancel(setupSublayers)) {
        return null
      }

      if (setupSublayers) {
        const sublayerOptions = dir.subdirs.map((sub) => {
          const opt: { value: string; label: string; hint?: string } = {
            value: sub,
            label: sub,
          }
          if (shouldBeIsolated(sub)) {
            opt.hint = 'Commonly isolated'
          }
          return opt
        })

        const selectedSublayers = await p.multiselect({
          message: `Select sublayers for ${layerName}:`,
          options: sublayerOptions,
          required: false,
        })

        if (p.isCancel(selectedSublayers)) {
          return null
        }

        if (
          selectedSublayers &&
          (selectedSublayers as string[]).length > 0
        ) {
          layerConfig.sublayers = {}

          for (const sub of selectedSublayers as string[]) {
            const sublayerConfig: SublayerConfig = { path: sub }

            // Check if should be isolated
            if (shouldBeIsolated(sub)) {
              const isolate = await p.confirm({
                message: `Should ${sub} be isolated? (no cross-feature imports)`,
                initialValue: true,
              })

              if (p.isCancel(isolate)) {
                return null
              }

              if (isolate) {
                sublayerConfig.isolated = true
              }
            }

            layerConfig.sublayers[sub] = sublayerConfig
          }

          // Suggest sublayer flow if multiple sublayers
          const sublayerNames = Object.keys(layerConfig.sublayers)
          if (sublayerNames.length >= 2) {
            const suggestedSublayerFlow = suggestSublayerFlow(sublayerNames)
            if (suggestedSublayerFlow.length > 0) {
              const useSublayerFlow = await p.confirm({
                message: `Use suggested sublayer flow? (${suggestedSublayerFlow.join(', ')})`,
                initialValue: true,
              })

              if (!p.isCancel(useSublayerFlow) && useSublayerFlow) {
                layerConfig.flow = suggestedSublayerFlow
              }
            }
          }
        }
      }
    }

    layers[layerName] = layerConfig
  }

  // Suggest flow rules
  const suggestedFlow = suggestFlowRules(layerNames)

  let flow: string[]

  if (suggestedFlow.length > 0) {
    const useFlow = await p.confirm({
      message: 'Use suggested flow rules based on common patterns?',
      initialValue: true,
    })

    if (p.isCancel(useFlow)) {
      return null
    }

    if (useFlow) {
      flow = suggestedFlow
    } else {
      // Manual flow rule entry
      const manualFlow = await p.text({
        message:
          'Enter flow rules (comma-separated, e.g., "components -> hooks, hooks -> utils"):',
        placeholder: 'components -> hooks, hooks -> utils',
        validate: (value) => {
          if (!value) return 'At least one flow rule is required'
          return undefined
        },
      })

      if (p.isCancel(manualFlow)) {
        return null
      }

      flow = (manualFlow as string)
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r)
    }
  } else {
    // No suggestions, manual entry
    const manualFlow = await p.text({
      message:
        'Enter flow rules (comma-separated, e.g., "components -> hooks, hooks -> utils"):',
      placeholder: 'components -> hooks, hooks -> utils',
      validate: (value) => {
        if (!value) return 'At least one flow rule is required'
        return undefined
      },
    })

    if (p.isCancel(manualFlow)) {
      return null
    }

    flow = (manualFlow as string)
      .split(',')
      .map((r) => r.trim())
      .filter((r) => r)
  }

  const config: LayerguardConfig = {
    layers,
    flow,
  }

  // Only set framework if it's a valid config framework
  if (framework === 'nextjs-app' || framework === 'nextjs-pages' || framework === 'vite-react') {
    config.framework = framework
  }

  return config
}

/**
 * Suggest sublayer flow rules
 */
function suggestSublayerFlow(sublayers: string[]): string[] {
  const rules: string[] = []
  const sublayerSet = new Set(sublayers)

  // Common patterns
  const patterns: Array<[string, string]> = [
    ['features', 'shared'],
    ['features', 'common'],
    ['app', 'features'],
    ['app', 'shared'],
  ]

  for (const [from, to] of patterns) {
    if (sublayerSet.has(from) && sublayerSet.has(to)) {
      rules.push(`${from} -> ${to}`)
    }
  }

  return rules
}
