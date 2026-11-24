/* Silüet — günlük ülke tahmin oyunu
 * Harici kütüphane yok. Veri data.js içindeki COUNTRIES / WORLD_BG sabitlerinden gelir.
 */
(() => {
  "use strict";

  // ------------------------------------------------------------ sabitler
  const MAX_GUESSES = 6;
  const EARTH_R = 6371.0088;
  const MAX_DIST = Math.PI * EARTH_R; // ~20 015 km: dünyanın öbür ucu
  const EPOCH = Date.UTC(2026, 0, 1); // 1 Ocak 2026 = 1. gün
  const GAME_NAME = "Silüet";
  const ARROWS = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"];
  const MODES = {
    world:  { label: "Dünya",  emoji: "🌍", daily: true  },
    europe: { label: "Avrupa", emoji: "🇪🇺", daily: true  },
    free:   { label: "Serbest", emoji: "🎲", daily: false },
  };
  const LS = {
    mode: "silu_mode",
    state: (m) => `silu_state_${m}`,
    stats: (m) => `silu_stats_${m}`,
  };

  const BY_ID = new Map(COUNTRIES.map((c) => [c.id, c]));

  // ------------------------------------------------------------ yardımcılar
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const fmtKm = (d) => Math.round(d).toLocaleString("tr-TR") + " km";

  function norm(s) {
    return s
      .toLocaleLowerCase("tr")
      .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
      .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }
  // Ön hesap: her ülke için normalize edilmiş adlar
  for (const c of COUNTRIES) {
    c._n = norm(c.n);
    c._al = c.al.map(norm);
    c._words = c._n.split(" ");
  }

  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* gizli mod vb. */ }
  }

  // ------------------------------------------------------------ coğrafya
  const rad = (d) => (d * Math.PI) / 180;

  function haversine(a, b) {
    const p1 = rad(a.lat), p2 = rad(b.lat);
    const dp = p2 - p1, dl = rad(b.lon - a.lon);
    const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // a'dan b'ye ilk pusula açısı (0 = kuzey, saat yönünde)
  function bearing(a, b) {
    const p1 = rad(a.lat), p2 = rad(b.lat), dl = rad(b.lon - a.lon);
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }
  const arrowFor = (deg) => ARROWS[Math.round(deg / 45) % 8];

  function proximity(d) {
    return Math.max(0, Math.min(100, Math.round(100 * (1 - d / MAX_DIST))));
  }

  function evaluate(guessId, targetId) {
    const g = BY_ID.get(guessId), t = BY_ID.get(targetId);
    if (guessId === targetId) return { id: guessId, d: 0, pct: 100, arrow: "🎉", correct: true };
    const d = haversine(g, t);
    let pct = proximity(d);
    if (pct === 100) pct = 99; // yanlış tahmin asla %100 göstermesin
    return { id: guessId, d, pct, arrow: arrowFor(bearing(g, t)), correct: false };
  }

  // ------------------------------------------------------------ silüet çizimi
  // Lambert azimutal eşit alan projeksiyonu, ülkenin merkezine göre.
  // Antimeridyen sorunu yaşamaz, Rusya/Kanada gibi büyük ülkeleri de makul gösterir.
  function makeProjection(lat0, lon0) {
    const f0 = rad(lat0), l0 = rad(lon0);
    const sf0 = Math.sin(f0), cf0 = Math.cos(f0);
    return (lon, lat) => {
      const f = rad(lat), dl = rad(lon) - l0;
      const sf = Math.sin(f), cf = Math.cos(f), cdl = Math.cos(dl);
      const k = Math.sqrt(2 / Math.max(1e-9, 1 + sf0 * sf + cf0 * cf * cdl));
      return [k * cf * Math.sin(dl), -k * (cf0 * sf - sf0 * cf * cdl)]; // SVG: y aşağı
    };
  }

  function silhouettePath(country, size = 1000, pad = 0.04) {
    const proj = makeProjection(country.lat, country.lon);
    const rings = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pi of country.m) {
      for (const ring of country.p[pi]) {
        const pts = [];
        for (let i = 0; i < ring.length; i += 2) {
          const [x, y] = proj(ring[i], ring[i + 1]);
          pts.push(x, y);
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        rings.push(pts);
      }
    }
    const w = maxX - minX, h = maxY - minY;
    const s = (size * (1 - 2 * pad)) / Math.max(w, h);
    const ox = (size - w * s) / 2, oy = (size - h * s) / 2;
    let d = "";
    for (const pts of rings) {
      for (let i = 0; i < pts.length; i += 2) {
        const x = ((pts[i] - minX) * s + ox).toFixed(1);
        const y = ((pts[i + 1] - minY) * s + oy).toFixed(1);
        d += (i === 0 ? "M" : "L") + x + " " + y;
      }
      d += "Z";
    }
    return d;
  }

  function renderSilhouette(country, cls = "") {
    const svg = $("#silhouette");
    svg.setAttribute("viewBox", "0 0 1000 1000");
    svg.innerHTML = `<path fill-rule="evenodd" d="${silhouettePath(country)}"/>`;
    svg.setAttribute("class", "silhouette " + cls);
  }

  // ------------------------------------------------------------ dünya haritası
  // Basit eşdikdörtgen (equirectangular) projeksiyon: x = boylam, y = -enlem
  function ringsToPath(rings) {
    let d = "";
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 2) {
        d += (i === 0 ? "M" : "L") + ring[i] + " " + -ring[i + 1];
      }
      d += "Z";
    }
    return d;
  }
  const countryWorldPath = (c) => c.p.map(ringsToPath).join("");
  let worldBasePath = null;

  function renderWorldMap(targetId, guessIds) {
    if (!worldBasePath) {
      worldBasePath = COUNTRIES.map(countryWorldPath).join("") + WORLD_BG.map((r) => ringsToPath([r])).join("");
    }
    const t = BY_ID.get(targetId);
    const guessed = guessIds.filter((id) => id !== targetId).map((id) => BY_ID.get(id));
    const svg = $("#worldMap");
    svg.innerHTML =
      `<path class="land" fill-rule="evenodd" d="${worldBasePath}"/>` +
      guessed.map((g) => `<path class="land guessed" fill-rule="evenodd" d="${countryWorldPath(g)}"/>`).join("") +
      `<path class="land target" fill-rule="evenodd" d="${countryWorldPath(t)}"/>` +
      `<circle class="ping" cx="${t.lon}" cy="${-t.lat}" r="4"/>`;
  }

  // ------------------------------------------------------------ gün & seed
  function dayNumber(d = new Date()) {
    const local = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor((local - EPOCH) / 86400000) + 1;
  }
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }
  function mulberry32(a) {
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seededShuffle(arr, seed) {
    const a = arr.slice(), rnd = mulberry32(seed);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const poolFor = (mode) =>
    COUNTRIES.filter((c) => c.pool && (mode !== "europe" || c.eu)).map((c) => c.id).sort();
  const guessableFor = (mode) => (mode === "europe" ? COUNTRIES.filter((c) => c.eu) : COUNTRIES);

  // Havuz her turda (cycle) tohumlu karıştırılır: bir tur bitmeden aynı ülke tekrar gelmez.
  function dailyCountry(mode, day) {
    const pool = poolFor(mode);
    const cycle = Math.floor((day - 1) / pool.length);
    const order = seededShuffle(pool, hashStr(`${GAME_NAME}|${mode}|${cycle}`));
    return order[(((day - 1) % pool.length) + pool.length) % pool.length];
  }

  // ------------------------------------------------------------ istatistik
  function emptyStats() {
    return { played: 0, wins: 0, cur: 0, max: 0, dist: [0, 0, 0, 0, 0, 0, 0], lastWinDay: null, lastResult: null };
  }
  function getStats(mode) {
    const s = Object.assign(emptyStats(), load(LS.stats(mode), {}));
    // seri bozulduysa (dün kazanılmadıysa ve bugün de henüz kazanılmadıysa)
    const today = dayNumber();
    if (s.cur > 0 && s.lastWinDay != null && s.lastWinDay < today - 1) s.cur = 0;
    return s;
  }
  function recordResult(mode, day, won, n) {
    const s = getStats(mode);
    s.played++;
    if (won) {
      s.wins++;
      s.dist[n]++;
      s.cur = s.lastWinDay === day - 1 ? s.cur + 1 : 1;
      s.max = Math.max(s.max, s.cur);
      s.lastWinDay = day;
    } else {
      s.cur = 0;
    }
    s.lastResult = { day, won, n };
    save(LS.stats(mode), s);
  }

  // ------------------------------------------------------------ oyun durumu
  let mode = load(LS.mode, "world");
  if (!MODES[mode]) mode = "world";
  let game = null; // { mode, day, target, guesses:[id], hints, done, won }
  let lastFreeTarget = null;

  function newGame(m) {
    if (MODES[m].daily) {
      const day = dayNumber();
      const saved = load(LS.state(m), null);
      if (saved && saved.day === day && BY_ID.has(saved.target)) return saved;
      return { mode: m, day, target: dailyCountry(m, day), guesses: [], hints: 0, done: false, won: false };
    }
    const pool = poolFor("world").filter((id) => id !== lastFreeTarget);
    const target = pool[Math.floor(Math.random() * pool.length)];
    lastFreeTarget = target;
    return { mode: m, day: null, target, guesses: [], hints: 0, done: false, won: false };
  }

  function persist() {
    if (MODES[game.mode].daily) save(LS.state(game.mode), game);
  }

  const wrongCount = () => game.guesses.filter((id) => id !== game.target).length;
  const hintsAvailable = () => {
    const w = wrongCount();
    return w >= 5 ? 2 : w >= 3 ? 1 : 0;
  };

  // ------------------------------------------------------------ arayüz
  const ui = {
    input: $("#guessInput"),
    sugg: $("#suggestions"),
    guesses: $("#guesses"),
    msg: $("#msg"),
    hintBtn: $("#btnHint"),
    hints: $("#hints"),
    result: $("#result"),
    inputArea: $("#inputArea"),
  };

  function setMsg(text, err = false) {
    ui.msg.textContent = text || "";
    ui.msg.classList.toggle("err", !!err);
  }

  let toastTimer = null;
  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 1800);
  }

  function renderAll(animateLast = false) {
    document.querySelectorAll(".mode").forEach((b) => {
      const on = b.dataset.mode === game.mode;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on);
    });
    $("#dayLabel").textContent = MODES[game.mode].daily ? `#${game.day}` : "serbest";

    const target = BY_ID.get(game.target);
    renderSilhouette(target, game.done ? (game.won ? "won" : "lost") : "");
    renderGuesses(animateLast);
    renderHints();

    ui.inputArea.hidden = game.done;
    ui.result.hidden = !game.done;
    if (game.done) renderResult();
    setMsg("");
  }

  function renderGuesses(animateLast) {
    const t = game.target;
    ui.guesses.innerHTML = "";
    for (let i = 0; i < MAX_GUESSES; i++) {
      const id = game.guesses[i];
      if (!id) {
        const r = el("div", "row empty");
        r.innerHTML = "<div></div><div></div><div></div><div></div>";
        ui.guesses.appendChild(r);
        continue;
      }
      const ev = evaluate(id, t);
      const c = BY_ID.get(id);
      const r = el("div", "row" + (ev.correct ? " correct" : "") + (animateLast && i === game.guesses.length - 1 ? " new" : ""));
      r.innerHTML =
        `<div><span class="g-name" title="${c.n}">${c.n}</span></div>` +
        `<div class="g-dist">${ev.correct ? "—" : fmtKm(ev.d)}</div>` +
        `<div class="g-dir" aria-label="yön">${ev.arrow}</div>` +
        `<div class="g-pct"><i class="bar"></i><span>%${ev.pct}</span></div>`;
      ui.guesses.appendChild(r);
      const bar = r.querySelector(".bar");
      if (animateLast && i === game.guesses.length - 1) {
        requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.width = ev.pct + "%")));
      } else {
        bar.style.transition = "none";
        bar.style.width = ev.pct + "%";
      }
    }
  }

  function hintTexts() {
    const t = BY_ID.get(game.target);
    const out = [];
    if (game.hints >= 1) {
      out.push(game.mode === "europe" ? `Bölge: <b>${t.sr}</b>` : `Kıta: <b>${t.c}</b>`);
    }
    if (game.hints >= 2) {
      out.push(`Başkent: <b>${t.cap.charAt(0).toLocaleUpperCase("tr")}…</b>`);
    }
    return out;
  }

  function renderHints() {
    ui.hints.innerHTML = "";
    for (const h of hintTexts()) ui.hints.appendChild(el("span", "chip", "💡 " + h));
    const avail = hintsAvailable();
    const canOpen = !game.done && game.hints < avail;
    ui.hintBtn.disabled = !canOpen;
    const w = wrongCount();
    if (game.hints >= 2) ui.hintBtn.textContent = "💡 İpuçları açıldı";
    else if (canOpen) ui.hintBtn.textContent = game.hints === 0 ? (game.mode === "europe" ? "💡 İpucu: bölge" : "💡 İpucu: kıta") : "💡 İpucu: başkent";
    else if (game.hints === 0) ui.hintBtn.textContent = `💡 İpucu · ${Math.max(0, 3 - w)} yanlış daha`;
    else ui.hintBtn.textContent = `💡 İpucu · ${Math.max(0, 5 - w)} yanlış daha`;
  }

  function shareText() {
    const m = MODES[game.mode];
    const score = game.won ? `${game.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
    const head = m.daily ? `${GAME_NAME} #${game.day} ${m.emoji} ${m.label} ${score}` : `${GAME_NAME} 🎲 Serbest ${score}`;
    const lines = game.guesses.map((id) => {
      const ev = evaluate(id, game.target);
      const full = Math.floor(ev.pct / 20);
      const half = full < 5 && ev.pct - full * 20 >= 10 ? 1 : 0;
      return "🟩".repeat(full) + "🟨".repeat(half) + "⬛".repeat(5 - full - half) + " " + ev.arrow;
    });
    const hint = game.hints ? `\n${"💡".repeat(game.hints)} ipucu kullanıldı` : "";
    return `${head}\n${lines.join("\n")}${hint}`;
  }

  function renderResult() {
    const t = BY_ID.get(game.target);
    $("#resFlag").textContent = t.f;
    const st = $("#resStatus");
    st.textContent = game.won ? `Tebrikler! ${game.guesses.length}/${MAX_GUESSES}` : "Bu sefer olmadı";
    st.className = "result-status " + (game.won ? "won" : "lost");
    $("#resName").textContent = t.n;
    $("#resMeta").textContent = `${t.c} · Başkent: ${t.cap}`;
    renderWorldMap(game.target, game.guesses);
    $("#shareText").textContent = shareText();
    $("#btnNext").hidden = MODES[game.mode].daily;
    $("#btnCopy").hidden = false;
    updateCountdown();
  }

  function updateCountdown() {
    const cd = $("#countdown");
    if (!game || !game.done || !MODES[game.mode].daily) { cd.textContent = ""; return; }
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    let s = Math.max(0, Math.floor((next - now) / 1000));
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    cd.innerHTML = `Yeni ülke: <b>${hh}:${mm}:${ss}</b>`;
  }

  // ------------------------------------------------------------ otomatik tamamlama
  let suggestions = [];
  let activeIdx = -1;

  function findMatches(q) {
    const n = norm(q);
    if (!n) return [];
    const scored = [];
    for (const c of guessableFor(game.mode)) {
      let score = -1;
      if (c._n.startsWith(n)) score = 0;
      else if (c._words.some((w) => w.startsWith(n))) score = 1;
      else if (c._al.some((a) => a.startsWith(n))) score = 2;
      else if (n.length >= 3 && (c._n.includes(n) || c._al.some((a) => a.includes(n)))) score = 3;
      if (score >= 0) scored.push([score, c]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].n.localeCompare(b[1].n, "tr"));
    return scored.slice(0, 8).map((x) => x[1]);
  }

  function exactMatch(q) {
    const n = norm(q);
    if (!n) return null;
    return guessableFor(game.mode).find((c) => c._n === n || c._al.includes(n)) || null;
  }

  function renderSuggestions() {
    ui.sugg.innerHTML = "";
    if (!suggestions.length) {
      ui.sugg.hidden = true;
      ui.input.setAttribute("aria-expanded", "false");
      return;
    }
    suggestions.forEach((c, i) => {
      const used = game.guesses.includes(c.id);
      const li = el("li", (i === activeIdx ? "active" : "") + (used ? " used" : ""));
      li.setAttribute("role", "option");
      li.innerHTML = `<span>${c.f}</span><span>${c.n}</span>${used ? "<small>denendi</small>" : ""}`;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        submitGuess(c);
      });
      ui.sugg.appendChild(li);
    });
    ui.sugg.hidden = false;
    ui.input.setAttribute("aria-expanded", "true");
  }

  function closeSuggestions() {
    suggestions = [];
    activeIdx = -1;
    renderSuggestions();
  }

  function shake(text) {
    ui.input.classList.remove("shake");
    void ui.input.offsetWidth;
    ui.input.classList.add("shake");
    setMsg(text, true);
  }

  function submitGuess(country) {
    if (game.done) return;
    if (!country) {
      const q = ui.input.value.trim();
      if (!q) return shake("Önce bir ülke adı yaz.");
      country = exactMatch(q) || (activeIdx >= 0 ? suggestions[activeIdx] : null);
      if (!country) {
        return shake(game.mode === "europe" ? "Bu isim Avrupa listesinde yok." : "Listede böyle bir ülke yok.");
      }
    }
    if (game.guesses.includes(country.id)) return shake(`${country.n} zaten denendi.`);

    game.guesses.push(country.id);
    const correct = country.id === game.target;
    if (correct || game.guesses.length >= MAX_GUESSES) {
      game.done = true;
      game.won = correct;
      if (MODES[game.mode].daily) recordResult(game.mode, game.day, correct, game.guesses.length);
    }
    persist();
    ui.input.value = "";
    closeSuggestions();
    renderAll(true);
    if (!game.done) {
      const was = hintsAvailable();
      if (game.hints < was) {
        ui.hintBtn.classList.remove("glow");
        void ui.hintBtn.offsetWidth;
        ui.hintBtn.classList.add("glow");
      }
      ui.input.focus();
    } else {
      $("#silhouette").classList.add("pop");
      ui.result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  ui.input.addEventListener("input", () => {
    setMsg("");
    ui.input.classList.remove("shake");
    suggestions = findMatches(ui.input.value);
    activeIdx = suggestions.length ? 0 : -1;
    renderSuggestions();
  });
  ui.input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      activeIdx = (activeIdx + 1) % suggestions.length;
      renderSuggestions();
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      activeIdx = (activeIdx - 1 + suggestions.length) % suggestions.length;
      renderSuggestions();
    } else if (e.key === "Enter") {
      e.preventDefault();
      submitGuess(null);
    } else if (e.key === "Escape") {
      closeSuggestions();
    }
  });
  ui.input.addEventListener("blur", () => setTimeout(closeSuggestions, 120));
  $("#btnGuess").addEventListener("click", () => submitGuess(null));

  ui.hintBtn.addEventListener("click", () => {
    if (game.hints < hintsAvailable()) {
      game.hints++;
      persist();
      renderHints();
    }
  });

  // ------------------------------------------------------------ kopyala
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext !== false) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* aşağıdaki yedeğe düş */ }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
  $("#btnCopy").addEventListener("click", async () => {
    const ok = await copyText(shareText());
    toast(ok ? "Sonuç panoya kopyalandı ✓" : "Kopyalanamadı — metni elle seçebilirsin");
  });
  $("#btnNext").addEventListener("click", () => {
    game = newGame("free");
    renderAll();
    $("#silhouette").classList.add("pop");
    ui.input.focus();
  });

  // ------------------------------------------------------------ modlar
  function switchMode(m) {
    if (!MODES[m]) return;
    mode = m;
    save(LS.mode, m);
    game = newGame(m);
    ui.input.value = "";
    closeSuggestions();
    renderAll();
    $("#silhouette").classList.remove("pop");
    void $("#silhouette").offsetWidth;
    $("#silhouette").classList.add("pop");
  }
  document.querySelectorAll(".mode").forEach((b) => b.addEventListener("click", () => switchMode(b.dataset.mode)));

  // ------------------------------------------------------------ istatistik penceresi
  let statMode = "world";
  function renderStats() {
    document.querySelectorAll(".stat-tab").forEach((b) => b.classList.toggle("active", b.dataset.smode === statMode));
    const s = getStats(statMode);
    const pct = s.played ? Math.round((100 * s.wins) / s.played) : 0;
    $("#statGrid").innerHTML = [
      [s.played, "Oynanan"], [pct, "Kazanma %"], [s.cur, "Mevcut seri"], [s.max, "En uzun seri"],
    ].map(([n, l]) => `<div><div class="num">${n}</div><div class="lbl">${l}</div></div>`).join("");
    const max = Math.max(1, ...s.dist.slice(1));
    const today = dayNumber();
    const hl = s.lastResult && s.lastResult.day === today && s.lastResult.won ? s.lastResult.n : -1;
    const dist = $("#dist");
    dist.innerHTML = "";
    for (let i = 1; i <= MAX_GUESSES; i++) {
      const row = el("div", "dist-row", `<span>${i}</span><div class="dist-bar${i === hl ? " hl" : ""}">${s.dist[i]}</div>`);
      dist.appendChild(row);
      const bar = row.querySelector(".dist-bar");
      requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.width = Math.max(7, (100 * s.dist[i]) / max) + "%")));
    }
  }
  document.querySelectorAll(".stat-tab").forEach((b) =>
    b.addEventListener("click", () => { statMode = b.dataset.smode; renderStats(); })
  );
  function openDialog(d) {
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
  }
  $("#btnStats").addEventListener("click", () => {
    statMode = game.mode === "europe" ? "europe" : "world";
    renderStats();
    openDialog($("#statsDlg"));
  });
  $("#btnHelp").addEventListener("click", () => openDialog($("#helpDlg")));
  document.querySelectorAll("dialog").forEach((d) =>
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); })
  );

  // ------------------------------------------------------------ gün değişimi
  setInterval(() => {
    updateCountdown();
    if (game && MODES[game.mode].daily && game.day !== dayNumber()) switchMode(game.mode);
  }, 1000);

  // ------------------------------------------------------------ başlat
  game = newGame(mode);
  renderAll();
  if (!load("silu_seen_help", false)) {
    save("silu_seen_help", true);
    openDialog($("#helpDlg"));
  }

  // Test / hata ayıklama için (konsoldan erişilebilir)
  window.__silu = { haversine, bearing, evaluate, dailyCountry, dayNumber, poolFor, silhouettePath, norm, BY_ID, findMatches, exactMatch };
})();
