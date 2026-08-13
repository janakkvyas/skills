/*
 * Page manifest for the book.
 *
 * Each entry is either:
 *   { type: "html",  cls: "...", html: "..." }   — a styled HTML page
 *   { type: "image", src: "pages/001.jpg" }      — a full-bleed media page
 *
 * When the real "Bade Bahuji" media files are added, drop them into
 * assets/book/pages/ and replace the sample entries below with
 * { type: "image", src: "pages/<file>" } entries in reading order.
 * Keep the first and last entries as covers (they flip as hard pages).
 */

window.BOOK_PAGES = (function () {
  var pages = [];

  // ---- front cover (hard) ----
  pages.push({
    type: "html",
    hard: true,
    cls: "cover",
    html:
      '<div class="ornament">&#10064; &#10064; &#10064;</div>' +
      '<h1>बड़े बहूजी</h1>' +
      '<div class="rule"></div>' +
      '<div class="subtitle">डिजिटल पुस्तक &mdash; DIGITAL BOOK</div>'
  });

  // ---- notice page ----
  pages.push({
    type: "html",
    cls: "paper",
    html:
      '<h2>इस प्रति के बारे में</h2>' +
      '<p>यह &laquo;बड़े बहूजी&raquo; डिजिटल पुस्तक का पूर्वावलोकन (preview) संस्करण है। ' +
      'पृष्ठ पलटने के लिए किसी कोने को पकड़कर खींचिए, स्क्रीन के किनारे पर टैप कीजिए, ' +
      'या नीचे दिए गए तीरों का उपयोग कीजिए।</p>' +
      '<p class="small">This is a preview build. The original media files could not be ' +
      'attached, so these are sample pages. Once the book’s media (the zip file) is ' +
      'shared with the build session, its pages will replace these samples — the ' +
      'page-turn animation stays exactly the same.</p>' +
      '<div class="deco">&#10086;</div>' +
      '<div class="pgnum">1</div>'
  });

  // ---- sample content pages ----
  var i;
  for (i = 2; i <= 11; i++) {
    pages.push({
      type: "html",
      cls: "paper" + (i % 2 === 0 ? " even" : ""),
      html:
        '<h2>नमूना पृष्ठ ' + i + '</h2>' +
        '<p>आपकी पुस्तक का पृष्ठ यहाँ दिखाई देगा। जब मूल पुस्तक की छवियाँ (media files) ' +
        'जोड़ दी जाएँगी, तो यह नमूना पाठ हटाकर वास्तविक पृष्ठ लगा दिए जाएँगे।</p>' +
        '<p class="small">Your book’s page will appear here. Drag from the page corner ' +
        'to feel the paper curl — the animation follows your finger.</p>' +
        '<div class="deco">&#10087;</div>' +
        '<div class="pgnum">' + i + '</div>'
    });
  }

  // ---- back cover (hard) ----
  pages.push({
    type: "html",
    hard: true,
    cls: "cover",
    html:
      '<div class="ornament">&#10064;</div>' +
      '<div class="subtitle">समाप्त</div>' +
      '<div class="rule"></div>' +
      '<div class="subtitle">THE END</div>'
  });

  return pages;
})();
