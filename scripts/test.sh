#!/usr/bin/env bash
# FCF tracker tests: unit safety + static first-paint HTML.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

pass() {
  echo "PASS: $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "FAIL: $1"
  FAIL=$((FAIL + 1))
}

assert_eq() {
  local got="$1"
  local expected="$2"
  local label="$3"
  if [[ "$got" == "$expected" ]]; then
    pass "$label"
  else
    fail "$label (got ${got@Q}, expected ${expected@Q})"
  fi
}

if [[ ! -f js/fcf.js ]]; then
  echo "FAIL: js/fcf.js missing"
  echo "Summary: 0 passed, 1 failed"
  exit 1
fi

UNIT_JSON="$(node <<'NODE'
const FCF = require("./js/fcf.js");

function dump(value) {
  return JSON.stringify(value, (_, v) => (v === undefined ? null : v));
}

const results = {};

results.zeroOcf = FCF.computeFcf(0, 12);
results.zeroCapex = FCF.computeFcf(50, 0);
results.zeroBoth = FCF.computeFcf(0, 0);
results.nullOcf = FCF.computeFcf(null, 12);
results.nullCapex = FCF.computeFcf(40, null);
results.undefBoth = FCF.computeFcf(undefined, undefined);
results.nanInput = FCF.computeFcf(Number.NaN, 10);
results.infInput = FCF.computeFcf(10, Number.POSITIVE_INFINITY);
results.negCapexAbs = FCF.computeFcf(80, -20);
results.zeroRevenueMargin = FCF.computeFcfMargin(25, 0);
results.nullMargin = FCF.computeFcfMargin(null, 100);
results.nullSeries = FCF.analyzeSeries(null);
results.emptySeries = FCF.analyzeSeries([]);
results.emptyObject = FCF.analyzeSeries({ months: [] });
results.momZeroPrev = FCF.momChangePct(10, 0);
results.momNull = FCF.momChange(5, null);
results.targetHit = FCF.compareToTarget(57.3, 40);
results.targetMiss = FCF.compareToTarget(13.6, 40);
results.targetZero = FCF.compareToTarget(5, 0);

const analyzed = FCF.analyzeSeries({
  targets: { fcf: 40, fcfMargin: 0.1 },
  months: [
    { month: "2026-08", ocf: 75.0, capex: 20.5, revenue: 445.0 },
    { month: "2026-09", ocf: 78.6, capex: 21.3, revenue: 460.0 }
  ]
});
function close(a, b, eps) {
  if (a === null || b === null) return a === b;
  return typeof a === "number" && typeof b === "number" && Math.abs(a - b) < (eps || 1e-9);
}
results.sampleFcfOk = close(analyzed.summary.latestFcf, 57.3);
results.sampleMarginOk = close(analyzed.summary.latestMargin, 57.3 / 460);
results.sampleMomOk = close(analyzed.summary.momFcf, 2.8);
results.sampleCumulative = analyzed.summary.cumulativeFcf;

const withNullRow = FCF.analyzeSeries([
  { month: "a", ocf: 10, capex: 2, revenue: 100 },
  { month: "b", ocf: null, capex: null, revenue: null }
]);
results.nullRowFcf = withNullRow.months[1].fcf;
results.nullRowCumulative = withNullRow.months[1].cumulativeFcf;

function walk(node, acc) {
  if (node === null || node === undefined) return acc;
  if (typeof node === "number") {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => walk(item, acc));
    return acc;
  }
  if (typeof node === "object") {
    Object.keys(node).forEach((key) => walk(node[key], acc));
  }
  return acc;
}

const numbers = walk(analyzed, []).concat(
  walk(results.nullSeries, []),
  walk(results.emptySeries, []),
  [results.zeroOcf, results.zeroCapex, results.zeroRevenueMargin, results.momZeroPrev]
);
results.hasNaN = numbers.some((n) => typeof n === "number" && Number.isNaN(n));
results.hasInf = numbers.some((n) => typeof n === "number" && !Number.isFinite(n) && !Number.isNaN(n));

