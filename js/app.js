"use strict";

/*
 * love-water — a gentle water tracker for two.
 *
 * All of the thinking (counting, the streak, fourteen days of history, the
 * ring geometry, storage shapes) lives in plain functions at the top and is
 * published on window.MenaWater so it can be tested without a browser.
 * Rendering only happens in boot(), and every DOM lookup is guarded.
 */

(function () {
  var LS = "mena-water";
  var DEFAULT_GOAL = 8;
  var MAX_GOAL = 20;
  var MAX_PER_DAY = 40;
  var HISTORY_DAYS = 14;
  var RING_RADIUS = 86;
  var GLASS_ML = 250;

  /* ---------- dates ---------- */

  function todayStr(date) {
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    var d = date instanceof Date ? date : new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function parseDay(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str == null ? "" : str));
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  /* A copy of `date` moved by `n` days (local midnight safe). */
  function addDays(date, n) {
    var d = date instanceof Date ? new Date(date.getTime()) : new Date();
    var step = Math.round(Number(n) || 0);
    d.setDate(d.getDate() + step);
    return d;
  }

  /* Whole days from day `a` to day `b` (both YYYY-MM-DD), or NaN. */
  function dayDiff(a, b) {
    var da = parseDay(a);
    var db = parseDay(b);
    if (!da || !db) return NaN;
    return Math.round((db.getTime() - da.getTime()) / 86400000);
  }

  /* The last `n` days as date strings, oldest first, ending on `today`. */
  function lastNDays(today, n) {
    var base = parseDay(todayStr(today)) || new Date();
    var count = Math.max(1, Math.round(Number(n) || 1));
    var out = [];
    var i;
    for (i = count - 1; i >= 0; i -= 1) out.push(todayStr(addDays(base, -i)));
    return out;
  }

  /* ---------- the log ---------- */

  function validGoal(goal) {
    var g = Math.round(Number(goal));
    if (!isFinite(g) || g < 1) return DEFAULT_GOAL;
    return Math.min(g, MAX_GOAL);
  }

  /* A tidy copy: only real dates with a positive whole number of glasses. */
  function copyLog(log) {
    var out = {};
    if (!log || typeof log !== "object") return out;
    Object.keys(log).forEach(function (key) {
      var value = Math.floor(Number(log[key]));
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && isFinite(value) && value > 0) out[key] = value;
    });
    return out;
  }

  function countFor(log, date) {
    var day = todayStr(date);
    var value = log && typeof log === "object" ? log[day] : 0;
    var n = Math.floor(Number(value));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function addGlass(log, date) {
    var day = todayStr(date);
    var next = copyLog(log);
    next[day] = Math.min(countFor(log, day) + 1, MAX_PER_DAY);
    return next;
  }

  function removeGlass(log, date) {
    var day = todayStr(date);
    var next = copyLog(log);
    var left = countFor(log, day) - 1;
    if (left > 0) next[day] = left;
    else delete next[day];
    return next;
  }

  function totalGlasses(log) {
    var clean = copyLog(log);
    return Object.keys(clean).reduce(function (sum, key) {
      return sum + clean[key];
    }, 0);
  }

  function daysMet(log, goal) {
    var g = validGoal(goal);
    var clean = copyLog(log);
    return Object.keys(clean).filter(function (key) {
      return clean[key] >= g;
    }).length;
  }

  /* ---------- progress ---------- */

  function percent(count, goal) {
    var g = validGoal(goal);
    var c = Math.max(0, Math.floor(Number(count) || 0));
    return Math.min(100, Math.round((c / g) * 100));
  }

  function isGoalMet(count, goal) {
    var c = Math.max(0, Math.floor(Number(count) || 0));
    return c >= validGoal(goal);
  }

  function mlLabel(count) {
    var c = Math.max(0, Math.floor(Number(count) || 0));
    return c * GLASS_ML + " ml";
  }

  /* ---------- the streak ---------- */

  /*
   * Days in a row reaching the goal. Today only counts once it is reached, so
   * a morning glance never shows a broken streak.
   */
  function streak(log, goal, today) {
    var g = validGoal(goal);
    var day = parseDay(todayStr(today));
    var run = 0;
    if (countFor(log, todayStr(day)) < g) day = addDays(day, -1);
    while (day && countFor(log, todayStr(day)) >= g) {
      run += 1;
      day = addDays(day, -1);
    }
    return run;
  }

  /* The longest run of goal days anywhere in the log. */
  function bestStreak(log, goal) {
    var g = validGoal(goal);
    var days = Object.keys(copyLog(log)).filter(function (key) {
      return countFor(log, key) >= g;
    }).sort();
    var best = 0;
    var run = 0;
    var i;
    for (i = 0; i < days.length; i += 1) {
      if (i > 0 && dayDiff(days[i - 1], days[i]) === 1) run += 1;
      else run = 1;
      if (run > best) best = run;
    }
    return best;
  }

  /* ---------- history ---------- */

  function historyBars(log, today, n, goal) {
    var g = validGoal(goal);
    return lastNDays(today, n).map(function (day) {
      var count = countFor(log, day);
      return {
        date: day,
        count: count,
        met: count >= g,
        height: Math.min(100, Math.round((count / g) * 100))
      };
    });
  }

  function weekdayLetter(date) {
    var d = parseDay(typeof date === "string" ? date : todayStr(date));
    if (!d) return "";
    return ["S", "M", "T", "W", "T", "F", "S"][d.getDay()];
  }

  /* ---------- ring geometry ---------- */

  function ringDash(pct, r) {
    var radius = typeof r === "number" && r > 0 ? r : RING_RADIUS;
    var circumference = 2 * Math.PI * radius;
    var clamped = Math.max(0, Math.min(100, Number(pct) || 0));
    return { circumference: circumference, offset: circumference * (1 - clamped / 100) };
  }

  /* ---------- state ---------- */

  function emptyState() {
    return { goal: DEFAULT_GOAL, log: {}, remind: false };
  }

  function normalizeState(raw) {
    var base = emptyState();
    if (!raw || typeof raw !== "object") return base;
    return {
      goal: validGoal(raw.goal),
      log: copyLog(raw.log),
      remind: !!raw.remind
    };
  }

  function escapeHtml(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function load() {
    var raw = null;
    try {
      raw = window.localStorage.getItem(LS);
    } catch (e) {
      raw = null;
    }
    var parsed = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        parsed = null;
      }
    }
    return normalizeState(parsed);
  }

  function save(state) {
    try {
      window.localStorage.setItem(LS, JSON.stringify(state));
    } catch (e) {
      /* storage full or blocked — today still works this session */
    }
  }

  /* ---------- publish ---------- */

  var API = {
    STORAGE_KEY: LS,
    DEFAULT_GOAL: DEFAULT_GOAL,
    MAX_GOAL: MAX_GOAL,
    HISTORY_DAYS: HISTORY_DAYS,
    RING_RADIUS: RING_RADIUS,
    GLASS_ML: GLASS_ML,
    todayStr: todayStr,
    parseDay: parseDay,
    addDays: addDays,
    dayDiff: dayDiff,
    lastNDays: lastNDays,
    validGoal: validGoal,
    copyLog: copyLog,
    countFor: countFor,
    addGlass: addGlass,
    removeGlass: removeGlass,
    totalGlasses: totalGlasses,
    daysMet: daysMet,
    percent: percent,
    isGoalMet: isGoalMet,
    mlLabel: mlLabel,
    streak: streak,
    bestStreak: bestStreak,
    historyBars: historyBars,
    weekdayLetter: weekdayLetter,
    ringDash: ringDash,
    emptyState: emptyState,
    normalizeState: normalizeState,
    escapeHtml: escapeHtml,
    load: load,
    save: save
  };

  if (typeof window !== "undefined") window.MenaWater = API;

  function boot() {
    var countEl = document.getElementById("ring-count");
    if (!countEl && !document.getElementById("btn-plus")) return;

    var state = load();
    var note = document.getElementById("water-note");
    var reminderNote = document.getElementById("reminder-note");
    var reminderToggle = document.getElementById("reminder-toggle");
    var historyWrap = document.getElementById("history-bars");
    var summary = document.getElementById("history-summary");
    var timer = null;

    function set(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function setNote(text) {
      if (note) note.textContent = text || "\u00a0";
    }

    function today() {
      return todayStr();
    }

    function persist() {
      save(state);
    }

    /* ---------- notifications ---------- */

    function notificationsAllowed() {
      return (
        typeof window.Notification === "function" &&
        window.Notification.permission === "granted"
      );
    }

    function notify(title, body) {
      if (!notificationsAllowed()) return;
      try {
        new window.Notification(title, { body: body, icon: "assets/favicon.svg" });
      } catch (e) {
        /* some browsers block the constructor outside a service worker */
      }
    }

    function askPermission(then) {
      if (typeof window.Notification !== "function") {
        if (reminderNote) reminderNote.textContent = "This browser has no reminder support \u2014 no problem, we will keep counting.";
        return;
      }
      if (window.Notification.permission === "granted") {
        then();
        return;
      }
      try {
        var result = window.Notification.requestPermission(then);
        if (result && typeof result.then === "function") result.then(then);
      } catch (e) {
        then();
      }
    }

    function scheduleReminder() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
      if (!state.remind) return;
      timer = window.setInterval(function () {
        if (countFor(state.log, today()) < state.goal) {
          notify("A little water \u2665", "You are on " + countFor(state.log, today()) + " of " + state.goal + " today. Drink with me?");
        }
      }, 60 * 60 * 1000);
    }

    /* ---------- rendering ---------- */

    function renderRing() {
      var count = countFor(state.log, today());
      var pct = percent(count, state.goal);
      var stroke = ringDash(pct, RING_RADIUS);

      var ring = document.getElementById("ring-progress");
      if (ring) {
        ring.style.strokeDasharray = stroke.circumference.toFixed(2);
        ring.style.strokeDashoffset = stroke.offset.toFixed(2);
        ring.classList.toggle("is-complete", isGoalMet(count, state.goal));
      }

      set("ring-count", String(count));
      set("ring-goal", "of " + state.goal);
      set("ring-label", isGoalMet(count, state.goal) ? "goal reached \u2665" : "glasses today");

      var row = document.getElementById("glasses-row");
      if (row) {
        var total = Math.max(state.goal, count);
        row.textContent = "";
        var i;
        for (i = 0; i < total; i += 1) {
          var glass = document.createElement("span");
          glass.className = "glass" + (i < count ? " is-filled" : "");
          row.appendChild(glass);
        }
      }
    }

    function renderStats() {
      var count = countFor(state.log, today());
      set("stat-today", String(count));
      set("stat-streak", String(streak(state.log, state.goal, today())));
      set("stat-best", String(bestStreak(state.log, state.goal)));
      set("stat-total", String(totalGlasses(state.log)));
      set("goal-value", String(state.goal));
    }

    function renderHistory() {
      if (!historyWrap) return;
      var data = historyBars(state.log, today(), HISTORY_DAYS, state.goal);
      historyWrap.textContent = "";
      var met = 0;
      data.forEach(function (day) {
        if (day.met) met += 1;
        var column = document.createElement("div");
        column.className = "history-day";
        column.setAttribute("title", day.date + ": " + day.count + " glass" + (day.count === 1 ? "" : "es"));

        var track = document.createElement("div");
        track.className = "bar-track";
        var fill = document.createElement("div");
        fill.className = "bar-fill" + (day.met ? " is-met" : "");
        fill.style.height = day.height + "%";
        track.appendChild(fill);

        var label = document.createElement("span");
        label.className = "bar-label" + (day.date === today() ? " is-today" : "");
        label.textContent = weekdayLetter(day.date);

        column.appendChild(track);
        column.appendChild(label);
        historyWrap.appendChild(column);
      });
      if (summary) {
        summary.textContent = met + " of the last " + HISTORY_DAYS + " days reached the goal.";
      }
    }

    function renderReminder() {
      if (reminderToggle) reminderToggle.checked = !!state.remind;
      if (reminderNote) {
        if (typeof window.Notification !== "function") {
          reminderNote.textContent = "This browser has no notification support.";
        } else if (state.remind && window.Notification.permission === "granted") {
          reminderNote.textContent = "I will nudge you once an hour while this page is open.";
        } else if (state.remind) {
          reminderNote.textContent = "Waiting for permission to remind you\u2026";
        } else {
          reminderNote.textContent = "\u00a0";
        }
      }
    }

    function renderAll() {
      renderRing();
      renderStats();
      renderHistory();
      renderReminder();
    }

    /* ---------- actions ---------- */

    function cheer() {
      if (typeof window.heartBurst === "function") {
        window.heartBurst(window.innerWidth / 2, window.innerHeight / 2, 24);
      }
      if (typeof window.fxToast === "function") {
        window.fxToast("Goal reached \u2665 drink with me, always");
      }
      notify("Goal reached \u2665", "You finished your water for today. Proud of us.");
    }

    function change(delta) {
      var before = countFor(state.log, today());
      state.log = delta > 0 ? addGlass(state.log, today()) : removeGlass(state.log, today());
      var after = countFor(state.log, today());
      persist();
      renderAll();
      if (delta > 0 && before < state.goal && after >= state.goal) cheer();
      else if (delta > 0) setNote(after + " of " + state.goal + " \u00b7 " + mlLabel(after) + " \u2014 one more whenever you like.");
      else setNote(after + " of " + state.goal + " \u00b7 " + mlLabel(after) + ".");
    }

    function on(id, handler) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("click", handler);
    }

    on("btn-plus", function () {
      change(1);
    });

    on("btn-minus", function () {
      change(-1);
    });

    on("goal-plus", function () {
      state.goal = validGoal(state.goal + 1);
      persist();
      renderAll();
      setNote("Goal is now " + state.goal + " glasses a day.");
    });

    on("goal-minus", function () {
      state.goal = validGoal(state.goal - 1);
      persist();
      renderAll();
      setNote("Goal is now " + state.goal + " glasses a day.");
    });

    on("btn-remind-now", function () {
      askPermission(function () {
        window.setTimeout(function () {
          notify("A little water \u2665", "Just a gentle nudge from Ammar.");
        }, 60000);
        if (reminderNote) reminderNote.textContent = "One reminder coming in a minute \u2665";
        renderReminder();
      });
    });

    if (reminderToggle) {
      reminderToggle.addEventListener("change", function () {
        if (reminderToggle.checked) {
          state.remind = true;
          persist();
          askPermission(function () {
            if (reminderNote) reminderNote.textContent = "I will nudge you once an hour while this page is open.";
            renderReminder();
          });
          scheduleReminder();
        } else {
          state.remind = false;
          persist();
          renderReminder();
          scheduleReminder();
          setNote("Reminders are off \u2014 we will keep counting anyway.");
        }
      });
    }

    renderAll();
    scheduleReminder();
  }

  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("DOMContentLoaded", function () {
      try {
        boot();
      } catch (e) {
        /* a missing element must never break the page */
      }
    });
  }
})();
