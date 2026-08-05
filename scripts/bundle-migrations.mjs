#!/usr/bin/env node
// Writes the bootstrap bundle. Unconditional — this file exists only to act,
// so there is no run-as-CLI branch that can evaluate wrong (the mistake that
// made scripts/confirm-prod-tests.mjs fail open on 2026-08-04).
//
// The bundle itself is built by migration-bundle.mjs, which is pure.

import { writeFileSync } from 'node:fs'
import { buildBundle, migrationFiles, OUTPUT } from './migration-bundle.mjs'

writeFileSync(OUTPUT, buildBundle())
console.log(`wrote ${OUTPUT} from ${migrationFiles().length} migrations`)
