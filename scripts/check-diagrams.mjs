#!/usr/bin/env node
// Audit every diagram in the working tree for provenance.
//
// NO CONDITIONAL. This file exists only to act on the decision in
// diagram-provenance.mjs, unconditionally, every time it runs — the same shape
// confirm-prod-tests.mjs was rebuilt into after its run-as-CLI check evaluated
// false and let the guard fail open.
//
//   node scripts/check-diagrams.mjs
//
// Exits 1 on any violation. The same audit runs inside `npm test`
// (diagram-provenance.test.mjs), so CI catches it without needing this wired
// into the build separately.

import { auditDiagrams, formatViolations } from './diagram-provenance.mjs'
import { collectDiagrams, repoIsPublic } from './diagram-scan.mjs'

const entries = collectDiagrams()
const violations = auditDiagrams(entries, { repoIsPublic: repoIsPublic() })

process.stdout.write(
  `scanned ${entries.length} diagram file(s)\n${formatViolations(violations)}\n`,
)
if (violations.length) process.exit(1)