process.stdout.write(dump(results));
NODE
)" || {
  echo "FAIL: node unit tests crashed"
  echo "Summary: 0 passed, 1 failed"
  exit 1
}

eval "$(node -e '
const r = JSON.parse(process.argv[1]);
function out(k, v) {
  const s = v === null ? "null" : String(v);
  process.stdout.write(k + "=" + JSON.stringify(s) + "\n");
}
out("ZERO_OCF", r.zeroOcf);
out("ZERO_CAPEX", r.zeroCapex);
out("ZERO_BOTH", r.zeroBoth);
out("NULL_OCF", r.nullOcf);
out("NULL_CAPEX", r.nullCapex);
out("UNDEF_BOTH", r.undefBoth);
out("NAN_INPUT", r.nanInput);
out("INF_INPUT", r.infInput);
out("NEG_CAPEX", r.negCapexAbs);
out("ZERO_REV", r.zeroRevenueMargin);
out("NULL_MARGIN", r.nullMargin);
out("NULL_SERIES_COUNT", r.nullSeries.summary.monthCount);
out("NULL_SERIES_CUM", r.nullSeries.summary.cumulativeFcf);
out("EMPTY_COUNT", r.emptySeries.summary.monthCount);
out("EMPTY_FCF", r.emptySeries.summary.latestFcf);
out("EMPTY_OBJ_COUNT", r.emptyObject.summary.monthCount);
out("MOM_ZERO", r.momZeroPrev);
out("MOM_NULL", r.momNull);
out("TARGET_HIT", r.targetHit && r.targetHit.met);
out("TARGET_MISS", r.targetMiss && r.targetMiss.met);
out("TARGET_ZERO_PCT", r.targetZero && r.targetZero.pct);
out("SAMPLE_FCF_OK", r.sampleFcfOk);
out("SAMPLE_MARGIN_OK", r.sampleMarginOk);
out("SAMPLE_MOM_OK", r.sampleMomOk);
out("SAMPLE_CUM", r.sampleCumulative);
out("NULL_ROW_FCF", r.nullRowFcf);
out("NULL_ROW_CUM", r.nullRowCumulative);
out("HAS_NAN", r.hasNaN);
out("HAS_INF", r.hasInf);
' "$UNIT_JSON")"

assert_eq "$ZERO_OCF" "-12" "zero OCF: FCF = 0 − |capex|"
assert_eq "$ZERO_CAPEX" "50" "zero capex: FCF = OCF"
assert_eq "$ZERO_BOTH" "0" "zero OCF and zero capex: FCF = 0"
assert_eq "$NULL_OCF" "null" "null OCF returns null"
assert_eq "$NULL_CAPEX" "null" "null capex returns null"
assert_eq "$UNDEF_BOTH" "null" "undefined inputs return null"
assert_eq "$NAN_INPUT" "null" "NaN input returns null"
assert_eq "$INF_INPUT" "null" "Infinity input returns null"
assert_eq "$NEG_CAPEX" "60" "negative capex still uses |capex|"
assert_eq "$ZERO_REV" "null" "zero revenue: FCF margin is null"
assert_eq "$NULL_MARGIN" "null" "null FCF: margin is null"
assert_eq "$NULL_SERIES_COUNT" "0" "null series: monthCount 0"
assert_eq "$NULL_SERIES_CUM" "null" "null series: cumulative FCF is null"
assert_eq "$EMPTY_COUNT" "0" "empty series: monthCount 0"
assert_eq "$EMPTY_FCF" "null" "empty series: latest FCF is null"
assert_eq "$EMPTY_OBJ_COUNT" "0" "empty months array: monthCount 0"
assert_eq "$MOM_ZERO" "null" "MoM percent is null when previous is zero"
assert_eq "$MOM_NULL" "null" "MoM change is null when previous is null"
assert_eq "$TARGET_HIT" "true" "target comparison: 57.3 meets 40"
assert_eq "$TARGET_MISS" "false" "target comparison: 13.6 misses 40"
assert_eq "$TARGET_ZERO_PCT" "null" "target 0: pct is null (no Infinity)"
assert_eq "$SAMPLE_FCF_OK" "true" "sample FCF = 78.6 − 21.3"
assert_eq "$SAMPLE_MARGIN_OK" "true" "sample FCF margin = FCF / revenue"
assert_eq "$SAMPLE_MOM_OK" "true" "sample MoM FCF change"
assert_eq "$SAMPLE_CUM" "111.8" "sample cumulative FCF"
assert_eq "$NULL_ROW_FCF" "null" "null month inputs: FCF is null"
assert_eq "$NULL_ROW_CUM" "8" "null month does not wipe prior cumulative FCF"
assert_eq "$HAS_NAN" "false" "analyzer output contains no NaN"
assert_eq "$HAS_INF" "false" "analyzer output contains no Infinity"

