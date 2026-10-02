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

  function inline(s) {
    return escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, "$1<em>$2</em>");
  }

  // Safe formatter for model text: escape first, then allow bold, code,
  // bullet lists, code blocks and the "Example / Common traps / Remember this" labels.
  function formatText(text) {
    const lines = String(text).replace(/\r/g, "").split("\n");
    let html = "";
    let para = [];
    let list = null;
    let code = null;
    const flushPara = () => { if (para.length) { html += `<p>${para.map(inline).join("<br>")}</p>`; para = []; } };
    const flushList = () => { if (list) { html += `<ul>${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`; list = null; } };

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
        html += `<div class="sticky-note remember"><span class="tape" aria-hidden="true"></span><span class="label-small">Remember this</span>${inline(remember[1])}</div>`;
        continue;
      }
      const label = line.match(/^\**\s*(example|common traps?)\s*:?\s*\**\s*:?\s*(.*)$/i);
      if (label) {
        flushPara();
        html += `<h4 class="label">${escapeHtml(label[1].replace(/^./, (c) => c.toUpperCase()))}</h4>`;
        if (label[2]) para.push(label[2]);
        continue;
      }
      para.push(line);
    }
    if (code !== null) html += `<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`;
    flushPara();
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
      throw new Error("Could not reach inkwand. Check your internet connection and try again.");
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
  const KEY = { stickers: "inkwand.stickers", progress: "inkwand.progress", days: "inkwand.days" };
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

  // stickers
  function stickerCounts() { return store.get(KEY.stickers, {}); }
  function stickerTotal() { return Object.values(stickerCounts()).reduce((a, b) => a + b, 0); }

  function awardSticker(type) {
    const counts = stickerCounts();
    counts[type] = (counts[type] || 0) + 1;
    store.set(KEY.stickers, counts);
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
      html += `<span class="${cls}" role="gridcell" aria-label="${key}${studied ? ", studied" : ""}"><span class="num">${d}</span>${studied ? ICON.greenTick : ""}</span>`;
    }
    $("#cal-grid").innerHTML = html;

    const { current, best } = streaks(days, now);
    $("#cal-streak").innerHTML = current
      ? `<b>${current}-day streak!</b> Best: ${best}. Studied ${studiedThisMonth} day${studiedThisMonth === 1 ? "" : "s"} this month.`
      : `Study a little today to start your streak.${best ? ` Best so far: ${best} days.` : ""}`;
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
    if (route.view === "shelf") {
      document.title = `${state.config.site_name} · GATE CSE library`;
      renderShelves();
      renderCalendar();
      return;
    }
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
      return `<div class="shelf">
          <div class="shelf-books">${spines}${ICON.bookend}</div>
          <div class="plank"></div>
          <span class="shelf-label">${escapeHtml(shelf.title)}</span>
        </div>`;
    }).join("");
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
    $("#page-title").textContent = title;
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
    if (ctx.tab === "notes") html += `<div class="notes">${formatText(value)}</div>`;
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
    if (!("IntersectionObserver" in window)) { markPart(ctx.book, ctx.chapter, "notes"); return; }
    const openedAt = Date.now();
    const end = $(".ai-note", body);
    const obs = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      obs.disconnect();
      const wait = Math.max(0, READ_SECONDS * 1000 - (Date.now() - openedAt));
      setTimeout(() => {
        if (ctx.token === state.token) { markPart(ctx.book, ctx.chapter, "notes"); renderTabTicks(ctx.book, ctx.chapter); }
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
        if (full) { slapSticker($(".score-card", paper), "cup"); awardSticker("cup"); }
        if (ctx.chapter) { markPart(ctx.book, ctx.chapter, "practice"); renderTabTicks(ctx.book, ctx.chapter); }
      }
    });
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
        if (flipped.size === cards.length && ctx.chapter) { markPart(ctx.book, ctx.chapter, "flashcards"); renderTabTicks(ctx.book, ctx.chapter); }
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
    $("[data-board-line]").textContent = c.footer_line;
    $("[data-link-github]").setAttribute("href", c.github_url);
    $("[data-link-dev]").setAttribute("href", c.dev_post_url);

    renderBadge();
    renderStickerSheet();
    wireAskForm();
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
