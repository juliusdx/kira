#!/usr/bin/env bash
# Verify the RLS policies in supabase/migrations/ against a throwaway local
# Postgres, as an unprivileged role — so a policy hole is caught here rather
# than after the migration is pasted into the live SQL Editor.
#
#   ./supabase/tests/run.sh
#
# Requires a local postgres (brew install postgresql@16) — nothing else, and it
# never touches the live project.
set -euo pipefail

export LC_ALL=C   # PG16 on macOS refuses to start without a pinned locale
for p in /opt/homebrew/opt/postgresql@16/bin /opt/homebrew/bin; do
  [ -d "$p" ] && export PATH="$p:$PATH"
done

DB=kira_rls_test
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="$HERE/../migrations"

pg_isready -q || {
  echo "starting local postgres..."
  pg_ctl -D /opt/homebrew/var/postgresql@16 -l /tmp/kira-pg.log start
  sleep 3
}

dropdb --if-exists "$DB"
createdb "$DB"

psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/harness.sql"          > /dev/null
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG/0001_init.sql"         > /dev/null 2>&1
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG/0002_classes.sql"      > /dev/null 2>&1
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG/0003_leaderboard.sql"  > /dev/null 2>&1
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG/0004_push_reminders.sql" > /dev/null 2>&1

OUT=$(psql -q -d "$DB" -f "$HERE/rls_test.sql" 2>&1)

# leaderboard suite runs on its own database — its fixtures assume a clean slate
LB_DB="${DB}_lb"
dropdb --if-exists "$LB_DB"; createdb "$LB_DB"
for f in "$HERE/harness.sql" "$MIG/0001_init.sql" "$MIG/0002_classes.sql" "$MIG/0003_leaderboard.sql"; do
  psql -q -d "$LB_DB" -v ON_ERROR_STOP=1 -f "$f" > /dev/null 2>&1
done
LB=$(psql -qAt -d "$LB_DB" -f "$HERE/leaderboard_test.sql" 2>&1)
LB_FALSE=$(echo "$LB" | tr '|' '\n' | grep -cx 'f' || true)
LB_TRUE=$(echo "$LB" | tr '|' '\n' | grep -cx 't' || true)
LB_ERR=$(echo "$LB" | grep -cE 'FAIL_|ERROR' || true)
echo "--- leaderboard: $LB_TRUE assertions true, $LB_FALSE false, $LB_ERR errors"
dropdb --if-exists "$LB_DB"
if [ "$LB_FALSE" -gt 0 ] || [ "$LB_ERR" -gt 0 ]; then
  echo "$LB" | grep -E "FAIL_|ERROR"
  echo "✗ LEADERBOARD TESTS FAILED"
  dropdb --if-exists "$DB"
  exit 1
fi
echo "$OUT" | grep -E "PASS|FAIL|ERROR|^---|^====" || true

# push suite, also on its own database
PU_DB="${DB}_push"
dropdb --if-exists "$PU_DB"; createdb "$PU_DB"
psql -q -d "$PU_DB" -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end \$\$;" > /dev/null 2>&1
for f in "$HERE/harness.sql" "$MIG/0001_init.sql" "$MIG/0002_classes.sql" "$MIG/0003_leaderboard.sql" "$MIG/0004_push_reminders.sql"; do
  psql -q -d "$PU_DB" -v ON_ERROR_STOP=1 -f "$f" > /dev/null 2>&1
done
PU=$(psql -qAt -d "$PU_DB" -f "$HERE/push_test.sql" 2>&1)
PU_FALSE=$(echo "$PU" | tr '|' '\n' | grep -cx 'f' || true)
PU_TRUE=$(echo "$PU" | tr '|' '\n' | grep -cx 't' || true)
PU_ERR=$(echo "$PU" | grep -cE 'FAIL_|ERROR' || true)
echo "--- push reminders: $PU_TRUE assertions true, $PU_FALSE false, $PU_ERR errors"
dropdb --if-exists "$PU_DB"
if [ "$PU_FALSE" -gt 0 ] || [ "$PU_ERR" -gt 0 ]; then
  echo "$PU" | grep -E "FAIL_|ERROR"
  echo "✗ PUSH TESTS FAILED"
  dropdb --if-exists "$DB"
  exit 1
fi

