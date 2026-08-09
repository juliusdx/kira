import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import {
  readProvenance,
  auditDiagrams,
  isDiagramPath,
  isShippable,
} from './diagram-provenance.mjs'
import { collectDiagrams, repoRoot, repoIsPublic } from './diagram-scan.mjs'

// KAJI_DECISIONS §3.5 was the strongest rule in that document and the only one
// with nothing enforcing it. This is the enforcement.
//
// The traced figures are the publisher's artwork; tracing changes the file
// format, not who owns the drawing. And extract-diagram.py defaulted to writing
// into src/content/diagrams/ inside a PUBLIC repo, so the tool's default
// contradicted the tool's own warning.

const traced = '<g data-provenance="traced" fill="currentColor"><path d="M0 0"/></g>'
const original = '<g data-provenance="original" fill="currentColor"><path d="M0 0"/></g>'
const licensed = '<g data-provenance="licensed"><path d="M0 0"/></g>'
const unstamped = '<g fill="currentColor"><path d="M0 0"/></g>'

describe('reading the stamp', () => {
  it('reads each recognised value', () => {
    expect(readProvenance(traced)).toBe('traced')
    expect(readProvenance(original)).toBe('original')
    expect(readProvenance(licensed)).toBe('licensed')
  })

  it('returns null for missing, empty or unrecognised — never guesses', () => {
    expect(readProvenance(unstamped)).toBe(null)
    expect(readProvenance('')).toBe(null)
    expect(readProvenance(undefined)).toBe(null)
    expect(readProvenance('<g data-provenance="probably-fine"/>')).toBe(null)
  })

  it('only original and licensed are shippable', () => {
    expect(isShippable('original')).toBe(true)
    expect(isShippable('licensed')).toBe(true)
    expect(isShippable('traced')).toBe(false)
    expect(isShippable(null)).toBe(false) // fail closed
  })
})

describe('what counts as a diagram', () => {
  it('covers diagram dirs and the traced reference dir', () => {
    expect(isDiagramPath('src/content/diagrams/digestive.svg.txt')).toBe(true)
    expect(isDiagramPath('traced-refs/digestive.svg.txt')).toBe(true)
  })

  it('EXCLUDES app chrome, so the guard does not fail on its own icons', () => {
    // A guard whose first act is a false positive gets deleted, not fixed.
    expect(isDiagramPath('public/icon.svg')).toBe(false)
    expect(isDiagramPath('public/favicon.svg')).toBe(false)
  })
})

describe('the audit', () => {
  it('blocks traced artwork that git tracks — the public-repo case', () => {
    const v = auditDiagrams([{ path: 'traced-refs/x.svg.txt', text: traced, tracked: true }])
    expect(v).toHaveLength(1)
    expect(v[0].reason).toMatch(/PUBLIC repo/)
  })

  it('blocks traced artwork in a shipping path even when untracked', () => {
    // Untracked means git will not publish it, but a build still bundles it.
    const v = auditDiagrams([
      { path: 'src/content/diagrams/x.svg.txt', text: traced, tracked: false },
    ])
    expect(v).toHaveLength(1)
    expect(v[0].reason).toMatch(/shipping path/)
  })

  it('ALLOWS traced artwork that is gitignored and outside src — the whole point', () => {
    // The reference for the illustrator is legitimate and must stay workable.
    expect(
      auditDiagrams([{ path: 'traced-refs/x.svg.txt', text: traced, tracked: false }]),
    ).toEqual([])
  })

  it('catches a traced file moved ANYWHERE, not just in diagram dirs', () => {
    // Renaming out of diagrams/ is exactly how a traced asset would launder
    // itself, so a positive traced stamp is honoured wherever it is found.
    const v = auditDiagrams([{ path: 'src/assets/x.svg', text: traced, tracked: true }])
    expect(v).toHaveLength(1)
  })

  it('treats a MISSING stamp inside a diagram dir as traced', () => {
    const v = auditDiagrams([
      { path: 'src/content/diagrams/x.svg.txt', text: unstamped, tracked: true },
    ])
    expect(v).toHaveLength(1)
    expect(v[0].provenance).toBe(null)
    expect(v[0].reason).toMatch(/no data-provenance stamp/)
  })

  it('passes original and licensed art in a shipping path', () => {
    expect(
      auditDiagrams([
        { path: 'src/content/diagrams/a.svg.txt', text: original, tracked: true },
        { path: 'src/content/diagrams/b.svg.txt', text: licensed, tracked: true },
      ]),
    ).toEqual([])
  })
})

describe('the real working tree', () => {
  // Installed BEFORE the hazard: today there are no diagrams and this passes
  // trivially. It goes red the day traced artwork lands somewhere it must not.
  it('has no provenance violations', () => {
    const entries = collectDiagrams()
    const violations = auditDiagrams(entries, { repoIsPublic: repoIsPublic() })
    expect(
      violations.map((v) => `${v.path}: ${v.reason}`),
      'see KAJI_DECISIONS §3.5',
    ).toEqual([])
  })

  it('does not flag the app icons it can see', () => {
    const paths = collectDiagrams().map((e) => e.path)
    expect(paths).toContain('public/icon.svg')
    expect(paths).toContain('public/favicon.svg')
  })
})

describe('the CLI', () => {
  const run = (args = []) =>
    spawnSync('node', ['scripts/check-diagrams.mjs', ...args], {
      cwd: repoRoot(),
      encoding: 'utf8',
    })

  it('exits 0 on a clean tree and says what it scanned', () => {
    const r = run()
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/scanned \d+ diagram file\(s\)/)
    expect(r.stdout).toMatch(/clean/)
  })
})
