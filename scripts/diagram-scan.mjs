// Filesystem and git side of the diagram audit. Kept out of
// diagram-provenance.mjs so the policy stays a pure function that tests can
// feed fixtures to, rather than something that only works against a real tree.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, sep } from 'node:path'

const SKIP = new Set(['node_modules', 'dist', 'dist-ssr', '.git', 'coverage', '.vite'])
const EXT = /\.svg(\.txt)?$/i

export function repoRoot() {
  // fileURLToPath, never string surgery on import.meta.url — this checkout's
  // path contains a space, which the URL form percent-encodes.
  return dirname(dirname(fileURLToPath(import.meta.url)))
}

function walk(dir, root, found = []) {
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return found
  }
  for (const name of names) {
    if (SKIP.has(name)) continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(full, root, found)
    else if (EXT.test(name)) found.push(relative(root, full).split(sep).join('/'))
  }
  return found
}

/** Files git knows about — i.e. files published with the repo. */
function trackedSet(root) {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
    return new Set(out.split('\0').filter(Boolean))
  } catch {
    // No git, or not a repo. Treat everything as tracked: the stricter reading,
    // so an environment we cannot interrogate does not silently pass.
    return null
  }
}

/** @returns {{path: string, text: string, tracked: boolean}[]} */
export function collectDiagrams(root = repoRoot()) {
  const tracked = trackedSet(root)
  return walk(root, root).map((path) => ({
    path,
    text: (() => {
      try {
        return readFileSync(join(root, path), 'utf8')
      } catch {
        return ''
      }
    })(),
    tracked: tracked === null ? true : tracked.has(path),
  }))
}

/**
 * Assume public unless told otherwise. Only the wording of the violation
 * changes — a tracked traced file is a violation either way — so the safe
 * default costs nothing and the harsher message is the correct one for this
 * repo, which IS public.
 */
export function repoIsPublic() {
  return process.env.KIRA_REPO_PRIVATE !== '1'
}
