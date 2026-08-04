#!/usr/bin/env node
// A hard stop in front of `npm run test:integration`.
//
// Why this is a script and not a sentence in CLAUDE.md: the integration suite
// signs in ~28 real anonymous users against the LIVE Supabase project — the
// one holding Ariel's progress and a real classroom roster — and it cannot
// delete them, because that needs a service_role key and there is none on this
// machine. Cleanup is a hand-run DELETE in the SQL Editor.
//
// ---------------------------------------------------------------------------
// THIS FILE CONTAINS NO CONDITIONAL. That is the entire design, and it is the
// fix for how the first version failed.
//
// v1 wrapped its logic in the usual `if (import.meta.url === ...argv[1])`
// run-as-CLI check so the module could also be imported by its own test. The
// check was false, so the body never ran, the script exited 0, and `&& vitest`
// went straight to production — 28 probe users into Ariel's project. Two
// independent reasons it was false: npm passes argv[1] RELATIVE
// ("scripts/confirm-prod-tests.mjs"), and this repo's path contains a SPACE,
// which import.meta.url percent-encodes to %20 and string concatenation does
// not. Either alone breaks it.
//
// The real defect was not the comparison. It was that the guard FAILED OPEN:
// when its own plumbing broke it allowed the dangerous thing instead of
// blocking it. So there is nothing to get wrong here now — the decision lives
// in prod-test-guard.mjs (pure, importable, testable) and this file exists
// only to act on it, unconditionally, every single time it is executed.
// ---------------------------------------------------------------------------

import { isAllowed, targetRef, refuseMessage, proceedMessage } from './prod-test-guard.mjs'

const target = targetRef()

if (!isAllowed()) {
  process.stderr.write(refuseMessage(target) + '\n')
  process.exit(1)
}

process.stdout.write(proceedMessage(target) + '\n')