# roster roll-up suite, also on its own database
RO_DB="${DB}_roster"
dropdb --if-exists "$RO_DB"; createdb "$RO_DB"
for f in "$HERE/harness.sql" "$MIG/0001_init.sql" "$MIG/0002_classes.sql" \
         "$MIG/0003_leaderboard.sql" "$MIG/0004_push_reminders.sql" \
         "$MIG/0005_roster_rollup.sql" "$MIG/0006_avatars.sql"; do
  psql -q -d "$RO_DB" -v ON_ERROR_STOP=1 -f "$f" > /dev/null 2>&1
done
RO=$(psql -qAt -d "$RO_DB" -f "$HERE/roster_test.sql" 2>&1)
RO_FALSE=$(echo "$RO" | tr '|' '\n' | grep -cx 'f' || true)
RO_TRUE=$(echo "$RO" | tr '|' '\n' | grep -cx 't' || true)
RO_ERR=$(echo "$RO" | grep -cE 'FAIL_|ERROR' || true)
echo "--- roster roll-up: $RO_TRUE assertions true, $RO_FALSE false, $RO_ERR errors"
dropdb --if-exists "$RO_DB"
if [ "$RO_FALSE" -gt 0 ] || [ "$RO_ERR" -gt 0 ]; then
  echo "$RO" | grep -E "FAIL_|ERROR"
  echo "✗ ROSTER TESTS FAILED"
  dropdb --if-exists "$DB"
  exit 1
fi

# avatar suite, also on its own database
AV_DB="${DB}_avatar"
dropdb --if-exists "$AV_DB"; createdb "$AV_DB"
for f in "$HERE/harness.sql" "$MIG/0001_init.sql" "$MIG/0002_classes.sql" \
         "$MIG/0003_leaderboard.sql" "$MIG/0004_push_reminders.sql" \
         "$MIG/0005_roster_rollup.sql" "$MIG/0006_avatars.sql"; do
  psql -q -d "$AV_DB" -v ON_ERROR_STOP=1 -f "$f" > /dev/null 2>&1
done
AV=$(psql -qAt -d "$AV_DB" -f "$HERE/avatar_test.sql" 2>&1)
AV_FALSE=$(echo "$AV" | tr '|' '\n' | grep -cx 'f' || true)
AV_TRUE=$(echo "$AV" | tr '|' '\n' | grep -cx 't' || true)
AV_ERR=$(echo "$AV" | grep -cE 'FAIL_|ERROR' || true)
echo "--- avatars: $AV_TRUE assertions true, $AV_FALSE false, $AV_ERR errors"
dropdb --if-exists "$AV_DB"
if [ "$AV_FALSE" -gt 0 ] || [ "$AV_ERR" -gt 0 ]; then
  echo "$AV" | grep -E "FAIL_|ERROR"
  echo "✗ AVATAR TESTS FAILED"
  dropdb --if-exists "$DB"
  exit 1
fi

# last-wrong-answer suite (0007), also on its own database
LW_DB="${DB}_lastwrong"
dropdb --if-exists "$LW_DB"; createdb "$LW_DB"
for f in "$HERE/harness.sql" "$MIG/0001_init.sql" "$MIG/0002_classes.sql" \
         "$MIG/0003_leaderboard.sql" "$MIG/0004_push_reminders.sql" \
         "$MIG/0005_roster_rollup.sql" "$MIG/0006_avatars.sql" \
         "$MIG/0007_last_wrong_answer.sql"; do
  psql -q -d "$LW_DB" -v ON_ERROR_STOP=1 -f "$f" > /dev/null 2>&1
done
LW=$(psql -qAt -d "$LW_DB" -f "$HERE/last_wrong_test.sql" 2>&1)
LW_FALSE=$(echo "$LW" | tr '|' '\n' | grep -cx 'f' || true)
LW_TRUE=$(echo "$LW" | tr '|' '\n' | grep -cx 't' || true)
# every negative case must have been BLOCKED; a missing "blocked_" line means
# the guard let it through without raising, which grep -c 'f' cannot see.
LW_BLOCKED=$(echo "$LW" | grep -c 'blocked_' || true)
LW_ERR=$(echo "$LW" | grep -cE 'FAIL_|ERROR' || true)
echo "--- last wrong answer: $LW_TRUE assertions true, $LW_FALSE false, $LW_BLOCKED blocked, $LW_ERR errors"
dropdb --if-exists "$LW_DB"
if [ "$LW_FALSE" -gt 0 ] || [ "$LW_ERR" -gt 0 ] || [ "$LW_BLOCKED" -lt 5 ]; then
  echo "$LW" | grep -E "FAIL_|ERROR"
  echo "✗ LAST WRONG ANSWER TESTS FAILED"
  dropdb --if-exists "$DB"
  exit 1
