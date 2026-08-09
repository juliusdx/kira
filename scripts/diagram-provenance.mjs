// Where a diagram came from, and whether it is allowed to leave this machine.
//
// PURE — no filesystem, no git, no process.exit. The CLI that acts on it is
// check-diagrams.mjs, split off for the reason confirm-prod-tests.mjs was:
// a guard whose decision lives behind a conditional in the same file that
// performs the action is a guard that can fail open.
//
// WHY THIS EXISTS
//   KAJI_DECISIONS §3.5 is the strongest rule in that document and was the only
//   one with nothing enforcing it: the traced figures are the publisher's
//   artwork (Tunas Pelangi, Penerbitan Bangi, 嘉阳), and tracing changes the
//   file format rather than who owns the drawing. Fine as a reference for an
//   illustrator and for Julius's own children practising at home; not fine in a
//   product with paying users.
//
//   Meanwhile extract-diagram.py defaulted to writing into
//   `src/content/diagrams/` — the shipping content path, inside a PUBLIC GitHub
//   repo. So the tool's default contradicted the tool's own warning, and the
//   failure mode was not "we shipped it in a bundle" but "we redistributed it
//   from a public URL before the app existed".
//
// THE MODEL
//   traced    — derived from third-party artwork. Reference only. NEVER ships,
//               NEVER gets committed to a public repo.
//   original  — drawn by us. Ships.
//   licensed  — third-party, with permission on file. Ships.
//
//   Anything else, including missing, is treated as `traced`. Fail closed: "I
//   could not tell where this picture came from" must never mean "ship it".

export const PROVENANCE = ['traced', 'original', 'licensed']

/** Only these may be committed or bundled. */
export const SHIPPABLE = new Set(['original', 'licensed'])

/** Paths whose contents end up in the built app. */
export const SHIPPING_DIRS = ['src/', 'public/']

/** Where the trace pipeline puts references. Gitignored; never shipped. */
export const TRACED_DIR = 'traced-refs/'

/**
 * Is this file a content DIAGRAM, as opposed to app chrome?
 *
 * Scoped deliberately. Kira's `public/icon.svg` and `public/favicon.svg` are
 * generated app icons — original work, obviously not from a worksheet — and a
 * guard that demanded a provenance stamp on every SVG in the tree would fail on
 * them the moment it was installed. A guard whose first act is a false positive
 * gets deleted, not fixed.
 *
 * Note the asymmetry in auditDiagrams(): a MISSING stamp only matters inside a
 * diagram location, but a `traced` stamp is caught ANYWHERE, because moving a
 * traced file out of `diagrams/` is precisely how it would launder itself.
 */
export function isDiagramPath(path) {
  const p = path.replace(/^\.\//, '')
  return p.includes('diagrams/') || p.startsWith(TRACED_DIR)
}

/**
 * Read the provenance stamp out of an SVG.
 *
 * Deliberately reads the FILE rather than a sidecar manifest or an item field:
 * a stamp inside the artwork survives being renamed, moved between directories,
 * or copied into another repo, and those are exactly the ways a traced asset
 * would launder itself into a shipping path.
 *
 * Returns null when absent or unrecognised — callers must treat that as traced.
 */
export function readProvenance(svgText) {
  const m = /data-provenance\s*=\s*["']([a-z-]+)["']/i.exec(svgText ?? '')
  if (!m) return null
  const v = m[1].toLowerCase()
  return PROVENANCE.includes(v) ? v : null
}

export function isShippable(provenance) {
  return SHIPPABLE.has(provenance ?? '')
}

function inShippingDir(path) {
  const p = path.replace(/^\.\//, '')
  return SHIPPING_DIRS.some((d) => p.startsWith(d))
}

/**
 * Audit a set of diagram files.
 *
 * @param entries {{path: string, text: string, tracked: boolean}[]}
 *   `tracked` = git knows about this file, i.e. it is published with the repo.
 * @param opts   {{ repoIsPublic?: boolean }}
 * @returns {{path: string, provenance: string|null, reason: string}[]}
 */
export function auditDiagrams(entries, opts = {}) {
  const publicRepo = opts.repoIsPublic !== false
  const out = []

  for (const e of entries) {
    const provenance = readProvenance(e.text)

    if (provenance === null) {
      // Unstamped app chrome is not this guard's business — see isDiagramPath.
      if (!isDiagramPath(e.path)) continue
      out.push({
        path: e.path,
        provenance,
        reason:
          'no data-provenance stamp — treated as traced. Add data-provenance="original" ' +
          '(drawn by us) or "licensed" (permission on file) to the root <g>.',
      })
      continue
    }

    if (isShippable(provenance)) continue

    // provenance === 'traced' from here on.
    if (e.tracked) {
      out.push({
        path: e.path,
        provenance,
        reason: publicRepo
          ? 'TRACED artwork is committed to a PUBLIC repo — that redistributes the ' +
            "publisher's illustration from a public URL. Gitignore it (traced-refs/)."
          : 'TRACED artwork is committed. Keep it out of git; it is a reference, not an asset.',
      })
      continue
    }

    if (inShippingDir(e.path)) {
      out.push({
        path: e.path,
        provenance,
        reason:
          'TRACED artwork sits in a shipping path and would be bundled into the app. ' +
          'Move it to traced-refs/ and redraw what ships (KAJI_DECISIONS §3.5).',
      })
    }
  }

  return out
}

export function formatViolations(violations) {
  if (!violations.length) return 'diagram provenance: clean'
  const lines = violations.map(
    (v) => `  ${v.path}\n      provenance=${v.provenance ?? '<missing>'} — ${v.reason}`,
  )
  return `diagram provenance: ${violations.length} violation(s)\n\n${lines.join('\n\n')}\n`
}
