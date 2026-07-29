import { appendFileSync } from 'node:fs'

// Test support only — never imported by the app.
//
// The integration suites sign in real anonymous users against the production
// project. They delete their own ROWS on the way out, but they cannot delete
// the auth user: that needs the admin API and there is no service_role key on
// this machine. So every run leaves an empty account behind, and until now it
// left it ANONYMOUSLY — nothing recorded which ids were ours.
//
// That is what made cleanup dangerous. Without ids the only way to find the
// litter is by its footprint (anonymous, no data, no class), and a real
// learner who installed the app and has not practised yet has exactly that
// same footprint. Recording the id turns a guess into a lookup.
//
// The file is gitignored (`*.local`) and append-only, so ids survive across
// runs until they are actually cleaned up.

const LEDGER = '.probe-users.local'

/** Overridable so the test for this can write somewhere disposable. */
function ledgerPath(): string {
  return process.env.KIRA_PROBE_LEDGER || LEDGER
}

export function recordProbeUser(id: string, tag: string): void {
  try {
    appendFileSync(ledgerPath(), `${new Date().toISOString()}\t${id}\t${tag}\n`)
  } catch {
    // Never fail a test over bookkeeping — a missing line costs a manual
    // lookup later, a thrown error costs the verification run itself.
  }
}
