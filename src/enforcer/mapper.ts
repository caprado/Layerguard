/**
 * File-to-layer mapper
 *
 * Maps file paths to their corresponding layers and sublayers
 */

import type { LayerguardConfig, LayerConfig, SublayerConfig } from '../config/types.js'

/**
 * Result of mapping a file to a layer
 */
export interface LayerMapping {
  /**
   * The layer this file belongs to
   */
  layer: string

  /**
   * The sublayer this file belongs to, if any
   */
  sublayer?: string

  /**
   * The feature name within an isolated sublayer, if applicable
   */
  feature?: string

  /**
   * Whether this sublayer is isolated
   */
  isIsolated: boolean

  /**
   * The layer configuration
   */
  layerConfig: LayerConfig

  /**
   * The sublayer configuration, if applicable
   */
  sublayerConfig?: SublayerConfig
}

/**
 * Processed layer info for efficient matching
 */
interface ProcessedLayer {
  name: string
  path: string
  normalizedPath: string
  config: LayerConfig
  sublayers: ProcessedSublayer[]
}

/**
 * Processed sublayer info
 */
interface ProcessedSublayer {
  name: string
  path: string
  normalizedPath: string
  config: SublayerConfig
  isolated: boolean
}

/**
 * Layer mapper instance
 */
export class LayerMapper {
  private layers: ProcessedLayer[] = []

  constructor(config: LayerguardConfig) {
    this.processConfig(config)
  }

  /**
   * Process the config into an efficient structure for matching
   */
  private processConfig(config: LayerguardConfig): void {
    for (const [layerName, layerConfig] of Object.entries(config.layers)) {
      const processedLayer: ProcessedLayer = {
        name: layerName,
        path: layerConfig.path,
        normalizedPath: this.normalizePath(layerConfig.path),
        config: layerConfig,
        sublayers: [],
      }

      // Process sublayers
      if (layerConfig.sublayers) {
        for (const [sublayerName, sublayerConfig] of Object.entries(layerConfig.sublayers)) {
          processedLayer.sublayers.push({
            name: sublayerName,
            path: sublayerConfig.path,
            normalizedPath: this.normalizePath(sublayerConfig.path),
            config: sublayerConfig,
            isolated: sublayerConfig.isolated ?? false,
          })
        }

        // Sort sublayers by path length (longest first) for most-specific matching
        processedLayer.sublayers.sort((a, b) => b.normalizedPath.length - a.normalizedPath.length)
      }

      this.layers.push(processedLayer)
    }

    // Sort layers by path length (longest first) for most-specific matching
    this.layers.sort((a, b) => b.normalizedPath.length - a.normalizedPath.length)
  }

  /**
   * Normalize a path for comparison
   */
  private normalizePath(path: string): string {
    // Remove leading/trailing slashes, normalize to forward slashes
    return path
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .toLowerCase()
  }

  /**
   * Check if a file path starts with a layer/sublayer path
   */
  private pathMatches(filePath: string, layerPath: string): boolean {
    const normalizedFile = this.normalizePath(filePath)
    const normalizedLayer = layerPath

    // File path must start with layer path
    if (!normalizedFile.startsWith(normalizedLayer)) {
      return false
    }

    // If file path is longer, the next character must be a separator
    if (normalizedFile.length > normalizedLayer.length) {
      const nextChar = normalizedFile[normalizedLayer.length]
      return nextChar === '/'
    }

    // Exact match
    return true
  }

  /**
   * Extract the feature name from a file path within an isolated sublayer
   *
   * For a path like `components/features/calendar/CalendarView.tsx`
   * with sublayer path `components/features`, the feature is `calendar`
   */
  private extractFeature(filePath: string, sublayerPath: string): string | undefined {
    const normalizedFile = this.normalizePath(filePath)
    const normalizedSublayer = sublayerPath

    // Get the portion after the sublayer path
    if (!normalizedFile.startsWith(normalizedSublayer + '/')) {
      return undefined
    }

    const remainder = normalizedFile.slice(normalizedSublayer.length + 1)
    const firstSlash = remainder.indexOf('/')

    if (firstSlash === -1) {
      // File is directly in the sublayer, no feature
      return undefined
    }

    // Feature is the first directory segment after the sublayer
    return remainder.slice(0, firstSlash)
  }

  /**
   * Map a file path to its layer and sublayer
   *
   * @param filePath - Relative path from project root
   * @returns Layer mapping or null if file doesn't match any layer
   */
  map(filePath: string): LayerMapping | null {
    // Try to find a matching layer (most specific first due to sorting)
    for (const layer of this.layers) {
      if (!this.pathMatches(filePath, layer.normalizedPath)) {
        continue
      }

      // Found a matching layer, now check sublayers
      for (const sublayer of layer.sublayers) {
        if (this.pathMatches(filePath, sublayer.normalizedPath)) {
          // Found a matching sublayer
          const mapping: LayerMapping = {
            layer: layer.name,
            sublayer: sublayer.name,
            isIsolated: sublayer.isolated,
            layerConfig: layer.config,
            sublayerConfig: sublayer.config,
          }

          // Add feature if sublayer is isolated and feature can be extracted
          if (sublayer.isolated) {
            const feature = this.extractFeature(filePath, sublayer.normalizedPath)
            if (feature) {
              mapping.feature = feature
            }
          }

          return mapping
        }
      }

      // File is in layer but not in any sublayer
      return {
        layer: layer.name,
        isIsolated: false,
        layerConfig: layer.config,
      }
    }

    // No matching layer found
    return null
  }

  /**
   * Map multiple files
   */
  mapAll(filePaths: string[]): Map<string, LayerMapping | null> {
    const results = new Map<string, LayerMapping | null>()
    for (const filePath of filePaths) {
      results.set(filePath, this.map(filePath))
    }
    return results
  }

  /**
   * Get all layer names
   */
  getLayerNames(): string[] {
    return this.layers.map((l) => l.name)
  }

  /**
   * Get sublayer names for a layer
   */
  getSublayerNames(layerName: string): string[] {
    const layer = this.layers.find((l) => l.name === layerName)
    return layer?.sublayers.map((s) => s.name) ?? []
  }
}

/**
 * Create a layer mapper from config
 */
export function createLayerMapper(config: LayerguardConfig): LayerMapper {
  return new LayerMapper(config)
}
