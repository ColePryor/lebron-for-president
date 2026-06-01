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
  // Honest count: example signatures shown on the board plus real ones from this device.
  function total() { return SEED.length + sigs.length; }

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

  function renderWall(freshName) {
    var wall = document.getElementById("wall");
    if (!wall) return;
    var mine = sigs.filter(function (s) { return s.quote; }).slice(-6).reverse();
    var items = mine.concat(SEED).slice(0, 6);
    wall.innerHTML = "";
    items.forEach(function (s) {
      var c = document.createElement("div");
      c.className = "wall-card" + (freshName && s.name === freshName ? " fresh" : "");
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
      renderWall(name);
      celebrate();
      openModal(mine);
      form.reset();
      st.selectedIndex = 0;

      var card = document.querySelector(".wall-card.fresh");
      if (card) setTimeout(function () { card.scrollIntoView({ behavior: "smooth", block: "center" }); }, 400);
    });
    form.addEventListener("input", function (e) { if (e.target.classList) e.target.classList.remove("bad"); });
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

  document.addEventListener("DOMContentLoaded", function () {
    var yr = document.getElementById("yr"); if (yr) yr.textContent = String(new Date().getFullYear());
    sizeCanvas();
    fillStates(); buildMarquee(); setupForm(); setupShare(); renderWall();
    paint(false);
    setTimeout(function () { paint(true); }, 300);

    document.getElementById("modalClose").addEventListener("click", closeModal);
    var m = document.getElementById("modal");
    m.addEventListener("click", function (e) { if (e.target === m) closeModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
    window.addEventListener("resize", sizeCanvas);
  });
})();
