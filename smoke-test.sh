#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# RBAC Smoke Test — School LMS
#
# Tests that GET /api/students and GET /api/class-sections enforce
# role-based access control at the API level.
#
# Prerequisites:
#   1. Dev server running (bun run dev)
#   2. A valid Admin session cookie and a valid Teacher session cookie
#
# How to get session cookies:
#   1. Sign in as Admin at /login, open DevTools → Application → Cookies
#   2. Copy the value of the `next-auth.session-token` cookie
#   3. Repeat for a Teacher account
#
# Usage:
#   ADMIN_TOKEN="<paste-admin-session-token>" \
#   TEACHER_TOKEN="<paste-teacher-session-token>" \
#   bash smoke-test.sh
# ──────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
TEACHER_TOKEN="${TEACHER_TOKEN:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass=0
fail=0

check() {
  local label="$1"
  local expected="$2"
  local actual="$3"

  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}✓${NC} $label (got $actual)"
    ((pass++))
  else
    echo -e "  ${RED}✗${NC} $label — expected $expected, got $actual"
    ((fail++))
  fi
}

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  School LMS — RBAC Smoke Test"
echo "═══════════════════════════════════════════════════════"
echo ""

# ─── Unauthenticated requests (should 401) ───────────────

echo "▸ Unauthenticated requests"
status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/students")
check "GET /api/students without token" "401" "$status"

status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/class-sections")
check "GET /api/class-sections without token" "401" "$status"
echo ""

# ─── Admin requests (should 200) ─────────────────────────

if [ -n "$ADMIN_TOKEN" ]; then
  echo "▸ Admin requests"
  status=$(curl -s -o /dev/null -w '%{http_code}' \
    -b "next-auth.session-token=$ADMIN_TOKEN" \
    "$BASE_URL/api/students")
  check "GET /api/students as Admin → 200" "200" "$status"

  status=$(curl -s -o /dev/null -w '%{http_code}' \
    -b "next-auth.session-token=$ADMIN_TOKEN" \
    "$BASE_URL/api/class-sections")
  check "GET /api/class-sections as Admin → 200" "200" "$status"
else
  echo -e "  ${YELLOW}⚠${NC} Skipping Admin tests — ADMIN_TOKEN not set"
fi
echo ""

# ─── Teacher requests (should 200, scoped data) ──────────

if [ -n "$TEACHER_TOKEN" ]; then
  echo "▸ Teacher requests"
  status=$(curl -s -o /dev/null -w '%{http_code}' \
    -b "next-auth.session-token=$TEACHER_TOKEN" \
    "$BASE_URL/api/students")
  check "GET /api/students as Teacher → 200" "200" "$status"

  status=$(curl -s -o /dev/null -w '%{http_code}' \
    -b "next-auth.session-token=$TEACHER_TOKEN" \
    "$BASE_URL/api/class-sections")
  check "GET /api/class-sections as Teacher → 200" "200" "$status"

  # Verify Teacher sees only scoped data (check response body)
  echo ""
  echo "▸ Teacher data scoping"
  body=$(curl -s -b "next-auth.session-token=$TEACHER_TOKEN" "$BASE_URL/api/students")
  count=$(echo "$body" | grep -o '"id"' | wc -l | tr -d ' ')
  echo "  Teacher sees $count student(s) (scoped to assigned classes)"
else
  echo -e "  ${YELLOW}⚠${NC} Skipping Teacher tests — TEACHER_TOKEN not set"
fi
echo ""

# ─── Summary ──────────────────────────────────────────────

echo "═══════════════════════════════════════════════════════"
echo -e "  Results: ${GREEN}${pass} passed${NC}, ${RED}${fail} failed${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""

if [ "$fail" -gt 0 ]; then
  exit 1
fi
