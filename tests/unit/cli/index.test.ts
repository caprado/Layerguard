/**
 * Tests for CLI entry point
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseArgs, printHelp, printVersion, main, VERSION } from '../../../src/cli/index.js'
import * as check from '../../../src/cli/check.js'
import * as show from '../../../src/cli/show.js'
import * as init from '../../../src/cli/init.js'
import * as watch from '../../../src/cli/watch.js'
import * as report from '../../../src/cli/report.js'

vi.mock('../../../src/cli/check.js')
vi.mock('../../../src/cli/show.js')
vi.mock('../../../src/cli/init.js')
vi.mock('../../../src/cli/watch.js')
vi.mock('../../../src/cli/report.js')

describe('parseArgs', () => {
  describe('commands', () => {
    it('parses check command', () => {
      const result = parseArgs(['check'])
      expect(result.command).toBe('check')
    })

    it('parses show command', () => {
      const result = parseArgs(['show'])
      expect(result.command).toBe('show')
    })

    it('parses init command', () => {
      const result = parseArgs(['init'])
      expect(result.command).toBe('init')
    })

    it('parses report command', () => {
      const result = parseArgs(['report'])
      expect(result.command).toBe('report')
    })

    it('handles no command', () => {
      const result = parseArgs([])
      expect(result.command).toBeUndefined()
    })

    it('handles positional arguments after command', () => {
      const result = parseArgs(['check', 'file1.ts', 'file2.ts'])
      expect(result.command).toBe('check')
      expect(result.positional).toEqual(['file1.ts', 'file2.ts'])
    })
  })

  describe('global flags', () => {
    it('parses --help flag', () => {
      const result = parseArgs(['--help'])
      expect(result.flags.help).toBe(true)
    })

    it('parses -h flag', () => {
      const result = parseArgs(['-h'])
      expect(result.flags.help).toBe(true)
    })

    it('parses --version flag', () => {
      const result = parseArgs(['--version'])
      expect(result.flags.version).toBe(true)
    })

    it('parses -v flag', () => {
      const result = parseArgs(['-v'])
      expect(result.flags.version).toBe(true)
    })
  })

  describe('check flags', () => {
    it('parses --ci flag', () => {
      const result = parseArgs(['check', '--ci'])
      expect(result.flags.ci).toBe(true)
    })

    it('parses --json flag', () => {
      const result = parseArgs(['check', '--json'])
      expect(result.flags.json).toBe(true)
    })

    it('parses --no-color flag', () => {
      const result = parseArgs(['check', '--no-color'])
      expect(result.flags.noColor).toBe(true)
    })

    it('parses --no-colors flag', () => {
      const result = parseArgs(['check', '--no-colors'])
      expect(result.flags.noColor).toBe(true)
    })

    it('parses --type-only flag', () => {
      const result = parseArgs(['check', '--type-only'])
      expect(result.flags.typeOnly).toBe(true)
    })

    it('parses --watch flag', () => {
      const result = parseArgs(['check', '--watch'])
      expect(result.flags.watch).toBe(true)
    })

    it('parses -w flag', () => {
      const result = parseArgs(['check', '-w'])
      expect(result.flags.watch).toBe(true)
    })

    it('parses --no-cache flag', () => {
      const result = parseArgs(['check', '--no-cache'])
      expect(result.flags.noCache).toBe(true)
    })

    it('parses --all flag', () => {
      const result = parseArgs(['check', '--all'])
      expect(result.flags.all).toBe(true)
    })

    it('parses --github-pr-comment flag', () => {
      const result = parseArgs(['check', '--github-pr-comment'])
      expect(result.flags.githubPrComment).toBe(true)
    })

    it('parses --pr-comment flag', () => {
      const result = parseArgs(['check', '--pr-comment'])
      expect(result.flags.githubPrComment).toBe(true)
    })

    it('parses --package with separate value', () => {
      const result = parseArgs(['check', '--package', 'apps/web'])
      expect(result.package).toBe('apps/web')
    })

    it('parses -p with separate value', () => {
      const result = parseArgs(['check', '-p', 'apps/web'])
      expect(result.package).toBe('apps/web')
    })

    it('parses --package= format', () => {
      const result = parseArgs(['check', '--package=apps/web'])
      expect(result.package).toBe('apps/web')
    })

    it('parses --pr-number with separate value', () => {
      const result = parseArgs(['check', '--pr-number', '123'])
      expect(result.prNumber).toBe(123)
    })

    it('parses --pr-number= format', () => {
      const result = parseArgs(['check', '--pr-number=456'])
      expect(result.prNumber).toBe(456)
    })

    it('does not consume flag as package value', () => {
      const result = parseArgs(['check', '--package', '--json'])
      expect(result.package).toBeUndefined()
      expect(result.flags.json).toBe(true)
    })
  })

  describe('show flags', () => {
    it('parses --ascii flag', () => {
      const result = parseArgs(['show', '--ascii'])
      expect(result.flags.ascii).toBe(true)
    })

    it('parses --flow-only flag', () => {
      const result = parseArgs(['show', '--flow-only'])
      expect(result.flags.flowOnly).toBe(true)
    })

    it('parses --flow flag', () => {
      const result = parseArgs(['show', '--flow'])
      expect(result.flags.flowOnly).toBe(true)
    })
  })

  describe('init flags', () => {
    it('parses --yes flag', () => {
      const result = parseArgs(['init', '--yes'])
      expect(result.flags.yes).toBe(true)
    })

    it('parses -y flag', () => {
      const result = parseArgs(['init', '-y'])
      expect(result.flags.yes).toBe(true)
    })
  })

  describe('report flags', () => {
    it('parses --output with separate value', () => {
      const result = parseArgs(['report', '--output', 'report.html'])
      expect(result.output).toBe('report.html')
    })

    it('parses -o with separate value', () => {
      const result = parseArgs(['report', '-o', 'report.html'])
      expect(result.output).toBe('report.html')
    })

    it('parses --output= format', () => {
      const result = parseArgs(['report', '--output=report.html'])
      expect(result.output).toBe('report.html')
    })

    it('parses --markdown flag', () => {
      const result = parseArgs(['report', '--markdown'])
      expect(result.flags.markdown).toBe(true)
    })

    it('parses --md flag', () => {
      const result = parseArgs(['report', '--md'])
      expect(result.flags.markdown).toBe(true)
    })

    it('parses --stdout flag', () => {
      const result = parseArgs(['report', '--stdout'])
      expect(result.flags.stdout).toBe(true)
    })

    it('parses --from with separate value', () => {
      const result = parseArgs(['report', '--from', 'history.json'])
      expect(result.from).toBe('history.json')
    })

    it('parses --from= format', () => {
      const result = parseArgs(['report', '--from=history.json'])
      expect(result.from).toBe('history.json')
    })

    it('parses --title with separate value', () => {
      const result = parseArgs(['report', '--title', 'My Report'])
      expect(result.title).toBe('My Report')
    })

    it('parses --title= format', () => {
      const result = parseArgs(['report', '--title=My Report'])
      expect(result.title).toBe('My Report')
    })
  })

  describe('combined flags', () => {
    it('parses multiple flags together', () => {
      const result = parseArgs(['check', '--ci', '--no-cache', '--package', 'apps/web'])
      expect(result.command).toBe('check')
      expect(result.flags.ci).toBe(true)
      expect(result.flags.noCache).toBe(true)
      expect(result.package).toBe('apps/web')
    })

    it('handles flags before command', () => {
      const result = parseArgs(['--no-color', 'check'])
      expect(result.command).toBe('check')
      expect(result.flags.noColor).toBe(true)
    })
  })
})

describe('printHelp', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prints help message', () => {
    printHelp()
    expect(console.log).toHaveBeenCalled()
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    expect(output).toContain('archgate')
    expect(output).toContain('Usage:')
    expect(output).toContain('Commands:')
  })

  it('includes version in help', () => {
    printHelp()
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    expect(output).toContain(VERSION)
  })

  it('documents all commands', () => {
    printHelp()
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    expect(output).toContain('check')
    expect(output).toContain('show')
    expect(output).toContain('init')
    expect(output).toContain('report')
  })
})

describe('printVersion', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prints version', () => {
    printVersion()
    expect(console.log).toHaveBeenCalledWith(`archgate v${VERSION}`)
  })
})

describe('main', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    vi.mocked(check.runCheck).mockResolvedValue({
      passed: true,
      exitCode: 0,
      errorCount: 0,
      warningCount: 0,
      violations: [],
    })
    vi.mocked(show.runShow).mockResolvedValue()
    vi.mocked(init.runInit).mockResolvedValue()
    vi.mocked(report.runReport).mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prints version with --version flag', async () => {
    await main(['--version'])
    expect(console.log).toHaveBeenCalledWith(`archgate v${VERSION}`)
  })

  it('prints help with --help flag', async () => {
    await main(['--help'])
    expect(console.log).toHaveBeenCalled()
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    expect(output).toContain('Usage:')
  })

  it('prints help with no command', async () => {
    await main([])
    expect(console.log).toHaveBeenCalled()
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    expect(output).toContain('Usage:')
  })

  it('runs check command', async () => {
    await main(['check'])
    expect(check.runCheck).toHaveBeenCalled()
    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it('runs check with --json format', async () => {
    await main(['check', '--json'])
    expect(check.runCheck).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'json' })
    )
  })

  it('runs check with --ci format', async () => {
    await main(['check', '--ci'])
    expect(check.runCheck).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'ci' })
    )
  })

  it('runs check with --watch flag', async () => {
    vi.mocked(watch.runWatch).mockResolvedValue()
    await main(['check', '--watch'])
    expect(watch.runWatch).toHaveBeenCalled()
  })

  it('runs check with --package option', async () => {
    await main(['check', '--package', 'apps/web'])
    expect(check.runCheck).toHaveBeenCalledWith(
      expect.objectContaining({ package: 'apps/web' })
    )
  })

  it('runs check with --all option', async () => {
    await main(['check', '--all'])
    expect(check.runCheck).toHaveBeenCalledWith(
      expect.objectContaining({ all: true })
    )
  })

  it('runs show command', async () => {
    await main(['show'])
    expect(show.runShow).toHaveBeenCalled()
  })

  it('runs show with --ascii option', async () => {
    await main(['show', '--ascii'])
    expect(show.runShow).toHaveBeenCalledWith(
      expect.objectContaining({ ascii: true })
    )
  })

  it('runs show with --flow-only option', async () => {
    await main(['show', '--flow-only'])
    expect(show.runShow).toHaveBeenCalledWith(
      expect.objectContaining({ flowOnly: true })
    )
  })

  it('runs init command', async () => {
    await main(['init'])
    expect(init.runInit).toHaveBeenCalled()
  })

  it('runs init with --yes option', async () => {
    await main(['init', '--yes'])
    expect(init.runInit).toHaveBeenCalledWith(
      expect.objectContaining({ yes: true })
    )
  })

  it('runs report command', async () => {
    await main(['report'])
    expect(report.runReport).toHaveBeenCalled()
    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it('runs report with --output option', async () => {
    await main(['report', '--output', 'custom.html'])
    expect(report.runReport).toHaveBeenCalledWith(
      expect.objectContaining({ output: 'custom.html' })
    )
  })

  it('runs report with --markdown option', async () => {
    await main(['report', '--markdown'])
    expect(report.runReport).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'markdown' })
    )
  })

  it('runs report with --stdout option', async () => {
    await main(['report', '--stdout'])
    expect(report.runReport).toHaveBeenCalledWith(
      expect.objectContaining({ stdout: true })
    )
  })

  it('exits with 1 for unknown command', async () => {
    await main(['unknown'])
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unknown command'))
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('exits with check exit code on failure', async () => {
    vi.mocked(check.runCheck).mockResolvedValue({
      passed: false,
      exitCode: 1,
      errorCount: 5,
      warningCount: 0,
      violations: [],
    })
    await main(['check'])
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('exits with 1 when report fails', async () => {
    vi.mocked(report.runReport).mockResolvedValue({ success: false, error: 'Failed' })
    await main(['report'])
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})

describe('VERSION', () => {
  it('exports version string', () => {
    expect(VERSION).toBe('0.1.0')
  })
})