fi

# item-notes suite (0008), also on its own database. Unlike 0005/0007 this is
# plain RLS with no SECURITY DEFINER function, so the policy is the whole
# boundary and the negative cases are all "the row exists and stays invisible".
IN_DB="${DB}_itemnotes"
dropdb --if-exists "$IN_DB"; createdb "$IN_DB"
for f in "$HERE/harness.sql" "$MIG/0001_init.sql" "$MIG/0002_classes.sql" \
         "$MIG/0003_leaderboard.sql" "$MIG/0004_push_reminders.sql" \
         "$MIG/0005_roster_rollup.sql" "$MIG/0006_avatars.sql" \
         "$MIG/0007_last_wrong_answer.sql" "$MIG/0008_item_notes.sql"; do
  psql -q -d "$IN_DB" -v ON_ERROR_STOP=1 -f "$f" > /dev/null 2>&1
done
IN=$(psql -qAt -d "$IN_DB" -f "$HERE/item_notes_test.sql" 2>&1)
IN_FALSE=$(echo "$IN" | tr '|' '\n' | grep -cx 'f' || true)
IN_TRUE=$(echo "$IN" | tr '|' '\n' | grep -cx 't' || true)
# a refused write raises, and a missing "blocked_" line means it did NOT —
# which grep -c 'f' cannot see, because no row is returned either way.
IN_BLOCKED=$(echo "$IN" | grep -c 'blocked_' || true)
IN_ERR=$(echo "$IN" | grep -cE 'FAIL_|ERROR' || true)
echo "--- item notes: $IN_TRUE assertions true, $IN_FALSE false, $IN_BLOCKED blocked, $IN_ERR errors"
dropdb --if-exists "$IN_DB"
if [ "$IN_FALSE" -gt 0 ] || [ "$IN_ERR" -gt 0 ] || [ "$IN_BLOCKED" -lt 4 ]; then
  echo "$IN" | grep -E "FAIL_|ERROR"
  echo "✗ ITEM NOTES TESTS FAILED"
  dropdb --if-exists "$DB"
  exit 1
fi

# probe-cleanup suite — guards a DESTRUCTIVE hand-run script, so it is tested
# like a migration. Its own database: it deletes auth.users rows.
CU_DB="${DB}_cleanup"
dropdb --if-exists "$CU_DB"; createdb "$CU_DB"
for f in "$HERE/harness.sql" "$MIG/0001_init.sql" "$MIG/0002_classes.sql" \
         "$MIG/0003_leaderboard.sql" "$MIG/0004_push_reminders.sql" \
         "$MIG/0005_roster_rollup.sql" "$MIG/0006_avatars.sql" \
         "$MIG/0007_last_wrong_answer.sql" "$MIG/0008_item_notes.sql"; do
  psql -q -d "$CU_DB" -v ON_ERROR_STOP=1 -f "$f" > /dev/null 2>&1
done
CU=$(psql -qAt -d "$CU_DB" -f "$HERE/cleanup_test.sql" 2>&1)
CU_FALSE=$(echo "$CU" | tr '|' '\n' | grep -cx 'f' || true)
CU_TRUE=$(echo "$CU" | tr '|' '\n' | grep -cx 't' || true)
CU_ERR=$(echo "$CU" | grep -cE 'FAIL_|ERROR' || true)
echo "--- probe cleanup: $CU_TRUE assertions true, $CU_FALSE false, $CU_ERR errors"
dropdb --if-exists "$CU_DB"
if [ "$CU_FALSE" -gt 0 ] || [ "$CU_ERR" -gt 0 ]; then
  echo "$CU" | grep -E "FAIL_|ERROR|^f$"
  echo "✗ PROBE CLEANUP TESTS FAILED"
  dropdb --if-exists "$DB"
  exit 1
fi

FAILS=$(echo "$OUT" | grep -c "FAIL" || true)
ERRS=$(echo "$OUT"  | grep -c "^psql.*ERROR" || true)
PASSES=$(echo "$OUT" | grep -c "PASS" || true)

echo ""
if [ "$FAILS" -gt 0 ] || [ "$ERRS" -gt 0 ]; then
  echo "✗ RLS TESTS FAILED  ($PASSES passed, $FAILS failed, $ERRS errors)"
  dropdb --if-exists "$DB"
  exit 1
fi
echo "✓ all $PASSES RLS checks passed"
dropdb --if-exists "$DB"