MONTH_COUNT="$(node -e 'const d=require("./data/fcf.json"); process.stdout.write(String(d.months.length));')"
assert_eq "$MONTH_COUNT" "18" "data/fcf.json has exactly 18 months"

if [[ ! -f index.html ]]; then
  fail "index.html exists for first paint"
else
  pass "index.html exists for first paint"
fi

if grep -qiE 'Loading(\.\.\.|…)' index.html; then
  fail "static HTML has no Loading… shell"
else
  pass "static HTML has no Loading… shell"
fi

for needle in "OCF" "Capex" "FCF" "margin" "Cumulative"; do
  if grep -q "$needle" index.html; then
    pass "static HTML contains ${needle}"
  else
    fail "static HTML contains ${needle}"
  fi
done

ROW_COUNT="$(grep -c 'data-month="' index.html || true)"
assert_eq "$ROW_COUNT" "18" "static HTML has 18 month rows"

if grep -q 'data-month="2025-04"' index.html && grep -q 'data-month="2026-09"' index.html; then
  pass "static HTML includes first and last month rows"
else
  fail "static HTML includes first and last month rows"
fi

if grep -q '\$57.3M' index.html || grep -q '\$57.3' index.html; then
  pass "static HTML bakes latest FCF value"
else
  fail "static HTML bakes latest FCF value"
fi

PORT=8765
python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/fcf-http.log 2>&1 &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

HTML=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if HTML="$(curl -sfL "http://127.0.0.1:${PORT}/")"; then
    break
  fi
  sleep 0.2
done

if [[ -z "$HTML" ]]; then
  fail "curl -sL first-paint fetch succeeded"
else
  pass "curl -sL first-paint fetch succeeded"
  echo "$HTML" | grep -q "OCF" && pass "curl HTML shows OCF" || fail "curl HTML shows OCF"
  echo "$HTML" | grep -qi "capex" && pass "curl HTML shows capex" || fail "curl HTML shows capex"
  echo "$HTML" | grep -q "FCF" && pass "curl HTML shows FCF" || fail "curl HTML shows FCF"
  echo "$HTML" | grep -qi "margin" && pass "curl HTML shows margin" || fail "curl HTML shows margin"
  echo "$HTML" | grep -qi "cumulative" && pass "curl HTML shows cumulative" || fail "curl HTML shows cumulative"
  CURL_ROWS="$(printf '%s\n' "$HTML" | grep -c 'data-month="' || true)"
  assert_eq "$CURL_ROWS" "18" "curl HTML includes 18 month rows"
  echo "$HTML" | grep -qiE 'Loading(\.\.\.|…)' && fail "curl HTML has no Loading… shell" || pass "curl HTML has no Loading… shell"
fi

echo "Summary: ${PASS} passed, ${FAIL} failed"
if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
exit 0
