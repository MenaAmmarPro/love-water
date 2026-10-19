/*
 * love-water — dependency-free test harness.
 *
 * Loads js/app.js inside a fake-DOM sandbox and checks the pure logic
 * published on window.MenaWater.  Run:  node test/harness.js
 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const store = {};
const el = () => ({
  style: {}, classList: { add() {}, remove() {}, toggle() {} }, dataset: {},
  appendChild() {}, addEventListener() {}, setAttribute() {}, removeAttribute() {},
  querySelector: () => null, querySelectorAll: () => [], focus() {}, remove() {},
  innerHTML: '', textContent: '', value: ''
});

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Intl,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  },
  document: {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, createElement: () => el(),
    body: { appendChild() {}, classList: { add() {}, remove() {} } },
    documentElement: { classList: { add() {}, remove() {}, toggle() {} } }
  },
  navigator: { language: 'en', clipboard: { writeText: async () => {} } },
  requestAnimationFrame: (fn) => setTimeout(fn, 0)
};

sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of ['js/app.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f });
}

/* ---------------- assertions ---------------- */

const NS = sandbox.window.MenaWater;
let failures = 0;

function assert(cond, msg) {
  if (!cond) { console.error('FAIL: ' + msg); failures += 1; }
  else console.log('ok - ' + msg);
}

