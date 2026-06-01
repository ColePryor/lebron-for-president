/* DRAFT LEBRON 2028 */
(function () {
  "use strict";

  var GOAL = 1000000;
  var SIG_KEY = "draftLeBron.sigs";

  var STATES = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"];

  var SEED = [
    { name: "Marcus", loc: "Akron, OH", quote: "He built a school for kids everyone else gave up on. That's the whole resume." },
    { name: "Dana", loc: "Austin, TX", quote: "We need someone who finishes what he starts." },
    { name: "Priya", loc: "Sacramento, CA", quote: "Why not? He has spent his entire life leading." },
    { name: "Jordan", loc: "Miami, FL", quote: "Loyal, disciplined, impossible to count out." },
    { name: "Ellen", loc: "Columbus, OH", quote: "I'm in." },
    { name: "Carlos", loc: "Phoenix, AZ", quote: "Twenty one years at the top and he never once mailed it in." }
  ];

  function load(k, f) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (e) { return f; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var sigs = load(SIG_KEY, []);
  // Honest count: only real signatures from this device. SEED entries are example quotes for the board.
  function total() { return sigs.length; }

  // ---- number tween ----
  function tween(el, to, dur) {
    if (!el) return;
    var from = parseInt(el.dataset.v || "0", 10) || 0;
    var t0 = null; dur = dur || 1200;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * e).toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(step); else el.dataset.v = String(to);
    }
    requestAnimationFrame(step);
  }

  function paint(animate) {
    var t = total();
    var hero = document.getElementById("heroCount");
    var now = document.getElementById("goalNow");
    if (animate) { tween(hero, t); tween(now, t); }
    else { [hero, now].forEach(function (el) { if (el) { el.textContent = t.toLocaleString("en-US"); el.dataset.v = String(t); } }); }
    var fill = document.getElementById("barFill");
    if (fill) fill.style.width = Math.min(100, (t / GOAL) * 100).toFixed(3) + "%";
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function renderWall() {
    var wall = document.getElementById("wall");
    if (!wall) return;
    // Curated board: always the six controlled examples. Public submissions are
    // still collected, but never auto-published here, so the wall can't be hijacked.
    wall.innerHTML = "";
    SEED.forEach(function (s) {
      var c = document.createElement("div");
      c.className = "wall-card";
      c.innerHTML =
        '<p class="wall-quote">&ldquo;' + esc(s.quote) + '&rdquo;</p>' +
        '<div class="wall-meta"><span class="wall-dot">' + esc(s.name.charAt(0).toUpperCase()) + '</span>' +
        '<span><span class="wall-name">' + esc(s.name) + '</span> &middot; <span class="wall-loc">' + esc(s.loc) + '</span></span></div>';
      wall.appendChild(c);
    });
  }

  function buildMarquee() {
    var m = document.getElementById("marquee");
    if (!m) return;
    var words = ["DRAFT LEBRON", "RUN THE COUNTRY LIKE THE 4TH QUARTER", "LEBRON FOR PRESIDENT", "EFFORT IS A POLICY", "PUT HIM ON THE BOARD"];
    var one = words.map(function (w) { return '<span>' + w + '</span><span class="star">&#9733;</span>'; }).join("");
    m.innerHTML = one + one;
  }

  function fillStates() {
    var sel = document.getElementById("state");
    if (!sel) return;
    STATES.forEach(function (s) { var o = document.createElement("option"); o.value = s; o.textContent = s; sel.appendChild(o); });
  }

  // ---- toast ----
  var tt;
  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(tt); tt = setTimeout(function () { t.classList.remove("show"); }, 3000);
  }

  // ---- confetti cannon (canvas, no deps) ----
  var cv = document.getElementById("confetti");
  var ctx = cv ? cv.getContext("2d") : null;
  var bits = [];
  var running = false;
  var COLORS = ["#fdb927", "#ffcf4d", "#552583", "#7b3fb8", "#f7f6f3"];

  function sizeCanvas() {
    if (!cv) return;
    cv.width = window.innerWidth; cv.height = window.innerHeight;
  }

  function burst(x, y) {
    if (!ctx) return;
    var n = 140;
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2) * (i / n) + (i % 7) * 0.13;
      var spd = 6 + (i % 11);
      bits.push({
        x: x, y: y,
        vx: Math.cos(ang) * spd * (0.6 + (i % 5) / 6),
        vy: Math.sin(ang) * spd * (0.6 + (i % 3) / 4) - 4,
        g: 0.18 + (i % 4) * 0.03,
        size: 6 + (i % 6),
        rot: i, vr: (i % 2 ? 1 : -1) * (0.1 + (i % 5) / 20),
        color: COLORS[i % COLORS.length],
        life: 0, max: 90 + (i % 40)
      });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function tick() {
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (var i = bits.length - 1; i >= 0; i--) {
      var b = bits[i];
      b.vy += b.g; b.x += b.vx; b.y += b.vy; b.rot += b.vr; b.life++;
      b.vx *= 0.99;
      var alpha = Math.max(0, 1 - b.life / b.max);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.size / 2, -b.size / 2, b.size, b.size * 0.6);
      ctx.restore();
      if (b.life >= b.max || b.y > cv.height + 40) bits.splice(i, 1);
    }
    if (bits.length) requestAnimationFrame(tick);
    else { running = false; ctx.clearRect(0, 0, cv.width, cv.height); }
  }

  function celebrate() {
    var w = window.innerWidth, h = window.innerHeight;
    burst(w * 0.5, h * 0.42);
    setTimeout(function () { burst(w * 0.2, h * 0.55); burst(w * 0.8, h * 0.55); }, 130);
  }

  // ---- modal ----
  function openModal(num) {
    var m = document.getElementById("modal");
    var n = document.getElementById("modalNum");
    if (n) n.textContent = "#" + num.toLocaleString("en-US");
    if (m) { m.classList.add("open"); m.setAttribute("aria-hidden", "false"); }
  }
  function closeModal() {
    var m = document.getElementById("modal");
    if (m) { m.classList.remove("open"); m.setAttribute("aria-hidden", "true"); }
  }

  // ---- form ----
  function setupForm() {
    var form = document.getElementById("form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var first = document.getElementById("firstName");
      var st = document.getElementById("state");
      var reason = document.getElementById("reason");
      var ok = true;
      if (!first.value.trim()) { first.classList.add("bad"); ok = false; }
      if (!st.value) { st.classList.add("bad"); ok = false; }
      if (!ok) { toast("Add your name and state to sign."); return; }

      var name = first.value.trim();
      var entry = { name: name, loc: st.value, quote: reason.value.trim() || "I'm in.", ts: Date.now() };
      sigs.push(entry); save(SIG_KEY, sigs);

      var mine = total();
      paint(true);
      celebrate();
      openModal(mine);
      form.reset();
      st.selectedIndex = 0;
    });
    form.addEventListener("input", function (e) { if (e.target.classList) e.target.classList.remove("bad"); });
  }

  // ---- LeBron Ladder (online ELO trivia) ----
  var PLAYER_KEY = "draftLeBron.player";

  // Backend is wired only if config.js was filled in. Both values are public-safe.
  var LADDER = (window.LADDER_CONFIG && window.LADDER_CONFIG.url && window.LADDER_CONFIG.anonKey)
    ? window.LADDER_CONFIG : null;

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function ratingTitle(r) {
    if (r >= 1400) return { icon: "\u{1F410}", title: "GOAT TIER" };
    if (r >= 1200) return { icon: "♛", title: "ALL-STAR" };
    if (r >= 1000) return { icon: "\u{1F3C0}", title: "STARTER" };
    return { icon: "\u{1F454}", title: "BENCH WARMER" };
  }

  function setupTrivia() {
    var card = document.getElementById("triviaCard");
    if (!card) return;

    // stages + controls
    var joinEl = document.getElementById("triviaJoin");
    var playEl = document.getElementById("triviaPlay");
    var resultEl = document.getElementById("triviaResult");
    var noticeEl = document.getElementById("triviaNotice");

    var joinTitle = document.getElementById("triviaJoinTitle");
    var joinMsg = document.getElementById("triviaJoinMsg");
    var joinForm = document.getElementById("triviaJoinForm");
    var handleEl = document.getElementById("triviaHandle");
    var joinBtn = document.getElementById("triviaJoinBtn");
    var startBtn = document.getElementById("triviaStartBtn");
    var switchBtn = document.getElementById("triviaSwitch");
    var ladderJoinEl = document.getElementById("triviaLadderJoin");

    var meEl = document.getElementById("triviaMe");
    var oppEl = document.getElementById("triviaOpp");
    var countEl = document.getElementById("triviaCount");
    var clockEl = document.getElementById("triviaClock");
    var targetEl = document.getElementById("triviaTarget");
    var barEl = document.getElementById("triviaBarFill");
    var qEl = document.getElementById("triviaQ");
    var optsEl = document.getElementById("triviaOpts");

    // the clickable game overlay
    var gameModal = document.getElementById("gameModal");
    var launchBtn = document.getElementById("triviaLaunch");
    var navPlayBtn = document.getElementById("navPlay");
    var gameClose = document.getElementById("gameClose");
    var toSignBtn = document.getElementById("triviaToSign");

    var rankIcon = document.getElementById("triviaRank");
    var rankTitle = document.getElementById("triviaRankTitle");
    var finalEl = document.getElementById("triviaFinal");
    var blurbEl = document.getElementById("triviaBlurb");
    var recapEl = document.getElementById("triviaRecap");
    var againBtn = document.getElementById("triviaAgain");
    var ladderResultEl = document.getElementById("triviaLadderResult");

    var player = null;   // { id, handle, rating }
    var match = null;    // start_match payload
    var answers = [];    // chosen original option index per question
    var times = [];      // answer time in ms per question
    var idx = 0;
    var busy = false;
    var qStart = 0;      // when the current question was shown (ms)
    var clockTimer = null;

    function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

    function show(el) { [joinEl, playEl, resultEl].forEach(function (s) { s.hidden = (s !== el); }); }

    // ---- the game lives in a clickable overlay, not the page flow ----
    function openGame() {
      gameModal.classList.add("open");
      gameModal.setAttribute("aria-hidden", "false");
      if (LADDER && !match) renderLadder(ladderJoinEl);
    }
    function closeGame() {
      stopClock();
      gameModal.classList.remove("open");
      gameModal.setAttribute("aria-hidden", "true");
    }

    // ---- per-question speed clock ----
    function stopClock() { if (clockTimer) { clearInterval(clockTimer); clockTimer = null; } }
    function startClock() {
      stopClock();
      tickClock();
      clockTimer = setInterval(tickClock, 100);
    }
    function tickClock() {
      var el = nowMs() - qStart;
      clockEl.textContent = (el / 1000).toFixed(1) + "s";
      clockEl.classList.toggle("over", !!(match && el > match.beat_ms));
    }
    function notice(msg) { noticeEl.textContent = msg; noticeEl.hidden = false; }
    function clearNotice() { noticeEl.hidden = true; }
    function fail(msg, e) { if (e) console.error(e); notice(msg); }

    // ---- Supabase REST helpers (no SDK, just fetch) ----
    var base = LADDER ? LADDER.url.replace(/\/+$/, "") : "";
    function api(path, opts) {
      opts = opts || {};
      return fetch(base + path, {
        method: opts.method || "GET",
        headers: {
          "apikey": LADDER.anonKey,
          "Authorization": "Bearer " + LADDER.anonKey,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined
      }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error(t || ("HTTP " + r.status)); });
        return r.text().then(function (t) { return t ? JSON.parse(t) : null; });
      });
    }
    function rpc(fn, args) { return api("/rest/v1/rpc/" + fn, { method: "POST", body: args || {} }); }

    function savePlayer() { save(PLAYER_KEY, player); }

    function renderLadder(el) {
      if (!el) return;
      api("/rest/v1/leaderboard?select=handle,rating,played&limit=10").then(function (rows) {
        if (!rows || !rows.length) { el.innerHTML = ""; return; }
        var html = '<p class="trivia-ladder-title">GLOBAL TOP 10</p>';
        var tagged = false;
        rows.forEach(function (row, i) {
          var you = !tagged && player && row.handle === player.handle && row.rating === player.rating;
          if (you) tagged = true;
          html += '<div class="trivia-row' + (you ? " you" : "") + '">' +
            '<span class="trivia-rank-n">' + (i + 1) + '</span>' +
            '<span class="trivia-row-handle">' + esc(row.handle) +
              (you ? ' <span class="trivia-row-you-tag">YOU</span>' : '') + '</span>' +
            '<span class="trivia-row-rating">' + row.rating + '</span></div>';
        });
        el.innerHTML = html;
      }).catch(function (e) { console.error(e); });
    }

    function renderJoin() {
      if (player) {
        joinTitle.textContent = "WELCOME BACK";
        joinMsg.textContent = "You're " + player.handle + " — rating " + player.rating + ". Climb higher.";
        joinForm.hidden = true; startBtn.hidden = false; switchBtn.hidden = false;
      } else {
        joinTitle.textContent = "ENTER THE LADDER";
        joinMsg.textContent = "Claim a handle to get your starting rating of 1000, then start climbing.";
        joinForm.hidden = false; startBtn.hidden = true; switchBtn.hidden = true;
      }
      renderLadder(ladderJoinEl);
    }

    function doJoin() {
      if (busy) return;
      var h = handleEl.value.trim();
      if (h.length < 2) { notice("Pick a handle of at least 2 characters."); return; }
      busy = true; joinBtn.disabled = true; clearNotice();
      rpc("join_ladder", { p_handle: h }).then(function (p) {
        player = { id: p.id, handle: p.handle, rating: p.rating }; savePlayer();
        busy = false; joinBtn.disabled = false; renderJoin();
      }).catch(function (e) { busy = false; joinBtn.disabled = false; fail("Couldn't join the ladder. Try again.", e); });
    }

    function doSwitch() {
      player = null; save(PLAYER_KEY, null); handleEl.value = ""; clearNotice(); renderJoin();
    }

    function startMatch() {
      if (busy || !player) return;
      busy = true; clearNotice(); startBtn.disabled = true; againBtn.disabled = true;
      rpc("start_match", { p_player_id: player.id }).then(function (m) {
        match = m; answers = []; times = []; idx = 0; busy = false;
        startBtn.disabled = false; againBtn.disabled = false;
        player.rating = m.your_rating; savePlayer();
        meEl.textContent = player.handle + " · " + m.your_rating;
        oppEl.textContent = m.opponent.handle + " · " + m.opponent.rating;
        show(playEl); renderQ();
      }).catch(function (e) {
        busy = false; startBtn.disabled = false; againBtn.disabled = false;
        fail("Couldn't start a match. Try again.", e);
      });
    }

    function renderQ() {
      busy = false;
      var q = match.questions[idx];
      var n = match.questions.length;
      countEl.textContent = "Q" + (idx + 1) + " / " + n;
      barEl.style.width = ((idx / n) * 100) + "%";
      var beatS = ((match.beat_ms || 7000) / 1000).toFixed(1);
      targetEl.textContent = "Answer in under " + beatS + "s to beat " + match.opponent.handle + " (slower scores nothing).";
      qEl.textContent = q.prompt;
      optsEl.innerHTML = "";
      // shuffle display order but remember the original index to submit
      shuffle(q.options.map(function (_, k) { return k; })).forEach(function (orig) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "trivia-opt";
        b.textContent = q.options[orig];
        b.addEventListener("click", function () { pick(b, orig); });
        optsEl.appendChild(b);
      });
      qStart = nowMs();
      startClock();
    }

    function pick(btn, orig) {
      if (busy) return;
      busy = true;
      stopClock();
      times[idx] = Math.max(0, Math.round(nowMs() - qStart));
      answers[idx] = orig;
      Array.prototype.forEach.call(optsEl.children, function (b) { b.disabled = true; });
      btn.classList.add("picked");
      setTimeout(function () {
        idx++;
        if (idx < match.questions.length) renderQ();
        else finishMatch();
      }, 320);
    }

    function finishMatch() {
      stopClock();
      barEl.style.width = "100%";
      rankIcon.textContent = "⏳"; rankTitle.textContent = "SCORING…";
      finalEl.textContent = ""; blurbEl.textContent = ""; recapEl.innerHTML = "";
      show(resultEl);
      rpc("finish_match", { p_match_id: match.match_id, p_answers: answers, p_times: times })
        .then(function (res) { match = null; renderResult(res); })
        .catch(function (e) { fail("Couldn't score that match. Try again.", e); renderJoin(); show(joinEl); });
    }

    function renderResult(res) {
      player.rating = res.new_rating; savePlayer();
      var t = ratingTitle(res.new_rating);
      rankIcon.textContent = t.icon;
      rankTitle.textContent = t.title;
      var sign = res.delta >= 0 ? "+" : "−";
      finalEl.textContent = sign + Math.abs(res.delta) + "  →  " + res.new_rating;
      var slow = (res.right || 0) - res.correct;
      var slowNote = slow > 0
        ? " (" + slow + " right but too slow, those don't count)"
        : "";
      blurbEl.textContent = "You scored " + res.correct + "/" + res.total +
        " against " + res.opponent.handle + " (" + res.opponent.rating + ")" + slowNote +
        ". You're now #" + res.rank + " of " + res.players + " on the ladder.";
      recapEl.innerHTML = "";
      (res.results || []).forEach(function (r) {
        var cls = r.scored ? "hit" : (r.correct ? "slow" : "miss");
        var p = document.createElement("span");
        p.className = "trivia-pip " + cls;
        recapEl.appendChild(p);
      });
      show(resultEl);
      renderLadder(ladderResultEl);
      if (res.total && res.correct === res.total) celebrate();
    }

    // ---- wire up ----
    // The game opens from a button into its own overlay (not an inline scroll
    // section), so wire the launcher first, before the backend-connected guard.
    if (launchBtn) launchBtn.addEventListener("click", openGame);
    if (navPlayBtn) navPlayBtn.addEventListener("click", openGame);
    if (gameClose) gameClose.addEventListener("click", closeGame);
    if (toSignBtn) toSignBtn.addEventListener("click", closeGame);
    gameModal.addEventListener("click", function (e) { if (e.target === gameModal) closeGame(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && gameModal.classList.contains("open")) closeGame();
    });

    if (!LADDER) {
      notice("The online LeBron Ladder isn't connected yet — check back soon.");
      joinForm.hidden = true;
      return;
    }

    joinBtn.addEventListener("click", doJoin);
    handleEl.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); doJoin(); } });
    startBtn.addEventListener("click", startMatch);
    againBtn.addEventListener("click", startMatch);
    switchBtn.addEventListener("click", doSwitch);

    player = load(PLAYER_KEY, null);
    if (player && player.id) {
      rpc("get_player", { p_id: player.id }).then(function (p) {
        if (!p) { player = null; save(PLAYER_KEY, null); }
        else { player = { id: player.id, handle: p.handle, rating: p.rating }; savePlayer(); }
        renderJoin();
      }).catch(function () { renderJoin(); });
    } else {
      player = null;
      renderJoin();
    }
  }

  function setupShare() {
    var b = document.getElementById("shareBtn");
    if (!b) return;
    b.addEventListener("click", function () {
      var data = { title: "Draft LeBron 2028", text: "I just signed the draft. LeBron for President. Add your name:", url: location.href };
      if (navigator.share) navigator.share(data).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(data.text + " " + data.url).then(function () { toast("Link copied. Send it to one person."); });
      else toast(location.href);
    });
  }

  // ---- campaign portrait + anthem ----
  // Both assets are optional: each feature reveals itself only when its file
  // actually loads, so nothing shows up broken before the files are added.
  function setupExtras() {
    // second photo: lebron in suit/tie/sunglasses -> img/lebron-suit.jpg
    var sec = document.getElementById("portrait");
    var pi = document.getElementById("portraitImg");
    if (sec && pi) {
      var reveal = function () { if (pi.naturalWidth > 0) sec.hidden = false; };
      if (pi.complete) reveal();
      pi.addEventListener("load", reveal);
      pi.addEventListener("error", function () { sec.hidden = true; });
    }

    // theme song "Oh, Mister LeBron" -> theme.mp3
    var audio = document.getElementById("anthem");
    var btn = document.getElementById("anthemBtn");
    var icon = document.getElementById("anthemIcon");
    var label = document.getElementById("anthemLabel");
    if (!audio || !btn) return;

    function setPlaying(on) {
      if (icon) icon.innerHTML = on ? "&#10073;&#10073;" : "&#9654;";
      if (label) label.textContent = on ? "PAUSE THE ANTHEM" : "PLAY THE ANTHEM";
    }
    audio.addEventListener("loadedmetadata", function () { btn.hidden = false; });
    audio.addEventListener("error", function () { btn.hidden = true; });
    audio.addEventListener("ended", function () { setPlaying(false); });
    audio.addEventListener("pause", function () { setPlaying(false); });
    audio.addEventListener("play", function () { setPlaying(true); });
    btn.addEventListener("click", function () {
      if (audio.paused) audio.play().catch(function () { toast("Couldn't play the anthem."); });
      else audio.pause();
    });
    audio.load();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var yr = document.getElementById("yr"); if (yr) yr.textContent = String(new Date().getFullYear());
    sizeCanvas();
    fillStates(); buildMarquee(); setupForm(); setupShare(); setupTrivia(); setupExtras(); renderWall();
    paint(false);
    setTimeout(function () { paint(true); }, 300);

    document.getElementById("modalClose").addEventListener("click", closeModal);
    var m = document.getElementById("modal");
    m.addEventListener("click", function (e) { if (e.target === m) closeModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
    window.addEventListener("resize", sizeCanvas);
  });
})();
