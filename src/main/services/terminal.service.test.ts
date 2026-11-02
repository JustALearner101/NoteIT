import { describe, expect, it } from 'vitest'
import { analyzeTerminalState, stripAnsi } from './terminal.service'

describe('terminal.service', () => {
  describe('stripAnsi', () => {
    it('strips ANSI color escapes cleanly', () => {
      const colored = '\u001b[32mPASS\u001b[39m \u001b[2msrc/index.test.ts\u001b[22m'
      expect(stripAnsi(colored)).toBe('PASS src/index.test.ts')
    })
  })

  describe('analyzeTerminalState', () => {
    it('detects waiting_approval on interactive confirmation prompts', () => {
      const lines = [
        'I am about to edit 3 files in your repository.',
        'Do you want to proceed? [y/n] '
      ]
      expect(analyzeTerminalState(lines)).toBe('waiting_approval')
    })

    it('detects waiting_approval on Claude Code permission prompt', () => {
      const lines = [
        'Claude needs permission to execute bash command.',
        'Allow terminal command? (y/n): '
      ]
      expect(analyzeTerminalState(lines)).toBe('waiting_approval')
    })

    it('detects running_tests on vitest/jest execution', () => {
      const lines = [
        'Running tests with vitest...',
        '✓ src/main/db/client.test.ts (6 tests) 10ms',
        'Test Suites: 1 passed, 1 total'
      ]
      expect(analyzeTerminalState(lines)).toBe('running_tests')
    })

    it('returns idle on empty or whitespace lines', () => {
      expect(analyzeTerminalState([])).toBe('idle')
      expect(analyzeTerminalState(['   ', ''])).toBe('idle')
    })
  })
})
