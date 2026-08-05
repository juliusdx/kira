// The decision behind `npm run test:integration`. PURE — no side effects, no
// process.exit, nothing runs on import. The CLI that acts on it is
// confirm-prod-tests.mjs, deliberately a separate file (see the note there).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const OPT_IN = 'KIRA_ALLOW_PROD_TESTS'

/**
 * The live project — Ariel's progress, a real classroom roster, live push
 * subscriptions. Hard-coded on purpose: this is the one value the guard must
 * not read from the same .env it is checking, or pointing .env somewhere else
 * would move the definition of "production" along with it.
 */
export const PROD_REF = 'ccbioktxfpeqaocjkqpr'

/** Opt-in must be deliberate: `1` or `true`, nothing looser. */
export function isAllowed(env = process.env) {
  const v = (env[OPT_IN] ?? '').trim().toLowerCase()
  return v === '1' || v === 'true'
}

/**
 * Does this target require the opt-in?
 *
 * Only production does. Running the suite against a DEV project is ordinary
 * work and should not need a ceremony — a guard that cries wolf on the safe
 * case gets routed around, and then it is not protecting the dangerous one
 * either.
 *
 * An UNKNOWN target counts as production. Fail closed: no .env, an unreadable
 * one, or a URL shape this cannot parse are all cases where the guard does not
 * know what it is about to hit, and "I could not tell" must never mean "go".
 */
export function needsOptIn(target) {
  return !target || target.ref === PROD_REF
}

/**
 * Which Supabase project the suite would actually reach.
 *
 * Read from .env rather than assumed, so that once a separate dev project
 * exists this line is what tells you which one you are pointed at — the guard
 * stops being about "production, obviously" and starts being about "which".
 */
export function targetRef(readEnvFile = defaultReadEnvFile) {
  for (const file of ['.env.local', '.env']) {
    const text = readEnvFile(file)
    if (!text) continue
    const line = text.split('\n').find((l) => l.trim().startsWith('VITE_SUPABASE_URL='))
    if (!line) continue
    const url = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
    const host = url.replace(/^https?:\/\//, '').split('/')[0]
    const ref = host.split('.')[0]
    if (ref) return { ref, file }
  }
  return null
}

function defaultReadEnvFile(name) {
  try {
    // fileURLToPath, never `import.meta.url.replace('file://','')` — this
    // repo's path contains a space, so the URL form is percent-encoded.
    const here = dirname(fileURLToPath(import.meta.url))
    return readFileSync(join(dirname(here), name), 'utf8')
  } catch {
    return null
  }
}

export function refuseMessage(target) {
  const where = target
    ? `project ${target.ref} (from ${target.file})`
    : 'the project configured in .env'
  return `
  REFUSED: npm run test:integration talks to a REAL Supabase project.

  It would hit ${where}.

  There is no staging. That project holds real learner progress, a real
  classroom roster and live push subscriptions. Each run signs in about 28
  anonymous users that the suite CANNOT delete — cleanup is a hand-run
  DELETE by Julius in the SQL Editor. Their ids are appended to
  .probe-users.local so the next sweep is a lookup, not a footprint match.

  If you are exploring this repo, you almost certainly want one of:

    npm test                          hermetic, no network (the CI gate)
    npm run dev -- --mode localonly   the app with Supabase switched off
    ./supabase/tests/run.sh           RLS policies vs throwaway local Postgres

  If you really do mean to test against the live backend:

    ${OPT_IN}=1 npm run test:integration
`
}

export function proceedMessage(target) {
  if (!needsOptIn(target))
    return `  Target is ${target.ref} (from ${target.file}) — not production. Running the integration suite; no opt-in needed.`
  const where = target ? `project ${target.ref}` : 'the project configured in .env'
  return `  ${OPT_IN} set — running the integration suite against LIVE ${where}. Probe user ids will be appended to .probe-users.local.`
}
