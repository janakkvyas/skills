/*
 * Measured pagination: renders message text into a real page box (550x780,
 * the book's reference page size) using the app's actual CSS, and splits
 * messages at sentence boundaries so no page ever overflows.
 * Output: the app's pages.js (window.BOOK_PAGES).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = '/home/user/skills/bade-bahuji-book/apk/assets/book';
const MSGS = JSON.parse(fs.readFileSync(
  '/tmp/claude-0/-home-user-skills/b2580a5d-2a9f-5172-af06-0c0e3c668495/scratchpad/messages.json', 'utf8'));

const HINDI_MONTHS = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];

function hindiDate([y, m, d]) { return d + ' ' + HINDI_MONTHS[m - 1] + ' ' + y; }

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// message text -> list of units; each unit = {t: text, para: startsNewParagraph}
function toUnits(text) {
  const paras = text.split(/\n\s*\n|\n/).map(p => p.trim()).filter(Boolean);
  const units = [];
  for (const para of paras) {
    // split into sentences, keeping the danda/punctuation with the sentence
    const parts = para.match(/[^।॥!?]*[।॥!?]+[\s"'”’)]*|[^।॥!?]+$/g) || [para];
    let first = true;
    for (const p of parts) {
      const t = p.trim();
      if (!t) continue;
      units.push({ t, para: first });
      first = false;
    }
  }
  return units;
}

function unitsToHtml(units) {
  let html = '';
  let open = false;
  for (const u of units) {
    if (u.para || !open) {
      if (open) html += '</p>';
      html += '<p>';
      open = true;
      html += esc(u.t);
    } else {
      html += ' ' + esc(u.t);
    }
  }
  if (open) html += '</p>';
  return html;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 700, height: 900 } });

  const css = fs.readFileSync(path.join(ROOT, 'book.css'), 'utf8');
  await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>${css}</style>
    <style>
      html, body { background: #fff; overflow: auto; touch-action: auto; }
      /* 780 is the app's reference page height; measure at 738 so every page
         carries ~5% slack for devices whose fonts render taller lines */
      #measure { position: absolute; left: 20px; top: 20px; width: 550px; height: 738px; }
      :root { --pw: 550; }
    </style></head>
    <body><div id="measure" class="page paper"><div class="page-inner">
      <div class="msgdate"><span id="mdate">28 अक्टूबर 2025</span><span class="cont" id="mcont"></span></div>
      <div class="msgbody" id="mbody"></div>
      <div class="pgnum">888</div>
    </div></div></body></html>`);

  // fits(html, withEnd): put html (+ optional end-mark) in msgbody, report fit
  const fits = async (html, withEnd) => page.evaluate(([h, we]) => {
    const b = document.getElementById('mbody');
    b.innerHTML = h + (we ? '<div class="msgend">&#10087;</div>' : '');
    return b.scrollHeight <= b.clientHeight + 1;
  }, [html, withEnd]);

  // hard-split one oversized sentence by words (binary search the largest fitting prefix)
  async function splitLongUnit(unit) {
    const words = unit.t.split(/\s+/);
    let lo = 1, hi = words.length, best = 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const html = unitsToHtml([{ t: words.slice(0, mid).join(' ') + ' …', para: true }]);
      if (await fits(html, false)) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return [
      { t: words.slice(0, best).join(' ') + ' …', para: unit.para },
      { t: '… ' + words.slice(best).join(' '), para: true },
    ];
  }

  const bookPages = []; // {cls, html} message pages, then wrapped with date/pgnum later

  let msgIndex = 0;
  for (const msg of MSGS) {
    msgIndex++;
    let units = toUnits(msg.text);
    const chunks = []; // arrays of units per page
    let current = [];

    let i = 0;
    while (i < units.length) {
      const trial = current.concat([units[i]]);
      const isLastUnit = i === units.length - 1;
      if (await fits(unitsToHtml(trial), isLastUnit)) {
        current = trial;
        i++;
      } else if (current.length > 0) {
        chunks.push(current);
        current = [];
        units[i] = { t: units[i].t, para: true }; // continuation starts a paragraph
      } else {
        // single unit too big for an empty page: hard-split it
        const [head, tail] = await splitLongUnit(units[i]);
        chunks.push([head]);
        units[i] = tail;
      }
    }
    if (current.length) chunks.push(current);

    chunks.forEach((chunk, ci) => {
      const isFirst = ci === 0;
      const isLast = ci === chunks.length - 1;
      bookPages.push({
        date: hindiDate(msg.date),
        cont: !isFirst,
        end: isLast,
        body: unitsToHtml(chunk),
      });
    });
    process.stdout.write(`\rmsg ${msgIndex}/${MSGS.length}  pages so far: ${bookPages.length}   `);
  }
  console.log();
  await browser.close();

  // ---- assemble pages.js ----
  const first = MSGS[0].date, last = MSGS[MSGS.length - 1].date;
  const range = hindiDate(first) + ' से ' + hindiDate(last) + ' तक';

  const out = [];
  out.push({
    hard: true, cls: 'cover',
    html: '<div class="ornament">&#10064; &#10064; &#10064;</div>' +
      '<h1>बड़े बहूजी</h1>' +
      '<div class="rule"></div>' +
      '<div class="subtitle">सुविचार संग्रह<br>' + MSGS.length + ' संदेश</div>',
  });
  out.push({
    cls: 'paper',
    html: '<h2>इस पुस्तक के बारे में</h2>' +
      '<p>यह पुस्तक बड़े बहूजी द्वारा भेजे गये ' + MSGS.length + ' संदेशों का संग्रह है &mdash; ' +
      range + '। प्रत्येक संदेश अपनी मूल तिथि के साथ, समयक्रम में प्रस्तुत है।</p>' +
      '<p>पृष्ठ पलटने के लिए किसी कोने को पकड़कर खींचिए, स्क्रीन के किनारे पर टैप कीजिए, ' +
      'या नीचे दिए गए तीरों का उपयोग कीजिए। पुस्तक आपका अंतिम पढ़ा हुआ पृष्ठ स्वयं याद रखती है।</p>' +
      '<div class="deco">&#10086;</div>' +
      '<div class="pgnum">1</div>',
  });

  let pgnum = 1;
  for (const p of bookPages) {
    pgnum++;
    out.push({
      cls: 'paper',
      html: '<div class="msgdate"><span>' + p.date + '</span>' +
        (p.cont ? '<span class="cont">क्रमशः …</span>' : '') + '</div>' +
        '<div class="msgbody">' + p.body + (p.end ? '<div class="msgend">&#10087;</div>' : '') + '</div>' +
        '<div class="pgnum">' + pgnum + '</div>',
    });
  }

  out.push({
    hard: true, cls: 'cover',
    html: '<div class="ornament">&#10064;</div>' +
      '<div class="subtitle">समाप्त</div>' +
      '<div class="rule"></div>' +
      '<div class="subtitle">बड़े बहूजी &mdash; सुविचार संग्रह</div>',
  });

  // alternate spine shading by final index
  const entries = out.map((p, idx) => {
    const cls = p.cls + (p.cls === 'paper' && idx % 2 === 0 ? ' even' : '');
    return { hard: !!p.hard, cls, html: p.html };
  });

  const js = '/* Generated from the Bade Bahuji WhatsApp export by paginate.js.\n' +
    ' * ' + MSGS.length + ' unique messages -> ' + entries.length + ' pages (measured pagination).\n' +
    ' * Regenerate with: node paginate.js  (see repo build docs). Do not hand-edit. */\n' +
    'window.BOOK_PAGES = ' + JSON.stringify(entries, null, 1) + ';\n';
  fs.writeFileSync(path.join(ROOT, 'pages.js'), js);
  console.log('pages.js written:', entries.length, 'pages,',
    Math.round(js.length / 1024) + ' KB');
})();
