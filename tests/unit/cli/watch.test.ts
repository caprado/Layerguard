/**
 * Tests for CLI watch command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { LayerguardConfig } from '../../../src/config/types.js'

vi.mock('node:fs', () => ({
  watch: vi.fn(() => ({
    close: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    ref: vi.fn().mockReturnThis(),
    unref: vi.fn().mockReturnThis(),
  })),
}))

vi.mock('../../../src/config/loader.js')
vi.mock('../../../src/cli/check.js')

import { startWatch } from '../../../src/cli/watch.js'
import * as loader from '../../../src/config/loader.js'
import * as check from '../../../src/cli/check.js'
import { watch } from 'node:fs'

describe('startWatch', () => {
  const mockConfig: LayerguardConfig = {
    layers: {
      components: { path: 'src/components' },
      hooks: { path: 'src/hooks' },
    },
    flow: ['components -> hooks'],
  }

  const mockCheckResult = {
    passed: true,
    exitCode: 0,
    errorCount: 0,
    warningCount: 0,
    violations: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: 'layerguard.config.ts',
    })

    vi.mocked(check.runCheck).mockResolvedValue(mockCheckResult)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should start watching and run initial check', async () => {
    const handle = await startWatch()

    expect(check.runCheck).toHaveBeenCalledTimes(1)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Watch mode started'))

    handle.stop()
  })

  it('should create watchers for layer paths', async () => {
    const handle = await startWatch()

    expect(watch).toHaveBeenCalled()

    handle.stop()
  })

  it('should expose runCheck method on handle', async () => {
    const handle = await startWatch()

    const result = await handle.runCheck()

    expect(result.passed).toBe(true)
    expect(check.runCheck).toHaveBeenCalledTimes(2) // Initial + manual

    handle.stop()
  })

  it('should call onCheck callback after check completes', async () => {
    const onCheck = vi.fn()

    const handle = await startWatch({ onCheck })

    expect(onCheck).toHaveBeenCalledWith(mockCheckResult)

    handle.stop()
  })

  it('should respect noColors option', async () => {
    const handle = await startWatch({ noColors: true })

    expect(check.runCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        noColors: true,
      })
    )

    handle.stop()
  })

  it('should respect typeOnlyImports option', async () => {
    const handle = await startWatch({ typeOnlyImports: true })

    expect(check.runCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        typeOnlyImports: true,
      })
    )

    handle.stop()
  })

  it('should handle watch errors gracefully', async () => {
    vi.mocked(watch).mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file or directory')
    })

    const handle = await startWatch()

    expect(check.runCheck).toHaveBeenCalled()

    handle.stop()
  })

  it('should debounce file changes', async () => {
    let changeCallback: ((eventType: string, filename: string | null) => void) | undefined
    vi.mocked(watch).mockImplementation(((_path: unknown, _options: unknown, callback: unknown) => {
      changeCallback = callback as (eventType: string, filename: string | null) => void
      return {
        close: vi.fn(),
      } as unknown as ReturnType<typeof watch>
    }) as typeof watch)

    const handle = await startWatch({ debounce: 300 })
    vi.mocked(check.runCheck).mockClear()

    if (changeCallback) {
      changeCallback('change', 'file1.ts')
      changeCallback('change', 'file2.ts')
      changeCallback('change', 'file3.ts')
    }

    await vi.advanceTimersByTimeAsync(400)

    expect(check.runCheck).toHaveBeenCalledTimes(1)

    handle.stop()
  })

  it('should ignore non-TypeScript files', async () => {
    let changeCallback: ((eventType: string, filename: string | null) => void) | undefined
    vi.mocked(watch).mockImplementation(((_path: unknown, _options: unknown, callback: unknown) => {
      changeCallback = callback as (eventType: string, filename: string | null) => void
      return { close: vi.fn() } as unknown as ReturnType<typeof watch>
    }) as typeof watch)

    const handle = await startWatch({ debounce: 100 })
    vi.mocked(check.runCheck).mockClear()

    if (changeCallback) {
      changeCallback('change', 'styles.css')
    }

    await vi.advanceTimersByTimeAsync(200)

    expect(check.runCheck).not.toHaveBeenCalled()

    handle.stop()
  })

  it('should ignore node_modules changes', async () => {
    let changeCallback: ((eventType: string, filename: string | null) => void) | undefined
    vi.mocked(watch).mockImplementation(((_path: unknown, _options: unknown, callback: unknown) => {
      changeCallback = callback as (eventType: string, filename: string | null) => void
      return { close: vi.fn() } as unknown as ReturnType<typeof watch>
    }) as typeof watch)

    const handle = await startWatch({ debounce: 100 })
    vi.mocked(check.runCheck).mockClear()

    if (changeCallback) {
      changeCallback('change', 'node_modules/lodash/index.ts')
    }

    await vi.advanceTimersByTimeAsync(200)

    expect(check.runCheck).not.toHaveBeenCalled()

    handle.stop()
  })

  it('should handle null filename gracefully', async () => {
    let changeCallback: ((eventType: string, filename: string | null) => void) | undefined
    vi.mocked(watch).mockImplementation(((_path: unknown, _options: unknown, callback: unknown) => {
      changeCallback = callback as (eventType: string, filename: string | null) => void
      return { close: vi.fn() } as unknown as ReturnType<typeof watch>
    }) as typeof watch)

    const handle = await startWatch({ debounce: 100 })
    vi.mocked(check.runCheck).mockClear()

    if (changeCallback) {
      changeCallback('change', null)
    }

    await vi.advanceTimersByTimeAsync(200)

    expect(check.runCheck).not.toHaveBeenCalled()

    handle.stop()
  })
})
