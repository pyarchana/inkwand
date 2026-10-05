(() => {
  "use strict";

  const TABS = ["notes", "practice", "flashcards"];
  const state = {
    config: null,
    books: {},           // id -> book
    chapters: new Map(), // "book/chapter" -> library data (a promise)
    fresh: new Map(),    // "book/chapter-or-topic/tab" -> freshly written content
    token: 0,            // bumps on every page render so late replies are ignored
    writing: new Set(),  // keys currently being written live
    cal: null,           // { y, m } month shown in the calendar
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---------- doodle icons ----------
  const ICON = {
    tick: `<svg class="mark tick" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 17 C8 19, 10 22, 13 26 C17 17, 22 10, 28 5" /></svg>`,
    cross: `<svg class="mark cross" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 7 C12 12, 19 19, 25 26" /><path d="M25 6 C19 12, 13 19, 6 25" /></svg>`,
    greenTick: `<svg class="green-tick" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 17 C8 19, 10 22, 12 27 C16 17, 22 9, 29 4" /></svg>`,
    burst: `<svg class="burst" viewBox="0 0 50 50" aria-hidden="true"><path d="M25 6 l2 6 6 1 -5 3 2 6 -5 -4 -5 4 2 -6 -5 -3 6 -1 z" /><path d="M41 22 l1.2 3 3 .6 -2.5 1.6 1 3 -2.7 -2 -2.7 2 1 -3 -2.5 -1.6 3 -.6 z" /><path d="M10 30 l1.2 3 3 .6 -2.5 1.6 1 3 -2.7 -2 -2.7 2 1 -3 -2.5 -1.6 3 -.6 z" /></svg>`,
    circle: `<svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M60 6 C30 2, 6 14, 5 30 C4 48, 30 57, 55 55 C80 53, 96 42, 94 26 C92 12, 72 4, 40 8" /></svg>`,
    bookend: `<svg class="bookend" viewBox="0 0 34 70" aria-hidden="true"><path d="M3 68 V40 C3 20, 14 6, 31 4 V68 Z" /></svg>`,
    pencil: `<svg viewBox="0 0 220 90" aria-hidden="true">
      <path class="scribble" d="M10 70 q15 -30 30 0 t30 0 t30 0 t30 0 t30 0 t30 0" />
      <g class="pencil"><g transform="translate(10 70) rotate(-40)">
        <path class="eraser" d="M0 -6 h-12 v12 h12 z" /><path d="M0 -6 h46 v12 h-46 z" />
        <path class="tip" d="M46 -6 l14 6 -14 6 z" /><path class="lead-tip" d="M55 -2 l5 2 -5 2 z" />
      </g></g></svg>`,
  };

  // ---------- appreciation stickers (original doodles) ----------
  // Each sticker is drawn twice: a thick white outline (the die-cut edge) and the art.
  const STICKERS = {
    star: {
      name: "Gold star",
      svg: `<svg viewBox="0 0 60 60"><g stroke-linejoin="round" stroke-linecap="round">
        <path d="M30 5 l7 15 16.5 2 -12 11.5 3 16.5 -14.5 -8 -14.5 8 3 -16.5 -12 -11.5 16.5 -2 z" fill="#fff" stroke="#fff" stroke-width="9"/>
        <path d="M30 5 l7 15 16.5 2 -12 11.5 3 16.5 -14.5 -8 -14.5 8 3 -16.5 -12 -11.5 16.5 -2 z" fill="#ffcf33" stroke="#b8860b" stroke-width="2.4"/>
        <path d="M22 22 q4 -4 8 -5" fill="none" stroke="#fff6c2" stroke-width="3"/></g></svg>`,
    },
    crown: {
      name: "Crown",
      svg: `<svg viewBox="0 0 60 60"><g stroke-linejoin="round" stroke-linecap="round">
        <path d="M8 44 L6 18 l13 12 11 -18 11 18 13 -12 -2 26 z" fill="#fff" stroke="#fff" stroke-width="9"/>
        <path d="M8 44 L6 18 l13 12 11 -18 11 18 13 -12 -2 26 z" fill="#ffd54a" stroke="#a87400" stroke-width="2.4"/>
        <path d="M8 44 h44 v6 h-44 z" fill="#f2b705" stroke="#a87400" stroke-width="2.2"/>
        <circle cx="30" cy="34" r="4" fill="#e0457b" stroke="#a87400" stroke-width="1.6"/>
        <circle cx="17" cy="38" r="2.6" fill="#3d85c6" stroke="#a87400" stroke-width="1.4"/>
        <circle cx="43" cy="38" r="2.6" fill="#3f8f5a" stroke="#a87400" stroke-width="1.4"/></g></svg>`,
    },
    cup: {
      name: "Trophy cup",
      svg: `<svg viewBox="0 0 60 60"><g stroke-linejoin="round" stroke-linecap="round">
        <path d="M17 8 h26 v12 c0 10 -6 16 -13 16 c-7 0 -13 -6 -13 -16 z M26 36 h8 v8 h6 v8 h-20 v-8 h6 z" fill="#fff" stroke="#fff" stroke-width="9"/>
        <path d="M17 12 c-9 0 -10 12 2 14 M43 12 c9 0 10 12 -2 14" fill="none" stroke="#a87400" stroke-width="3"/>
        <path d="M17 8 h26 v12 c0 10 -6 16 -13 16 c-7 0 -13 -6 -13 -16 z" fill="#ffcf33" stroke="#a87400" stroke-width="2.4"/>
        <path d="M26 36 h8 v8 h-8 z" fill="#f2b705" stroke="#a87400" stroke-width="2.2"/>
        <path d="M20 44 h20 v8 h-20 z" fill="#8a5a2b" stroke="#5a3a1a" stroke-width="2.2"/>
        <path d="M27 18 l3 -4 v13" fill="none" stroke="#a87400" stroke-width="2.4"/></g></svg>`,
    },
    medal: {
      name: "Medal",
      svg: `<svg viewBox="0 0 60 60"><g stroke-linejoin="round" stroke-linecap="round">
        <path d="M18 4 h10 l6 16 -8 6 z M42 4 h-10 l-6 16 8 6 z" fill="#fff" stroke="#fff" stroke-width="8"/>
        <circle cx="30" cy="38" r="15" fill="#fff" stroke="#fff" stroke-width="9"/>
        <path d="M18 4 h10 l6 18 -8 4 z" fill="#3d85c6" stroke="#1f2a44" stroke-width="2"/>
        <path d="M42 4 h-10 l-6 18 8 4 z" fill="#e0457b" stroke="#1f2a44" stroke-width="2"/>
        <circle cx="30" cy="38" r="15" fill="#ffcf33" stroke="#a87400" stroke-width="2.4"/>
        <circle cx="30" cy="38" r="10" fill="none" stroke="#a87400" stroke-width="1.6" stroke-dasharray="3 3"/>
        <path d="M30 31 l2 4.5 5 .5 -3.7 3.4 1 5 -4.3 -2.5 -4.3 2.5 1 -5 -3.7 -3.4 5 -.5 z" fill="#fff6c2" stroke="#a87400" stroke-width="1.2"/></g></svg>`,
    },
    verygood: {
      name: "Very good!",
      svg: `<svg viewBox="0 0 60 60"><g stroke-linejoin="round">
        <path d="M30 3 l5 4 6 -1 3 5 6 2 0 6 4 5 -3 5 2 6 -5 4 -1 6 -6 1 -4 5 -6 -2 -5 3 -5 -3 -6 2 -4 -5 -6 -1 -1 -6 -5 -4 2 -6 -3 -5 4 -5 0 -6 6 -2 3 -5 6 1 z" fill="#fff" stroke="#fff" stroke-width="7"/>
        <path d="M30 3 l5 4 6 -1 3 5 6 2 0 6 4 5 -3 5 2 6 -5 4 -1 6 -6 1 -4 5 -6 -2 -5 3 -5 -3 -6 2 -4 -5 -6 -1 -1 -6 -5 -4 2 -6 -3 -5 4 -5 0 -6 6 -2 3 -5 6 1 z" fill="#ff8fb1" stroke="#b03060" stroke-width="2"/>
        <text x="30" y="28" text-anchor="middle" font-family="Kalam, cursive" font-weight="700" font-size="11" fill="#fff">Very</text>
        <text x="30" y="40" text-anchor="middle" font-family="Kalam, cursive" font-weight="700" font-size="11" fill="#fff">good!</text></g></svg>`,
    },
  };
  // Stars are the most common, like in school. The trophy is saved for full marks.
  const STICKER_BAG = ["star", "star", "star", "medal", "medal", "verygood", "verygood", "crown"];

  // ---------- helpers ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function inline(s, pen) {
    return escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, (_, t) => `<strong${pen ? ` class="${pen(t)}"` : ""}>${t}</strong>`)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, "$1<em>$2</em>");
  }

  // Highlighter pens for notes: key terms switch between pink, green and yellow
  // (a term keeps its colour every time it comes up), traps get orange.
  const TERM_PENS = ["hl-pink", "hl-green", "hl-yellow"];
  function makePens() {
    const seen = new Map();
    return (term) => {
      const k = term.replace(/<[^>]+>/g, "").trim().toLowerCase();
      if (!seen.has(k)) seen.set(k, TERM_PENS[seen.size % TERM_PENS.length]);
      return seen.get(k);
    };
  }
  const ANSWER_LINE = /^(so|therefore|hence|thus|answer|result|final answer|the answer)\b/i;

  // Safe formatter for model text: escape first, then allow bold, code,
  // bullet lists, code blocks and the "Example / Common traps / Remember this" labels.
  // With { highlighters: true } it colours the notes like a student's highlighters.
  function formatText(text, opts = {}) {
    const lines = String(text).replace(/\r/g, "").split("\n");
    let html = "";
    let para = [];
    let list = null;
    let code = null;
    let section = "core";
    const termPen = opts.highlighters ? makePens() : null;
    const pen = termPen ? (t) => (section === "traps" ? "hl-orange" : termPen(t)) : null;
    const fmt = (str) => inline(str, pen);
    // The worked example's answer gets a green highlight: a "So / Therefore / Answer"
    // line if there is one, otherwise the example's last line.
    let exampleAnswered = false;
    let lastExamplePara = null;
    const fmtLine = (str) => {
      if (pen && section === "example" && ANSWER_LINE.test(str)) { exampleAnswered = true; return `<span class="hl-line">${fmt(str)}</span>`; }
      return fmt(str);
    };
    const flushPara = () => {
      if (!para.length) return;
      const start = html.length;
      html += `<p>${para.map(fmtLine).join("<br>")}</p>`;
      if (section === "example") lastExamplePara = { start, end: html.length, lines: para };
      para = [];
    };
    const leaveExample = () => {
      const last = lastExamplePara;
      if (!pen || section !== "example" || exampleAnswered || !last || last.end !== html.length) return;
      const n = last.lines.length - 1;
      html = html.slice(0, last.start) + `<p>${last.lines.map((l, i) => (i === n ? `<span class="hl-line">${fmt(l)}</span>` : fmt(l))).join("<br>")}</p>`;
      exampleAnswered = true;
    };
    const flushList = () => {
      if (list) { html += `<ul${pen && section === "traps" ? ' class="traps"' : ""}>${list.map((i) => `<li>${fmtLine(i)}</li>`).join("")}</ul>`; list = null; }
    };

    for (const raw of lines) {
      if (code !== null) {
        if (raw.trim().startsWith("```")) { html += `<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`; code = null; }
        else code.push(raw);
        continue;
      }
      const line = raw.trim();
      if (line.startsWith("```")) { flushPara(); flushList(); code = []; continue; }
      if (!line) { flushPara(); flushList(); continue; }

      const bullet = line.match(/^[-*•]\s+(.*)/);
      if (bullet) { flushPara(); (list ||= []).push(bullet[1]); continue; }
      flushList();

      const remember = line.match(/^\**\s*remember this\s*:?\s*\**\s*:?\s*(.*)$/i);
      if (remember) {
        flushPara();
        leaveExample();
        section = "remember";
        html += `<div class="sticky-note remember"><span class="tape" aria-hidden="true"></span><span class="label-small">Remember this</span>${inline(remember[1])}</div>`;
        continue;
      }
      const label = line.match(/^\**\s*(example|common traps?)\s*:?\s*\**\s*:?\s*(.*)$/i);
      if (label) {
        flushPara();
        leaveExample();
        section = /^example/i.test(label[1]) ? "example" : "traps";
        html += `<h4 class="label">${escapeHtml(label[1].replace(/^./, (c) => c.toUpperCase()))}</h4>`;
        if (label[2]) para.push(label[2]);
        continue;
      }
      para.push(line);
    }
    if (code !== null) html += `<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`;
    flushPara();
    leaveExample();
    flushList();
    return html;
  }

  async function api(url, body) {
    let res;
    try {
      res = await fetch(url, body ? {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      } : undefined);
    } catch {
      throw new Error(navigator.onLine === false
        ? "You're offline. The library still works, but writing something new needs internet."
        : "Could not reach inkwand. Check your internet connection and try again.");
    }
    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }
    if (!res.ok) {
      throw new Error(data && typeof data.detail === "string" ? data.detail : "Something went wrong. Please try again.");
    }
    return data;
  }

  function isLight(hex) {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return (r * 299 + g * 587 + b * 114) / 1000 > 165;
  }

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function toast(html) {
    const el = $("#toast");
    el.innerHTML = html;
    el.hidden = false;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 3800);
  }

  // ---------- saved progress (this browser only, no login) ----------
  const KEY = {
    stickers: "inkwand.stickers", progress: "inkwand.progress", days: "inkwand.days", log: "inkwand.log",
    mistakes: "inkwand.mistakes", scores: "inkwand.scores", report: "inkwand.report",
  };
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage off: still works, just forgets */ }
    },
  };

  function dateKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function markStudiedToday() {
    const days = store.get(KEY.days, []);
    const today = dateKey();
    if (!days.includes(today)) {
      days.push(today);
      store.set(KEY.days, days);
      renderCalendar();
    }
  }

  // What you did each day, shown when you hover a ticked date on the calendar.
  // Entries: { kind: notes | paper | cards | chapter | stickers, ref, label, book, score?, n? }
  function logActivity(entry) {
    const log = store.get(KEY.log, {});
    const list = (log[dateKey()] ||= []);
    if (entry.n) {
      const e = list.find((x) => x.kind === entry.kind);
      if (e) e.n += entry.n; else list.push(entry);
    } else if (entry.kind === "paper" || !list.some((x) => x.kind === entry.kind && x.ref === entry.ref)) {
      list.push(entry);
    }
    store.set(KEY.log, log);
    markStudiedToday();
    renderCalendar();
  }

  function about(ctx) {
    return {
      ref: `${ctx.book.id}/${ctx.topic ? "ask:" + ctx.topic : ctx.chapter.id}`,
      label: ctx.topic || ctx.chapter.title,
      book: ctx.book.short,
    };
  }

  // stickers
  function stickerCounts() { return store.get(KEY.stickers, {}); }
  function stickerTotal() { return Object.values(stickerCounts()).reduce((a, b) => a + b, 0); }

  function awardSticker(type) {
    const counts = stickerCounts();
    counts[type] = (counts[type] || 0) + 1;
    store.set(KEY.stickers, counts);
    logActivity({ kind: "stickers", n: 1 });
    renderBadge(type);
    renderStickerSheet();
  }

  function renderBadge(lastType) {
    const el = $("#stars");
    $("[data-stars]", el).textContent = stickerTotal();
    $("[data-badge-sticker]", el).innerHTML = STICKERS[lastType || "star"].svg;
    if (lastType) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  }

  function renderStickerSheet() {
    const counts = stickerCounts();
    $("#sheet-grid").innerHTML = Object.entries(STICKERS).map(([id, s], i) => {
      const n = counts[id] || 0;
      return `<div class="sheet-cell${n ? "" : " empty-slot"}" style="--r:${[-6, 4, -3, 7, -5][i]}deg" title="${escapeHtml(s.name)}">
          <span class="sheet-art">${s.svg}</span>
          <span class="sheet-count">${n ? "&times;" + n : "&nbsp;"}</span>
          <span class="sheet-name">${escapeHtml(s.name)}</span>
        </div>`;
    }).join("");
  }

  // chapter progress: notes read, paper finished, every card flipped
  function chapterParts(bookId, chapterId) {
    return store.get(KEY.progress, {})[`${bookId}/${chapterId}`] || {};
  }
  function isChapterDone(bookId, chapterId) {
    const p = chapterParts(bookId, chapterId);
    return TABS.every((t) => p[t]);
  }
  function bookProgress(book) {
    const all = store.get(KEY.progress, {});
    let parts = 0;
    let done = 0;
    for (const c of book.chapters) {
      const p = all[`${book.id}/${c.id}`] || {};
      parts += TABS.filter((t) => p[t]).length;
      if (TABS.every((t) => p[t])) done++;
    }
    return { done, total: book.chapters.length, pct: Math.round((parts / (book.chapters.length * TABS.length)) * 100) };
  }

  function markPart(book, chapter, part) {
    markStudiedToday();
    if (!chapter) return; // custom topics don't count towards a chapter
    const all = store.get(KEY.progress, {});
    const key = `${book.id}/${chapter.id}`;
    const p = (all[key] ||= {});
    if (p[part]) return;
    p[part] = true;
    store.set(KEY.progress, all);
    renderBookProgress(book);
    if (TABS.every((t) => p[t])) {
      logActivity({ kind: "chapter", ref: key, label: chapter.title, book: book.short });
      setPageTitle(chapter.title, book, chapter, true);
      toast(`${ICON.greenTick}<span><b>Chapter complete!</b> ${escapeHtml(chapter.title)} gets a green tick.</span>`);
    } else {
      const left = TABS.filter((t) => !p[t]).map((t) => WORDS[t].what);
      const what = WORDS[part].what;
      toast(`${ICON.greenTick}<span>${escapeHtml(what[0].toUpperCase() + what.slice(1))} done. Left in this chapter: ${left.join(", ")}.</span>`);
    }
  }

  // ---------- calendar ----------
  function renderCalendar() {
    const now = new Date();
    if (!state.cal) state.cal = { y: now.getFullYear(), m: now.getMonth() };
    const { y, m } = state.cal;
    const days = new Set(store.get(KEY.days, []));
    const first = new Date(y, m, 1);
    const inMonth = new Date(y, m + 1, 0).getDate();
    const todayKey = dateKey(now);

    $("#cal-title").textContent = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    let html = ["S", "M", "T", "W", "T", "F", "S"].map((d) => `<span class="cal-dow" role="columnheader">${d}</span>`).join("");
    for (let i = 0; i < first.getDay(); i++) html += `<span class="cal-day blank"></span>`;
    let studiedThisMonth = 0;
    for (let d = 1; d <= inMonth; d++) {
      const key = dateKey(new Date(y, m, d));
      const studied = days.has(key);
      if (studied) studiedThisMonth++;
      const cls = ["cal-day", studied && "studied", key === todayKey && "today", key > todayKey && "future"].filter(Boolean).join(" ");
      const col = (first.getDay() + d - 1) % 7;
      html += studied
        ? `<span class="${cls}" role="gridcell" tabindex="0" aria-label="${key}, studied"><span class="num">${d}</span>${ICON.greenTick}${dayNote(key, col)}</span>`
        : `<span class="${cls}" role="gridcell" aria-label="${key}"><span class="num">${d}</span></span>`;
    }
    $("#cal-grid").innerHTML = html;

    const { current, best } = streaks(days, now);
    $("#cal-streak").innerHTML = current
      ? `<b>${current}-day streak!</b> Best: ${best}. Studied ${studiedThisMonth} day${studiedThisMonth === 1 ? "" : "s"} this month.`
      : `Study a little today to start your streak.${best ? ` Best so far: ${best} days.` : ""}`;
  }

  function describe(e) {
    const what = `<i>${escapeHtml(e.label || "")}</i>${e.book ? ` <span class="pop-book">${escapeHtml(e.book)}</span>` : ""}`;
    switch (e.kind) {
      case "notes": return `Read the notes on ${what}`;
      case "paper": return `Practice paper on ${what}, scored <b>${escapeHtml(e.score)}</b>`;
      case "cards": return `Flipped every flashcard on ${what}`;
      case "chapter": return `<b>Finished the chapter</b> ${what}`;
      case "stickers": return `Earned ${e.n} sticker${e.n === 1 ? "" : "s"}`;
      case "fixed": return `Corrected ${e.n} old mistake${e.n === 1 ? "" : "s"}`;
      default: return "Studied";
    }
  }

  function dayNote(key, col) {
    const list = store.get(KEY.log, {})[key] || [];
    // Chapters first, then papers, then the rest, stickers last.
    const order = { chapter: 0, paper: 1, fixed: 2, notes: 3, cards: 4, stickers: 5 };
    const sorted = [...list].sort((a, b) => order[a.kind] - order[b.kind]);
    const shown = sorted.slice(0, 7);
    const items = shown.length
      ? shown.map((e) => `<li class="pop-${e.kind}">${describe(e)}</li>`).join("") + (sorted.length > 7 ? `<li>and ${sorted.length - 7} more</li>` : "")
      : `<li>You studied this day.</li>`;
    const nice = new Date(key + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    const side = col < 2 ? " pop-left" : col > 4 ? " pop-right" : "";
    return `<span class="cal-pop${side}" role="tooltip"><span class="pop-date">${nice}</span><ul>${items}</ul></span>`;
  }

  function streaks(days, now) {
    // Current streak counts back from today, or from yesterday if today isn't done yet.
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!days.has(dateKey(d))) d.setDate(d.getDate() - 1);
    let current = 0;
    while (days.has(dateKey(d))) { current++; d.setDate(d.getDate() - 1); }

    const sorted = [...days].sort();
    let best = 0;
    let run = 0;
    let prev = null;
    for (const k of sorted) {
      const t = new Date(k + "T00:00:00");
      run = prev && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = t;
    }
    return { current, best };
  }

  // ---------- routing ----------
  // #/                                 -> bookshelf
  // #/book/<book>/<chapter>/<tab>      -> a chapter
  // #/book/<book>/ask/<topic>/<tab>    -> a custom topic, written live
  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
    if (parts[0] === "mistakes") return { view: "mistakes" };
    if (parts[0] === "report") return { view: "report" };
    if (parts[0] !== "book" || !state.books[parts[1]]) return { view: "shelf" };
    const book = state.books[parts[1]];
    if (parts[2] === "ask" && parts[3]) {
      return { view: "book", book, topic: parts[3].slice(0, 150), tab: TABS.includes(parts[4]) ? parts[4] : "notes" };
    }
    const chapter = book.chapters.find((c) => c.id === parts[2]) || book.chapters[0];
    return { view: "book", book, chapter, tab: TABS.includes(parts[3]) ? parts[3] : "notes" };
  }

  function href(book, chapterOrTopic, tab, isTopic = false) {
    const mid = isTopic ? `ask/${encodeURIComponent(chapterOrTopic)}` : chapterOrTopic;
    return `#/book/${book}/${mid}/${tab}`;
  }

  function render() {
    const route = parseRoute();
    state.token++;
    $("#shelf-view").hidden = route.view !== "shelf";
    $("#book-view").hidden = route.view !== "book";
    $("#mistakes-view").hidden = route.view !== "mistakes";
    $("#report-view").hidden = route.view !== "report";
    if (route.view === "shelf") {
      document.title = `${state.config.site_name} · GATE CSE library`;
      renderShelves();
      renderCalendar();
      renderSlips();
      return;
    }
    if (route.view === "mistakes") { document.title = `Mistakes notebook · ${state.config.site_name}`; renderMistakes(); return; }
    if (route.view === "report") { document.title = `Report card · ${state.config.site_name}`; renderReport(); return; }
    renderBook(route);
  }

  // ---------- bookshelf ----------
  function renderShelves() {
    const c = state.config;
    const sizes = [[205, 58], [196, 52], [218, 62], [194, 54], [190, 60], [212, 50], [198, 64], [188, 56]];
    const tilts = ["0deg", "-1deg", "0deg", "1.2deg", "0deg", "-.6deg", "0deg", "1.5deg"];
    let i = 0;
    $("#shelves").innerHTML = c.shelves.map((shelf) => {
      const books = c.books.filter((b) => b.shelf === shelf.id);
      const spines = books.map((b) => {
        const [h, w] = sizes[i % sizes.length];
        const tilt = tilts[i++ % tilts.length];
        const prog = bookProgress(b);
        return `<a class="book-spine${isLight(b.color) ? " light" : ""}" href="${href(b.id, b.chapters[0].id, "notes")}"
            style="--book:${b.color};--h:${h}px;--w:${w}px;--tilt:${tilt}" title="${escapeHtml(b.title)}: ${prog.done} of ${prog.total} chapters done"
            aria-label="Open ${escapeHtml(b.title)}. ${prog.done} of ${prog.total} chapters done.">
            <span class="band"></span>
            <span class="spine-title">${escapeHtml(b.short)}</span>
            <span class="spine-progress" aria-hidden="true"><i style="height:${prog.pct}%"></i></span>
            <span class="spine-count">${prog.done ? `${prog.done}/` : ""}${b.chapters.length}</span>
            ${prog.done === prog.total ? `<span class="spine-done">${ICON.greenTick}</span>` : ""}
          </a>`;
      }).join("");
      const special = shelf === c.shelves[0] ? mistakesSpine() : "";
      return `<div class="shelf">
          <div class="shelf-books">${spines}${special}${ICON.bookend}</div>
          <div class="plank"></div>
          <span class="shelf-label">${escapeHtml(shelf.title)}</span>
        </div>`;
    }).join("");
  }

  // ---------- clicking a book: pull it out, then open it ----------
  const PULL_MS = 280;   // hover lift is 180ms; the pull is a touch slower
  const FLY_MS = 380;
  const OPEN_MS = 520;
  let opening = false;

  function wireShelfClicks() {
    $("#shelves").addEventListener("click", (e) => {
      const spine = e.target.closest(".book-spine");
      if (!spine || spine.dataset.special || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !Element.prototype.animate) return;
      e.preventDefault();
      if (!opening) openBook(spine);
    });
  }

  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
  // Run an animation and wait for it, but never longer than its own duration
  // (some browsers don't settle .finished for hidden or throttled tabs).
  function play(el, frames, opts) {
    const anim = el.animate(frames, opts);
    return Promise.race([anim.finished.catch(() => {}), wait(opts.duration + 60)]);
  }

  async function openBook(spine) {
    opening = true;
    const target = spine.getAttribute("href");
    const book = state.books[target.split("/")[2]];
    try {
      spine.classList.add("pulling");
      await wait(PULL_MS);

      const overlay = document.createElement("div");
      overlay.className = "book-open";
      overlay.style.setProperty("--book", book.color);
      overlay.innerHTML = `
        <div class="ob-book">
          <div class="ob-pages">
            <span class="ob-title">${escapeHtml(book.title)}</span>
            <span class="ob-sub">${book.chapters.length} chapters · notes, papers, flashcards</span>
          </div>
          <div class="ob-cover${isLight(book.color) ? " light" : ""}">
            <span class="band"></span>
            <span class="ob-cover-title">${escapeHtml(book.title)}</span>
            <span class="band"></span>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const bookEl = $(".ob-book", overlay);
      const cover = $(".ob-cover", overlay);

      // Fly from where the spine sits on the shelf to the middle of the screen,
      // turning from its spine to its front cover on the way.
      const from = spine.getBoundingClientRect();
      const to = bookEl.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      const sy = from.height / to.height;
      overlay.animate([{ backgroundColor: "rgba(255,254,250,0)" }, { backgroundColor: "rgba(255,254,250,.55)" }], { duration: FLY_MS, fill: "both" });
      await play(bookEl, [
        { transform: `translate(${dx}px, ${dy}px) scale(${sy}) rotateY(-80deg)` },
        { transform: "translate(0, 0) scale(1) rotateY(0deg)" },
      ], { duration: FLY_MS, easing: "cubic-bezier(.2,.8,.3,1)", fill: "both" });

      // Swing the cover open on its spine.
      await play(cover, [
        { transform: "rotateY(0deg)" },
        { transform: "rotateY(-165deg)" },
      ], { duration: OPEN_MS, easing: "cubic-bezier(.45,.05,.35,1)", fill: "both" });

      location.hash = target;
      await play(overlay, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "both" });
    } finally {
      $$(".book-open").forEach((el) => el.remove());
      spine.classList.remove("pulling");
      opening = false;
      if (location.hash !== target) location.hash = target;
    }
  }

  // ---------- open book ----------
  let shownBook = null;

  function renderBookProgress(book) {
    const p = bookProgress(book);
    const el = $("#book-progress");
    $("[data-fill]", el).style.width = `${p.pct}%`;
    $("[data-progress-text]", el).textContent = `${p.done} of ${p.total} chapters done · ${p.pct}%`;
    $$("#chapter-list a").forEach((a) => {
      const done = isChapterDone(book.id, a.dataset.chapter);
      a.classList.toggle("done", done);
      $(".tick-slot", a).innerHTML = done ? ICON.greenTick : "";
    });
  }

  function setPageTitle(title, book, chapter, justDone) {
    const done = chapter && isChapterDone(book.id, chapter.id);
    $("#page-title").innerHTML = escapeHtml(title) + (done
      ? `<span class="title-tick${justDone ? " just-done" : ""}" title="You have covered this chapter">${ICON.greenTick}<span>covered</span></span>`
      : "");
  }

  function renderTabTicks(book, chapter) {
    const p = chapter ? chapterParts(book.id, chapter.id) : {};
    $$(".page-tab").forEach((t) => t.classList.toggle("part-done", !!p[t.dataset.tab]));
  }

  function renderBook(route) {
    const { book, chapter, topic, tab } = route;
    document.documentElement.style.setProperty("--book", book.color);

    if (shownBook !== book.id) {
      shownBook = book.id;
      $("#book-title").textContent = book.title;
      $("#chapter-list").innerHTML = book.chapters
        .map((c) => `<li><a href="${href(book.id, c.id, "notes")}" data-chapter="${c.id}"><span class="ch-title">${escapeHtml(c.title)}</span><span class="tick-slot"></span></a></li>`)
        .join("");
      $("#ask-topic").placeholder = `e.g. a topic from ${book.short}`;
      $("#ask-topic").value = "";
      // On phones, keep the contents folded once a chapter is open.
      $("#contents-details").open = !window.matchMedia("(max-width: 860px)").matches;
    }
    renderBookProgress(book);
    $$("#chapter-list a").forEach((a) => {
      if (chapter && a.dataset.chapter === chapter.id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    const title = topic || chapter.title;
    $("#page-kicker").textContent = topic ? `${book.title} · your question` : `${book.title} · chapter ${book.chapters.indexOf(chapter) + 1} of ${book.chapters.length}`;
    setPageTitle(title, book, chapter, false);
    document.title = `${title} · ${state.config.site_name}`;
    $(".part-rule").hidden = !!topic;

    $$(".page-tab").forEach((t) => {
      const selected = t.dataset.tab === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
      t.onclick = () => { location.hash = href(book.id, topic || chapter.id, t.dataset.tab, !!topic); };
    });
    renderTabTicks(book, chapter);

    const ctx = { book, chapter, topic, tab, token: state.token };
    ctx.key = `${book.id}/${topic ? "ask:" + topic : chapter.id}/${tab}`;
    loadPage(ctx);
  }

  async function loadPage(ctx) {
    const body = $("#page-body");
    const fresh = state.fresh.get(ctx.key);
    if (fresh) return drawPage(ctx, fresh, true);
    if (state.writing.has(ctx.key)) return showWriting(body);

    if (ctx.topic) return writeLive(ctx); // custom topics are always written live

    body.innerHTML = `<p class="deck-hint">opening the book...</p>`;
    let data;
    try {
      data = await getChapter(ctx.book.id, ctx.chapter.id);
    } catch (err) {
      if (ctx.token !== state.token) return;
      body.innerHTML = `<div class="oops">${escapeHtml(err.message)}</div>`;
      return;
    }
    if (ctx.token !== state.token) return;
    const value = data[ctx.tab];
    if (value && value.length) drawPage(ctx, value, false);
    else drawEmpty(ctx);
  }

  function getChapter(bookId, chapterId) {
    const key = `${bookId}/${chapterId}`;
    if (!state.chapters.has(key)) {
      const p = api(`/api/library/${bookId}/${chapterId}`).catch((err) => { state.chapters.delete(key); throw err; });
      state.chapters.set(key, p);
    }
    return state.chapters.get(key);
  }

  const WORDS = {
    notes: { what: "notes", fresh: "Explain it differently" },
    practice: { what: "practice paper", fresh: "Write me a fresh paper" },
    flashcards: { what: "flashcards", fresh: "Make a fresh deck" },
  };

  function drawEmpty(ctx) {
    $("#page-body").innerHTML = `
      <div class="empty">
        <p>The ${WORDS[ctx.tab].what} for this chapter ${ctx.tab === "flashcards" ? "haven't" : "hasn't"} been written yet.</p>
        <button class="btn" data-write>Write ${ctx.tab === "flashcards" ? "them" : "it"} now</button>
        <p class="writing-sub">Takes about a minute. Gemma thinks carefully before it writes.</p>
      </div>`;
    $("[data-write]").onclick = () => writeLive(ctx);
  }

  function showWriting(body) {
    body.innerHTML = `
      <div class="writing" role="status">
        ${ICON.pencil}
        <p class="writing-text">writing<span class="dots"></span></p>
        <p class="writing-sub">Fresh pages take about a minute. Gemma thinks it through before it writes. You can read another chapter meanwhile.</p>
      </div>`;
  }

  async function writeLive(ctx) {
    const body = $("#page-body");
    const key = ctx.key;
    if (state.writing.has(key)) return showWriting(body);
    state.writing.add(key);
    showWriting(body);
    try {
      const payload = { book: ctx.book.id, kind: ctx.tab };
      if (ctx.topic) payload.topic = ctx.topic; else payload.chapter = ctx.chapter.id;
      const data = await api("/api/generate", payload);
      state.fresh.set(key, data.content);
      if (ctx.token === state.token) drawPage(ctx, data.content, true);
    } catch (err) {
      if (ctx.token === state.token) {
        body.innerHTML = `<div class="oops">${escapeHtml(err.message)}</div><button class="btn" data-retry>Try again</button>`;
        $("[data-retry]").onclick = () => writeLive(ctx);
      }
    } finally {
      state.writing.delete(key);
    }
  }

  function drawPage(ctx, value, isFresh) {
    const body = $("#page-body");
    const badge = isFresh ? `<span class="fresh-badge">freshly written</span>` : "";
    let html = badge;
    if (ctx.tab === "notes") html += `<div class="notes">${formatText(value, { highlighters: true })}</div>`;
    else if (ctx.tab === "practice") html += paperHtml(value);
    else html += deckHtml(value);

    html += `
      <div class="page-actions">
        <button class="btn quiet small" data-fresh>${WORDS[ctx.tab].fresh}</button>
      </div>
      <p class="ai-note">Written by Gemma, an open model, and checked by no one but you. If something looks off, trust your textbook.</p>`;
    body.innerHTML = html;
    $("[data-fresh]", body).onclick = () => { state.fresh.delete(ctx.key); writeLive(ctx); };

    if (ctx.tab === "notes") watchNotesRead(ctx, body);
    if (ctx.tab === "practice") wirePaper(ctx, body, value);
    if (ctx.tab === "flashcards") wireDeck(ctx, body, value);
  }

  // Notes count as read once the end of the page has been on screen
  // and the student has spent a little time on it.
  const READ_SECONDS = 15;
  function watchNotesRead(ctx, body) {
    if (!("IntersectionObserver" in window)) { logActivity({ kind: "notes", ...about(ctx) }); markPart(ctx.book, ctx.chapter, "notes"); return; }
    const openedAt = Date.now();
    const end = $(".ai-note", body);
    const obs = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      obs.disconnect();
      const wait = Math.max(0, READ_SECONDS * 1000 - (Date.now() - openedAt));
      setTimeout(() => {
        if (ctx.token === state.token) {
          logActivity({ kind: "notes", ...about(ctx) });
          markPart(ctx.book, ctx.chapter, "notes");
          renderTabTicks(ctx.book, ctx.chapter);
        }
      }, wait);
    });
    obs.observe(end);
  }

  // ---------- practice paper ----------
  function paperHtml(questions) {
    const qs = questions.map((q, i) => `
      <div class="mcq" data-q="${i}">
        <div class="q-text"><span class="q-num">Q${i + 1}.</span><div>${formatText(q.question)}</div></div>
        <ul class="options">
          ${q.options.map((o, j) => `<li><button class="option" data-opt="${j}"><span class="opt-letter">${"ABCD"[j]}.</span>${inline(o)}</button></li>`).join("")}
        </ul>
        <div class="explain-slot"></div>
      </div>`).join("");
    return `<div class="paper"><div class="paper-head"><span>${questions.length} questions · a sticker for every right answer</span><span data-progress>0 / ${questions.length} answered</span></div>${qs}<div class="score-slot"></div></div>`;
  }

  function slapSticker(card, type) {
    const tilt = Math.round(Math.random() * 24 - 12);
    card.insertAdjacentHTML("beforeend",
      `<span class="reward-sticker" style="--tilt:${tilt}deg" title="${escapeHtml(STICKERS[type].name)}">${STICKERS[type].svg}</span>`);
  }

  function wirePaper(ctx, body, questions) {
    let answered = 0;
    let right = 0;
    const paper = $(".paper", body);
    paper.addEventListener("click", (e) => {
      const opt = e.target.closest(".option");
      if (!opt || opt.disabled) return;
      const card = opt.closest(".mcq");
      const q = questions[Number(card.dataset.q)];
      const chosen = Number(opt.dataset.opt);
      const ok = chosen === q.correct_index;

      $$(".option", card).forEach((b) => {
        b.disabled = true;
        const j = Number(b.dataset.opt);
        if (j === q.correct_index) { b.classList.add("correct"); b.insertAdjacentHTML("beforeend", ICON.tick + (ok ? ICON.burst : "")); }
        else if (j === chosen) { b.classList.add("chosen-wrong"); b.insertAdjacentHTML("beforeend", ICON.cross); }
      });
      $(".explain-slot", card).innerHTML = `
        <div class="explain"><p class="verdict">${ok ? pick(["Correct, nicely done!", "Well done!", "Spot on!", "Excellent!"]) : `Not quite. The answer is ${"ABCD"[q.correct_index]}.`}</p>${formatText(q.explanation)}</div>`;

      answered++;
      markStudiedToday();
      if (!ok) addMistake(ctx, q, chosen);
      if (ok) {
        right++;
        const type = pick(STICKER_BAG);
        slapSticker(card, type);
        awardSticker(type);
      }
      $("[data-progress]", paper).textContent = `${answered} / ${questions.length} answered`;
      if (answered === questions.length) {
        const full = right === questions.length;
        const msg = full ? "Full marks! Here's a trophy. Go take a water break."
          : right >= questions.length / 2 ? "Good going. Read the notes once more for the ones you missed."
          : "Every mistake here is one you won't make in the exam. Read the notes and try a fresh paper.";
        $(".score-slot", paper).innerHTML = `
          <div class="score-card"><span class="score-circle">${right}/${questions.length}${ICON.circle}</span><p>${msg}</p></div>`;
        logActivity({ kind: "paper", ...about(ctx), score: `${right}/${questions.length}` });
        if (ctx.chapter) saveScore(ctx.book, ctx.chapter, right, questions.length);
        if (full) { slapSticker($(".score-card", paper), "cup"); awardSticker("cup"); }
        if (ctx.chapter) { markPart(ctx.book, ctx.chapter, "practice"); renderTabTicks(ctx.book, ctx.chapter); }
      }
    });
  }

  // ---------- mistakes notebook ----------
  // Every wrong answer is copied here. Answer it right later and it gets corrected.
  function mistakeId(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return "m" + (h >>> 0).toString(36);
  }

  function addMistake(ctx, q, chosen) {
    const list = store.get(KEY.mistakes, []);
    const id = mistakeId(q.question);
    const existing = list.find((m) => m.id === id);
    if (existing) { existing.fixed = false; existing.chosen = chosen; existing.at = Date.now(); }
    else {
      list.push({
        id, book: ctx.book.id, bookShort: ctx.book.short, where: ctx.topic || ctx.chapter.title,
        question: q.question, options: q.options, correct_index: q.correct_index, explanation: q.explanation,
        chosen, at: Date.now(), fixed: false,
      });
    }
    store.set(KEY.mistakes, list);
  }

  function openMistakes() { return store.get(KEY.mistakes, []).filter((m) => !m.fixed); }

  function mistakesSpine() {
    const n = openMistakes().length;
    return `<a class="book-spine special-spine" data-special="mistakes" href="#/mistakes"
        style="--book:#c2185b;--h:186px;--w:50px;--tilt:-2deg" title="Mistakes notebook: ${n} to correct"
        aria-label="Open the mistakes notebook. ${n} to correct.">
        <span class="band"></span>
        <span class="spine-title">Mistakes</span>
        <span class="spine-count">${n}</span>
      </a>`;
  }

  function renderSlips() {
    const n = openMistakes().length;
    const total = store.get(KEY.mistakes, []).length;
    $("[data-mistake-count]").textContent = n ? `${n} to correct` : total ? "All corrected!" : "No mistakes yet";
  }

  function renderMistakes() {
    const all = store.get(KEY.mistakes, []);
    const open = all.filter((m) => !m.fixed).sort((a, b) => b.at - a.at);
    const fixed = all.filter((m) => m.fixed).sort((a, b) => (b.fixedAt || 0) - (a.fixedAt || 0));
    const body = $("#mistakes-body");
    if (!all.length) {
      body.innerHTML = `<div class="empty"><p>No mistakes yet. Every question you get wrong in a practice paper lands here, so you can come back and correct it later.</p><a class="btn" href="#/">Go practise</a></div>`;
      return;
    }
    const card = (m) => `
      <div class="mcq mistake" data-mid="${m.id}">
        <p class="mistake-from">${escapeHtml(m.bookShort)} · ${escapeHtml(m.where)}</p>
        <div class="q-text"><div>${formatText(m.question)}</div></div>
        <ul class="options">
          ${m.options.map((o, j) => `<li><button class="option" data-opt="${j}"><span class="opt-letter">${"ABCD"[j]}.</span>${inline(o)}</button></li>`).join("")}
        </ul>
        <div class="explain-slot"></div>
      </div>`;
    body.innerHTML = `
      <p class="paper-head"><span>${open.length ? `${open.length} to correct. Get one right and it's crossed off.` : "All corrected. Nice work!"}</span></p>
      <div class="paper mistakes-list">${open.map(card).join("")}</div>
      ${fixed.length ? `<details class="fixed-list"><summary>Corrected (${fixed.length})</summary>
        <ul>${fixed.map((m) => `<li><span class="struck">${inline(m.question.split("\n")[0].slice(0, 140))}</span> ${ICON.greenTick}</li>`).join("")}</ul>
      </details>` : ""}`;

    $(".mistakes-list", body).addEventListener("click", (e) => {
      const opt = e.target.closest(".option");
      if (!opt || opt.disabled) return;
      const cardEl = opt.closest(".mcq");
      const list = store.get(KEY.mistakes, []);
      const m = list.find((x) => x.id === cardEl.dataset.mid);
      if (!m) return;
      const chosen = Number(opt.dataset.opt);
      const ok = chosen === m.correct_index;
      $$(".option", cardEl).forEach((b) => {
        b.disabled = true;
        const j = Number(b.dataset.opt);
        if (j === m.correct_index) { b.classList.add("correct"); b.insertAdjacentHTML("beforeend", ICON.tick + (ok ? ICON.burst : "")); }
        else if (j === chosen) { b.classList.add("chosen-wrong"); b.insertAdjacentHTML("beforeend", ICON.cross); }
      });
      $(".explain-slot", cardEl).innerHTML = `<div class="explain"><p class="verdict">${ok ? "Corrected! Crossing this one off." : `Still tricky. The answer is ${"ABCD"[m.correct_index]}.`}</p>${formatText(m.explanation)}</div>`;
      markStudiedToday();
      if (ok) {
        m.fixed = true; m.fixedAt = Date.now();
        store.set(KEY.mistakes, list);
        cardEl.classList.add("corrected");
        cardEl.insertAdjacentHTML("beforeend", `<span class="corrected-stamp">${ICON.greenTick}<span>corrected</span></span>`);
        awardSticker("star");
        logActivity({ kind: "fixed", n: 1 });
      } else {
        m.chosen = chosen; m.at = Date.now();
        store.set(KEY.mistakes, list);
      }
    });
  }

  // ---------- report card ----------
  function saveScore(book, chapter, right, total) {
    const all = store.get(KEY.scores, {});
    const key = `${book.id}/${chapter.id}`;
    const prev = all[key] || { right: 0, total: 0, papers: 0 };
    all[key] = { right: prev.right + right, total: prev.total + total, papers: prev.papers + 1 };
    store.set(KEY.scores, all);
  }

  function subjectStats(book) {
    const prog = bookProgress(book);
    const scores = store.get(KEY.scores, {});
    let right = 0, total = 0, papers = 0;
    for (const c of book.chapters) {
      const s = scores[`${book.id}/${c.id}`];
      if (s) { right += s.right; total += s.total; papers += s.papers; }
    }
    const avg = total ? Math.round((right / total) * 100) : null;
    return { book, done: prog.done, chapters: prog.total, pct: prog.pct, avg, papers, started: prog.pct > 0 || papers > 0 };
  }

  function gradeFor(s) {
    if (!s.started) return { grade: "–", label: "Not started yet" };
    const score = s.avg === null ? s.pct : Math.round(0.5 * s.pct + 0.5 * s.avg);
    if (score >= 85) return { grade: "A+", label: "Outstanding" };
    if (score >= 70) return { grade: "A", label: "Very good" };
    if (score >= 55) return { grade: "B", label: "Good" };
    if (score >= 40) return { grade: "C", label: "Getting there" };
    return { grade: "New", label: "Just getting started" };
  }

  function reportPayload(stats) {
    const days = new Set(store.get(KEY.days, []));
    return {
      subjects: stats.filter((s) => s.started).map((s) => ({
        book: s.book.id, chapters_done: s.done, progress_pct: s.pct, avg_score_pct: s.avg, papers: s.papers,
      })),
      days_studied: days.size,
      streak: streaks(days, new Date()).current,
      stickers: stickerTotal(),
    };
  }

  function renderReport() {
    const stats = state.config.books.map(subjectStats);
    const started = stats.filter((s) => s.started);
    const payload = reportPayload(stats);
    const saved = store.get(KEY.report, null);
    const fresh = saved && saved.sig === JSON.stringify(payload);
    const remarks = saved ? Object.fromEntries(saved.subjects.map((r) => [r.book, r.remark])) : {};
    $("#report-term").textContent = `Term: ${new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })} · Days studied: ${payload.days_studied} · Stickers: ${payload.stickers}`;

    const rows = stats.map((s) => {
      const g = gradeFor(s);
      return `<tr class="${s.started ? "" : "not-started"}">
          <th scope="row"><span class="subj-dot" style="--book:${s.book.color}"></span>${escapeHtml(s.book.title)}</th>
          <td>${s.done}/${s.chapters}<span class="sub"> ${s.pct}% done</span></td>
          <td>${s.avg === null ? "–" : `${s.avg}%`}${s.papers ? `<span class="sub"> ${s.papers} paper${s.papers === 1 ? "" : "s"}</span>` : ""}</td>
          <td class="grade grade-${g.grade === "A+" ? "ap" : g.grade.toLowerCase().replace("–", "none")}" title="${g.label}">${g.grade}</td>
          <td class="remark">${s.started && remarks[s.book.id] ? escapeHtml(remarks[s.book.id]) : `<span class="sub">${g.label}</span>`}</td>
        </tr>`;
    }).join("");

    let teacher;
    if (!started.length) {
      teacher = `<p class="report-note">Finish a practice paper or read some notes, and your class teacher will have something to say.</p>`;
    } else if (saved) {
      teacher = `<div class="teacher-remark"><p class="remark-label">Class teacher's remark</p>
          <p class="red-pen">${escapeHtml(saved.overall)}</p>
          <p class="signed">Signed, Gemma <span class="stamp">inkwand</span></p></div>
        <p class="report-note">${fresh ? `Written ${new Date(saved.at).toLocaleDateString()}.` : "You've studied more since these remarks."}
          <button class="btn small quiet" data-ask-teacher>${fresh ? "Ask for fresh remarks" : "Ask for updated remarks"}</button></p>`;
    } else {
      teacher = `<p class="report-note"><button class="btn" data-ask-teacher>Ask the class teacher for remarks</button>
        <span class="sub">Gemma reads your progress and writes a note for each subject. Takes about a minute.</span></p>`;
    }

    $("#report-body").innerHTML = `
      <table class="report-table">
        <thead><tr><th scope="col">Subject</th><th scope="col">Chapters</th><th scope="col">Avg score</th><th scope="col">Grade</th><th scope="col">Teacher's remark</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="report-foot" id="report-foot">${teacher}</div>`;

    const ask = $("[data-ask-teacher]");
    if (ask) ask.onclick = () => askTeacher(payload);
  }

  async function askTeacher(payload) {
    const foot = $("#report-foot");
    const token = state.token;
    foot.innerHTML = `<div class="writing" role="status">${ICON.pencil}<p class="writing-text">writing remarks<span class="dots"></span></p>
      <p class="writing-sub">Your class teacher is reading your progress. Takes about a minute.</p></div>`;
    try {
      const data = await api("/api/report", payload);
      store.set(KEY.report, { ...data, at: Date.now(), sig: JSON.stringify(payload) });
      if (token === state.token) renderReport();
    } catch (err) {
      if (token === state.token) {
        foot.innerHTML = `<div class="oops">${escapeHtml(err.message)}</div><button class="btn" data-ask-teacher>Try again</button>`;
        $("[data-ask-teacher]").onclick = () => askTeacher(payload);
      }
    }
  }

  // ---------- offline ----------
  async function setupOffline() {
    const note = $("#offline-status");
    const show = (text) => { note.textContent = text; note.hidden = false; };
    window.addEventListener("offline", () => toast(`<span><b>You're offline.</b> The whole library still works. Writing something new needs internet.</span>`));
    window.addEventListener("online", () => toast(`<span>Back online.</span>`));
    if (!("serviceWorker" in navigator) || !("caches" in window)) return;
    try {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const total = state.config.books.reduce((n, b) => n + b.chapters.length, 0);
      for (let i = 0; i < 30; i++) {
        const keys = await (await caches.open("inkwand-v1")).keys();
        const saved = keys.filter((r) => new URL(r.url).pathname.startsWith("/api/library/")).length;
        if (saved >= total) { show(`Works offline: all ${total} chapters are saved on this device.`); return; }
        await wait(1000);
      }
    } catch { /* offline support is a bonus; the site works without it */ }
  }

  // ---------- flashcards ----------
  function deckHtml(cards) {
    return `
      <div class="deck">
        <p class="deck-count" data-count></p>
        <button class="flashcard" data-card aria-live="polite">
          <div class="flashcard-inner">
            <div class="face front"><span class="face-tag">question</span><div data-front></div></div>
            <div class="face back"><span class="face-tag">answer</span><div data-back></div></div>
          </div>
        </button>
        <p class="deck-hint">Tap the card to flip it. Arrow keys work too.</p>
        <div class="deck-nav">
          <button class="btn small quiet" data-prev>&larr; Back</button>
          <button class="btn small quiet" data-shuffle>Shuffle</button>
          <button class="btn small" data-next>Next &rarr;</button>
        </div>
      </div>`;
  }

  let deckKeys = null;

  function wireDeck(ctx, body, cards) {
    let order = cards.map((_, i) => i);
    let pos = 0;
    const flipped = new Set();
    const card = $("[data-card]", body);
    const count = () => { $("[data-count]", body).textContent = `card ${pos + 1} of ${cards.length} · ${flipped.size} flipped`; };
    const show = () => {
      const c = cards[order[pos]];
      card.classList.remove("flipped");
      $("[data-front]", body).innerHTML = formatText(c.front);
      // Wait for the flip back before swapping the answer, so it never flashes.
      setTimeout(() => { $("[data-back]", body).innerHTML = formatText(c.back); }, 150);
      count();
    };
    const flip = () => {
      card.classList.toggle("flipped");
      if (card.classList.contains("flipped") && !flipped.has(order[pos])) {
        flipped.add(order[pos]);
        count();
        markStudiedToday();
        if (flipped.size === cards.length) {
          logActivity({ kind: "cards", ...about(ctx) });
          if (ctx.chapter) { markPart(ctx.book, ctx.chapter, "flashcards"); renderTabTicks(ctx.book, ctx.chapter); }
        }
      }
    };
    const step = (d) => { pos = (pos + d + cards.length) % cards.length; show(); };

    card.onclick = flip;
    $("[data-prev]", body).onclick = () => step(-1);
    $("[data-next]", body).onclick = () => step(1);
    $("[data-shuffle]", body).onclick = () => {
      order = order.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
      pos = 0; show();
    };

    if (deckKeys) document.removeEventListener("keydown", deckKeys);
    deckKeys = (e) => {
      if (!document.body.contains(card) || e.target.matches("input, textarea")) return;
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", deckKeys);
    show();
  }

  // ---------- ask about any topic ----------
  function wireAskForm() {
    $("#ask-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const topic = $("#ask-topic").value.trim().replace(/\s+/g, " ");
      if (topic.length < 2) return;
      location.hash = href(shownBook, topic, "notes", true);
    });
  }

  // ---------- boot ----------
  async function init() {
    try {
      state.config = await api("/api/config");
    } catch (err) {
      $("#app").innerHTML = `<div class="oops">Could not open the library: ${escapeHtml(err.message)} Please refresh.</div>`;
      return;
    }
    const c = state.config;
    c.books.forEach((b) => (state.books[b.id] = b));
    $$("[data-site-name]").forEach((el) => (el.textContent = c.site_name));
    $("[data-board-title]").textContent = c.site_name;
    c.board_lines.forEach((line, i) => { const el = $(`[data-board-line="${i}"]`); if (el) el.textContent = line; });
    $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
    $$("[data-author]").forEach((el) => (el.textContent = c.author));
    $$("[data-link-github]").forEach((a) => a.setAttribute("href", c.github_url));
    $("[data-link-issues]").setAttribute("href", `${c.github_url}/issues/new`);
    $("[data-link-readme]").setAttribute("href", `${c.github_url}#how-it-works`);
    const license = $("[data-link-license]");
    license.textContent = c.license_name;
    license.setAttribute("href", `${c.github_url}/blob/main/LICENSE`);
    const dev = $("[data-link-dev]");
    if (c.dev_post_url) { dev.setAttribute("href", c.dev_post_url); dev.hidden = false; }
    // A few books to jump into from the footer, plus the whole shelf.
    const popular = ["algorithms", "os", "dbms", "toc", "cn"].map((id) => state.books[id]).filter(Boolean);
    $("#footer-books").innerHTML = popular
      .map((b) => `<li><a href="${href(b.id, b.chapters[0].id, "notes")}">${escapeHtml(b.title)}</a></li>`)
      .join("") + `<li><a href="#/">All ${c.books.length} subjects</a></li>`;

    renderBadge();
    renderStickerSheet();
    wireAskForm();
    wireShelfClicks();
    setupOffline();
    $$(".cal-nav").forEach((b) => b.addEventListener("click", () => {
      const d = new Date(state.cal.y, state.cal.m + Number(b.dataset.cal), 1);
      state.cal = { y: d.getFullYear(), m: d.getMonth() };
      renderCalendar();
    }));
    window.addEventListener("hashchange", () => { render(); window.scrollTo({ top: 0 }); });
    render();
  }

  init();
})();
