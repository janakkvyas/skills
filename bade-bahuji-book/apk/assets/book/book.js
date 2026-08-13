/* Digital book bootstrap: builds page DOM from pages.js and drives StPageFlip. */
(function () {
  "use strict";

  var STORAGE_KEY = "badebahuji.page";

  // ---- build page elements ----
  var bookEl = document.getElementById("book");
  var frag = document.createDocumentFragment();

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
