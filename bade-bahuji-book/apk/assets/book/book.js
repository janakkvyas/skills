/* Digital book bootstrap: builds page DOM from pages.js and drives StPageFlip. */
(function () {
  "use strict";

  var STORAGE_KEY = "badebahuji.page";

  // ---- build page elements ----
  var bookEl = document.getElementById("book");
  var frag = document.createDocumentFragment();
  var pageEls = [];

  window.BOOK_PAGES.forEach(function (p) {
    var el = document.createElement("div");
    el.className = "page " + (p.cls || "");
    if (p.hard) el.setAttribute("data-density", "hard");

    var inner = document.createElement("div");
    inner.className = "page-inner";

    if (p.type === "image") {
      el.className += " photo";
      var img = document.createElement("img");
      img.src = p.src;
      img.draggable = false;
      inner.appendChild(img);
    } else {
      inner.innerHTML = p.html;
    }

    el.appendChild(inner);
    frag.appendChild(el);
    pageEls.push(el);
  });

  bookEl.appendChild(frag);

  // ---- restore last-read page ----
  var startPage = 0;
  try {
    var saved = parseInt(window.localStorage.getItem(STORAGE_KEY), 10);
    if (!isNaN(saved) && saved > 0 && saved < window.BOOK_PAGES.length) {
      startPage = saved;
    }
  } catch (e) { /* storage unavailable — start from cover */ }

  // ---- page flip engine ----
  var pageFlip = new St.PageFlip(bookEl, {
    width: 550,
    height: 780,
    size: "stretch",
    minWidth: 220,
    maxWidth: 2200,
    minHeight: 300,
    maxHeight: 2800,
    showCover: true,
    usePortrait: true,
    startPage: startPage,
    drawShadow: true,
    maxShadowOpacity: 0.45,
    flippingTime: 850,
    swipeDistance: 12,
    mobileScrollSupport: false,
    useMouseEvents: true
  });

  pageFlip.loadFromHTML(document.querySelectorAll(".page"));
  window.__flip = pageFlip; // exposed for tests/debugging
  window.__pageEls = pageEls;

  // Keep typography proportional to the real page box: pagination was measured
  // at the 550px reference width, so --pw must always track the page width.
  function setPw(w) {
    document.documentElement.style.setProperty("--pw", String(Math.round(w)));
  }

  // early estimate from the stage box, before the engine lays pages out
  (function () {
    var r = document.getElementById("stage").getBoundingClientRect();
    var w = r.width - 28, h = r.height - 28;
    var est = r.width > r.height
      ? Math.min(w / 2, (h * 550) / 780)
      : Math.min(w, (h * 550) / 780);
    if (est > 0) setPw(est);
  })();

  function updatePageWidth() {
    var pages = bookEl.querySelectorAll(".page");
    var w = 0;
    for (var i = 0; i < pages.length; i++) {
      if (pages[i].clientWidth > w) w = pages[i].clientWidth;
    }
    if (w > 0) setPw(w);
    return w > 0;
  }

  var pwTries = 0;
  function pollPw() {
    if (updatePageWidth()) {
      fitPages();
    } else if (pwTries++ < 120) {
      window.requestAnimationFrame(pollPw);
    }
  }
  pollPw();

  // ---- on-device auto-fit ----
  // Pagination was measured in desktop Chromium; a device's Devanagari font
  // can render taller lines. Measure every message page off-screen at the
  // current page size and shrink its text (--fit) until it fits its box.
  function fitPages() {
    var pw = parseFloat(
      document.documentElement.style.getPropertyValue("--pw")) || 550;
    var ph = (pw * 780) / 550;
    var meas = document.createElement("div");
    meas.className = "page paper";
    meas.style.cssText = "position:absolute;left:-9999px;top:0;width:" + pw +
      "px;height:" + ph + "px;visibility:hidden;pointer-events:none;overflow:hidden;";
    document.body.appendChild(meas);

    for (var i = 0; i < pageEls.length; i++) {
      var entry = window.BOOK_PAGES[i];
      if (!entry || entry.hard) continue;
      meas.style.setProperty("--fit", "1");
      meas.innerHTML = '<div class="page-inner">' + entry.html + "</div>";
      var body = meas.querySelector(".msgbody");
      if (!body) continue;
      var fit = 1.0;
      while (fit > 0.75 && body.scrollHeight > body.clientHeight + 1) {
        fit -= 0.03;
        meas.style.setProperty("--fit", String(fit));
      }
      var innerEl = pageEls[i].firstElementChild; // .page-inner; the engine
      if (!innerEl) continue;                     // rewrites the outer style
      if (fit < 1.0) {
        innerEl.style.setProperty("--fit", String(fit));
      } else {
        innerEl.style.removeProperty("--fit");
      }
    }
    document.body.removeChild(meas);
  }

  function refreshLayout() {
    if (updatePageWidth()) fitPages();
  }
  window.__fitPages = fitPages;

  // Fonts (and their metrics) can settle after first layout; re-fit a few
  // times early on so late metric changes never leave a page clipped.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { setTimeout(refreshLayout, 50); });
  }
  setTimeout(refreshLayout, 400);
  setTimeout(refreshLayout, 1200);

  pageFlip.on("changeOrientation", function () { setTimeout(refreshLayout, 60); });
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refreshLayout, 150);
  });

  // ---- page-turn sound (synthesised, no audio asset needed) ----
  var audioCtx = null;
  function playTurnSound() {
    try {
      if (!audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
      }
      if (audioCtx.state === "suspended") audioCtx.resume();

      var dur = 0.28;
      var rate = audioCtx.sampleRate;
      var buf = audioCtx.createBuffer(1, Math.floor(rate * dur), rate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) {
        var t = i / data.length;
        // noise burst shaped like a paper swish: quick rise, long fall
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2) * Math.min(1, t * 14);
      }
      var src = audioCtx.createBufferSource();
      src.buffer = buf;

      var filter = audioCtx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(900, audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(2800, audioCtx.currentTime + dur * 0.7);
      filter.Q.value = 0.9;

      var gain = audioCtx.createGain();
      gain.gain.value = 0.16;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      src.start();
    } catch (e) { /* sound is best-effort */ }
  }

  // ---- counter + persistence ----
  var counterEl = document.getElementById("counter");
  var total = window.BOOK_PAGES.length;

  function updateCounter(idx) {
    counterEl.textContent = (idx + 1) + " / " + total;
  }

  updateCounter(pageFlip.getCurrentPageIndex());

  pageFlip.on("flip", function (e) {
    updateCounter(e.data);
    playTurnSound();
    try { window.localStorage.setItem(STORAGE_KEY, String(e.data)); } catch (err) { /* ignore */ }
  });

  // ---- nav buttons ----
  document.getElementById("prev").addEventListener("click", function () {
    pageFlip.flipPrev("bottom");
  });
  document.getElementById("next").addEventListener("click", function () {
    pageFlip.flipNext("bottom");
  });
})();