function eq(a, b, msg) {
  const same = JSON.stringify(a) === JSON.stringify(b);
  assert(same, msg + (same ? '' : ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'));
}

function close(a, b, eps, msg) {
  assert(Math.abs(a - b) < eps, msg + ' (got ' + a + ', want ~' + b + ')');
}

assert(!!NS, 'namespace window.MenaWater exposed');

/* ---- constants ---- */
eq(NS.STORAGE_KEY, 'mena-water', 'storage key is mena-water');
eq(NS.DEFAULT_GOAL, 8, 'the default goal is 8');
eq(NS.HISTORY_DAYS, 14, 'history covers 14 days');
eq(NS.MAX_GOAL, 20, 'the goal has a sane ceiling');

/* ---- dates ---- */
eq(NS.todayStr(new Date(2026, 0, 5)), '2026-01-05', 'todayStr pads month and day');
eq(NS.todayStr(new Date(2030, 11, 9)), '2030-12-09', 'todayStr handles December');
assert(NS.parseDay('2026-01-05') instanceof Date, 'parseDay returns a Date');
assert(NS.parseDay('nope') === null, 'parseDay rejects rubbish');
eq(NS.todayStr(NS.parseDay('2026-03-04')), '2026-03-04', 'parseDay round-trips');
eq(NS.todayStr(NS.addDays(new Date(2026, 0, 31), 1)), '2026-02-01', 'addDays rolls the month');
eq(NS.todayStr(NS.addDays(new Date(2026, 2, 1), -1)), '2026-02-28', 'addDays rolls back');
eq(NS.dayDiff('2026-01-01', '2026-01-08'), 7, 'dayDiff counts whole days');
eq(NS.dayDiff('2026-01-08', '2026-01-01'), -7, 'dayDiff is signed');
assert(isNaN(NS.dayDiff('x', '2026-01-01')), 'dayDiff rejects rubbish');

const fortnight = NS.lastNDays('2026-01-14', 14);
eq(fortnight.length, 14, 'lastNDays returns 14 days');
eq(fortnight[13], '2026-01-14', 'lastNDays ends on the given day');
eq(fortnight[0], '2026-01-01', 'lastNDays starts two weeks back');
assert(fortnight.every((d, i) => i === 0 || NS.dayDiff(fortnight[i - 1], d) === 1), 'lastNDays has no gaps');

/* ---- goals ---- */
eq(NS.validGoal(8), 8, 'validGoal keeps a good goal');
eq(NS.validGoal('4'), 4, 'validGoal accepts numeric strings');
eq(NS.validGoal(undefined), 8, 'validGoal falls back to the default');
eq(NS.validGoal(0), 8, 'validGoal rejects zero');
eq(NS.validGoal(-3), 8, 'validGoal rejects negatives');
eq(NS.validGoal(500), 20, 'validGoal caps runaway goals');
eq(NS.validGoal(3.6), 4, 'validGoal rounds');

/* ---- the log ---- */
eq(NS.countFor({}, '2026-01-01'), 0, 'an unlogged day is zero');
eq(NS.countFor({ '2026-01-01': 3 }, '2026-01-01'), 3, 'countFor reads the day');
eq(NS.countFor({ '2026-01-01': 3.9 }, '2026-01-01'), 3, 'countFor floors');
eq(NS.countFor(null, '2026-01-01'), 0, 'countFor copes with no log');

const cleaned = NS.copyLog({
  '2026-01-01': 3, bad: 5, '2026-01-02': 0, '2026-01-03': -2, '2026-01-04': 2.7
});
eq(cleaned, { '2026-01-01': 3, '2026-01-04': 2 }, 'copyLog keeps only real positive days');

const base = { '2026-01-01': 2 };
const plus = NS.addGlass(base, '2026-01-01');
eq(plus['2026-01-01'], 3, 'addGlass adds one');
eq(base['2026-01-01'], 2, 'addGlass does not mutate the log');
eq(NS.addGlass({}, '2026-01-02'), { '2026-01-02': 1 }, 'addGlass starts a new day at one');
eq(NS.countFor(NS.addGlass(base, '2026-01-01'), '2026-01-02'), 0, 'addGlass leaves other days alone');

const minus = NS.removeGlass(base, '2026-01-01');
eq(minus['2026-01-01'], 1, 'removeGlass takes one away');
eq(NS.removeGlass({ '2026-01-01': 1 }, '2026-01-01'), {}, 'removeGlass drops an empty day');
eq(NS.removeGlass({}, '2026-01-01'), {}, 'removeGlass never goes below zero');
eq(base['2026-01-01'], 2, 'removeGlass does not mutate the log');

const cap = NS.addGlass({ '2026-01-01': NS.MAX_GOAL * 2 }, '2026-01-01');
eq(cap['2026-01-01'], 40, 'addGlass caps a silly day');

eq(NS.totalGlasses({ '2026-01-01': 3, '2026-01-02': 4 }), 7, 'totalGlasses sums the log');
eq(NS.totalGlasses({}), 0, 'totalGlasses copes with an empty log');
eq(NS.daysMet({ '2026-01-01': 8, '2026-01-02': 7, '2026-01-03': 9 }, 8), 2, 'daysMet counts goal days');

/* ---- progress ---- */
eq(NS.percent(0, 8), 0, 'percent of nothing is 0');
eq(NS.percent(4, 8), 50, 'percent is half at half');
eq(NS.percent(8, 8), 100, 'percent is full at the goal');
eq(NS.percent(12, 8), 100, 'percent never exceeds 100');
eq(NS.percent(1, 3), 33, 'percent rounds');
assert(NS.isGoalMet(8, 8) === true, 'the goal is met at the goal');
assert(NS.isGoalMet(7, 8) === false, 'the goal is not met below it');
eq(NS.mlLabel(3), '750 ml', 'mlLabel estimates millilitres');

/* ---- the streak ---- */
const run = { '2026-01-01': 8, '2026-01-02': 9, '2026-01-03': 8 };
eq(NS.streak(run, 8, '2026-01-03'), 3, 'a three-day run counts as three');
eq(NS.streak(run, 8, '2026-01-04'), 3, 'the streak survives until the day is over');
eq(NS.streak(run, 8, '2026-01-05'), 0, 'a missed day ends the streak');
eq(NS.streak({}, 8, '2026-01-03'), 0, 'an empty log has no streak');
eq(NS.streak({ '2026-01-01': 7, '2026-01-02': 8 }, 8, '2026-01-02'), 1, 'a short day does not count');
eq(NS.streak({ '2026-01-01': 8, '2026-01-03': 8 }, 8, '2026-01-04'), 1, 'a gap splits the run');

eq(NS.bestStreak({ '2026-01-01': 8, '2026-01-02': 8, '2026-01-05': 8 }, 8), 2, 'bestStreak finds the longest run');
eq(NS.bestStreak({}, 8), 0, 'bestStreak copes with an empty log');
eq(NS.bestStreak({ '2026-01-01': 8, '2026-01-02': 8, '2026-01-03': 8 }, 8), 3, 'bestStreak counts a clean run');

/* ---- history ---- */
const bars = NS.historyBars({ '2026-01-10': 4, '2026-01-12': 8, '2026-01-14': 16 }, '2026-01-14', 14, 8);
eq(bars.length, 14, 'history has fourteen bars');
eq(bars[13].date, '2026-01-14', 'the last bar is today');
eq(bars[13].count, 16, 'a bar knows its count');
assert(bars[13].met === true, 'a bar knows when the goal was met');
eq(bars[9].height, 50, 'a bar is half height at half the goal');
eq(bars[11].met, true, 'a goal day is flagged');
eq(bars[13].height, 100, 'bar height is capped at the top');
eq(bars[0].height, 0, 'an empty day has no bar');
eq(bars[13].date === NS.todayStr(NS.parseDay('2026-01-14')), true, 'bar dates match the day strings');

eq(NS.weekdayLetter('2026-01-04'), 'S', 'a Sunday is S');
eq(NS.weekdayLetter('2026-01-05'), 'M', 'a Monday is M');
eq(NS.weekdayLetter('nope'), '', 'weekdayLetter copes with rubbish');

/* ---- ring geometry ---- */
const full = NS.ringDash(100, 86);
close(full.circumference, 2 * Math.PI * 86, 1e-9, 'the ring circumference is 2πr');
close(full.offset, 0, 1e-9, 'a full ring has no offset');
const empty = NS.ringDash(0, 86);
close(empty.offset, empty.circumference, 1e-9, 'an empty ring is offset by its whole length');
const half = NS.ringDash(50, 86);
close(half.offset, half.circumference / 2, 1e-9, 'half the ring is offset by half');
close(NS.ringDash(999, 10).offset, 0, 1e-9, 'the ring never overflows');
close(NS.ringDash(-5, 10).offset, 2 * Math.PI * 10, 1e-9, 'the ring never undoes');

/* ---- state ---- */
const fresh = NS.emptyState();
eq(fresh.goal, 8, 'a fresh state starts at the default goal');
eq(fresh.log, {}, 'a fresh state has an empty log');
eq(fresh.remind, false, 'reminders start off');

const fixed = NS.normalizeState({ goal: 'abc', log: { '2026-01-01': 2, bad: 1 }, remind: 1 });
eq(fixed.goal, 8, 'normalizeState repairs the goal');
eq(fixed.log, { '2026-01-01': 2 }, 'normalizeState cleans the log');
eq(fixed.remind, true, 'normalizeState keeps a truthy reminder');
eq(NS.normalizeState(null), fresh, 'normalizeState copes with nothing saved');
eq(NS.normalizeState({ goal: 99 }), { goal: 20, log: {}, remind: false }, 'normalizeState caps the goal');

eq(NS.escapeHtml('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;', 'escapeHtml neutralises markup');
eq(NS.escapeHtml(null), '', 'escapeHtml copes with null');

/* ---- storage round-trip ---- */
const saved = { goal: 10, log: { '2026-01-01': 4, '2026-01-02': 10 }, remind: true };
NS.save(saved);
eq(NS.load(), saved, 'save/load round-trips the state');

sandbox.localStorage.setItem('mena-water', '{not json');
eq(NS.load(), NS.emptyState(), 'a corrupt blob falls back to a fresh state');

console.log('');
if (failures) {
  console.error(failures + ' assertion(s) failed');
  process.exitCode = 1;
} else {
  console.log('all love-water assertions passed');
}
