// ===== Business details & default terms (edit here) =====
const BUSINESS = {
  address1: '385 B Ampitiya Rd,',
  address2: 'Kandy 20160',
  phone: '070 741 3515',
};
const VALID_DAYS = 30;
const TERMS = {
  per_person: [
    'Price quoted is per person.',
    'Final guest count to be confirmed at least 3 days before the event.',
    'An advance payment is required to confirm the booking.',
    `This quotation is valid for ${VALID_DAYS} days from the date of issue.`,
  ],
  itemized: [
    'Prices include the items and services stated above.',
    'Final requirements to be confirmed at least 3 days before the event.',
    'An advance payment is required to confirm the booking.',
    `This quotation is valid for ${VALID_DAYS} days from the date of issue.`,
  ],
};
const FIRST_QUOTE_NO = 4; // VQ-2026-001..003 were made by hand

// ===== Helpers =====
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n, dec = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const E = 'contenteditable="true" spellcheck="false"';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
const isSinhala = (s) => /[඀-෿]/.test(s || '');

let current = null;

// ===== Quotation number & date =====
function nextQuoteNo() {
  const year = new Date().getFullYear();
  const n = Number(store.get(`viyana.qno.${year}`)) || FIRST_QUOTE_NO;
  return `VQ-${year}-${String(n).padStart(3, '0')}`;
}
function bumpQuoteNo() {
  const year = new Date().getFullYear();
  const n = Number(store.get(`viyana.qno.${year}`)) || FIRST_QUOTE_NO;
  store.set(`viyana.qno.${year}`, String(n + 1));
}
function issueDate() {
  const v = $('qdate').value;
  return v ? new Date(v + 'T00:00:00') : new Date();
}

// ===== Rendering =====
function headerHtml() {
  return `<header>
    <img src="logo.png" alt="The Viyana logo">
    <div class="brand"><div class="eyebrow">Kandy Catering Service</div><h1>The Viyana</h1><div class="sub">Cafe &amp; Family Restaurant</div></div>
    <div class="contact"><b>ADDRESS</b><br>${esc(BUSINESS.address1)}<br>${esc(BUSINESS.address2)}<br><b>PHONE</b><br>${esc(BUSINESS.phone)}</div>
  </header>`;
}
function footerHtml() {
  return `<footer><em>Thank you for choosing The Viyana</em>${esc(BUSINESS.address1.replace(/,$/, ''))}, ${esc(BUSINESS.address2)} &nbsp;•&nbsp; ${esc(BUSINESS.phone)}</footer>`;
}

function itemLabel(i, sinhalaClass) {
  return `${esc(i.name)}${i.note ? `<span class="note">(${esc(i.note)})</span>` : ''}${i.sinhala && isSinhala(i.sinhala) ? `<span class="si ${sinhalaClass}">${esc(i.sinhala)}</span>` : ''}`;
}

function menuHtml(d) {
  const all = d.sections.flatMap((s) => s.items);
  const head = `<div class="menu-head"><h3 ${E}>${esc(d.menu_title)}</h3><div class="rule">✦</div></div>`;

  // Items with piece counts -> table layout
  if (all.some((i) => i.qty)) {
    const multi = d.sections.length > 1;
    const rows = d.sections.map((s) =>
      (multi ? `<tr><td colspan="2" class="secrow" ${E}>${esc(s.title)}</td></tr>` : '') +
      s.items.map((i) => `<tr><td><span class="en" ${E}>${itemLabel(i, 'si-inline')}</span></td><td class="q" ${E}>${
        i.qty ? `${esc(i.qty)} <span>pcs</span>` : '<span class="pill">Included</span>'}</td></tr>`).join('')
    ).join('');
    return `<section class="menu">${head}<table class="qtbl"><thead><tr><th>Item</th><th class="q">Quantity</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }

  const sec = (s) => `<div class="sec"><h4 ${E}>${esc(s.title)}</h4><ul>${s.items.map((i) => `<li ${E}>${itemLabel(i, 'si-inline')}</li>`).join('')}</ul></div>`;

  // Short menu -> single centred column
  if (d.sections.length < 2 || all.length <= 6) {
    return `<section class="menu single">${head}${d.sections.map(sec).join('')}</section>`;
  }

  // Longer menu -> two balanced columns, keeping section order
  const total = all.length;
  let acc = 0, split = d.sections.length - 1;
  for (let k = 0; k < d.sections.length; k++) {
    acc += d.sections[k].items.length + 1;
    if (acc >= (total + d.sections.length) / 2) { split = k + 1; break; }
  }
  split = Math.min(Math.max(split, 1), d.sections.length - 1);
  return `<section class="menu">${head}<div class="cols"><div>${d.sections.slice(0, split).map(sec).join('')}</div><div>${d.sections.slice(split).map(sec).join('')}</div></div></section>`;
}

function priceHtml(d) {
  const p = d.pricing;
  if (p.type === 'itemized') {
    const rows = p.lines.map((l) => `<tr><td><b ${E}>${esc(l.description)}</b>${l.details ? `<small ${E}>${esc(l.details)}</small>` : ''}</td><td class="a" ${E}>${money(l.amount)}</td></tr>`).join('');
    const total = p.lines.length > 1
      ? `<tr class="total"><td class="lbl">Total Amount</td><td class="a" ${E}><sup>Rs.</sup>${money(p.total, 0)}/=</td></tr>`
      : `<tr class="total"><td class="lbl">Total Amount</td><td class="a" ${E}><sup>Rs.</sup>${money(p.lines[0]?.amount, 0)}/=</td></tr>`;
    return `<table class="cost"><thead><tr><th>Description</th><th class="a">Amount (Rs.)</th></tr></thead><tbody>${rows}${total}</tbody></table>`;
  }
  const left = d.includes.length
    ? `<h5>Package Includes</h5><ul>${['Complete menu as listed above', ...d.includes].map((x) => `<li ${E}>${esc(x)}</li>`).join('')}</ul>`
    : `<h5>Notes</h5><ul>${['Full menu as listed above', ...d.notes].map((x) => `<li ${E}>${esc(x)}</li>`).join('')}</ul>`;
  return `<div class="price"><div class="l">${left}</div><div class="r"><small>Package Price</small><div class="amt" ${E}><sup>Rs.</sup>${money(p.per_person_price, 0)}/=</div><div class="per" ${E}>per person</div></div></div>`;
}

function render(d) {
  const issued = issueDate();
  const valid = new Date(issued.getTime() + VALID_DAYS * 864e5);
  const c = d.client;
  const field = (label, v) => `<div class="f">${label}<p ${E}>${esc(v)}</p></div>`;
  const terms = (TERMS[d.pricing.type] || TERMS.per_person).slice();
  if (d.pricing.type === 'per_person' && d.includes.some((x) => /cutlery|service|staff/i.test(x))) {
    terms[0] = 'Price quoted is per person, inclusive of cutlery and service.';
  }

  $('page').innerHTML = `${headerHtml()}
  <main>
    <div class="title-row">
      <h2><small>CATERING</small>QUOTATION</h2>
      <div class="meta">
        <div><span class="l">Quotation No.</span> <span ${E}>${esc($('qno').value)}</span></div>
        <div><span class="l">Date</span> ${fmtDate(issued)}</div>
        <div><span class="l">Valid Until</span> ${fmtDate(valid)}</div>
      </div>
    </div>
    <div class="client">
      ${field('Prepared For', c.prepared_for)}${field('Event / Occasion', c.event)}${field('Event Date', c.event_date)}
      ${field('Venue', c.venue)}${field('Contact No.', c.contact)}${field('No. of Guests', c.guests)}
    </div>
    ${menuHtml(d)}
    ${priceHtml(d)}
    <div class="terms">
      <div class="t"><h6>Terms &amp; Conditions</h6><ol>${terms.map((t) => `<li ${E}>${esc(t)}</li>`).join('')}</ol></div>
      <div class="sign"><div class="ln">Authorized Signature</div></div>
    </div>
  </main>
  ${footerHtml()}`;
  $('page').classList.remove('empty');
  fitToPage();
  document.title = `Viyana_Quotation_${$('qno').value}${c.prepared_for ? '_' + c.prepared_for.replace(/[^\w]+/g, '_') : ''}`;
}

function renderEmpty() {
  $('page').innerHTML = `${headerHtml()}<main><p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20pt;color:#9a9450;text-align:center">Paste the order details and press<br><b>Create Quotation</b></p></main>${footerHtml()}`;
  $('page').classList.add('empty');
}

// Shrink long menus so everything stays on one A4 page
function fitToPage() {
  const page = $('page'), main = page.querySelector('main');
  let k = 1;
  page.style.setProperty('--k', k);
  while (main.scrollHeight > main.clientHeight + 1 && k > 0.62) {
    k = Math.round((k - 0.04) * 100) / 100;
    page.style.setProperty('--k', k);
  }
}

// Scale the A4 preview to the screen width (screen only; print is always full size)
function scalePreview() {
  const wrap = $('previewWrap'), sc = $('scaler'), page = $('page');
  const avail = wrap.clientWidth - (window.innerWidth > 900 ? 56 : 16);
  const s = Math.min(1, avail / page.offsetWidth);
  sc.style.transform = `scale(${s})`;
  sc.style.height = page.offsetHeight * s + 'px';
}

// ===== Actions =====
async function generate() {
  const text = $('order').value.trim();
  const st = $('status');
  if (!text) { st.textContent = 'Paste the order details first.'; st.className = 'status err'; return; }
  $('gen').disabled = true;
  st.className = 'status';
  st.textContent = 'Reading the order…';
  try {
    const call = () => fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Password': store.get('viyana.pw') || '' },
      body: JSON.stringify({ text }),
    });
    let res;
    try { res = await call(); } catch { res = await call(); } // one retry for dropped connections
    if (res.status === 401) {
      const pw = prompt('Enter the quotation maker password');
      if (pw == null) throw new Error('Password needed');
      store.set('viyana.pw', pw);
      res = await call();
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Server error ${res.status}`);
    current = body;
    render(current);
    scalePreview();
    bumpQuoteNo();
    st.textContent = 'Done. Check the quotation, then Download PDF.';
  } catch (e) {
    let msg = e.message;
    if (location.protocol === 'file:') {
      msg = 'This page was opened as a file. Start the server (npm start) and open http://localhost:3000 instead.';
    } else if (e instanceof TypeError) {
      msg = 'Cannot reach the quotation server (' + location.host + '). Make sure it is running, or that the site was deployed with its /api folder (e.g. on Vercel), not as static files only.';
    }
    st.textContent = 'Could not create the quotation: ' + msg;
    st.className = 'status err';
  } finally {
    $('gen').disabled = false;
  }
}

$('gen').addEventListener('click', generate);
$('order').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate(); });
$('print').addEventListener('click', () => window.print());
$('clear').addEventListener('click', () => {
  $('order').value = ''; current = null; $('qno').value = nextQuoteNo();
  $('status').textContent = ''; renderEmpty(); scalePreview(); $('order').focus();
});
$('qno').addEventListener('change', () => current && render(current));
$('qdate').addEventListener('change', () => current && render(current));
window.addEventListener('resize', scalePreview);

$('qno').value = nextQuoteNo();
$('qdate').valueAsDate = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
renderEmpty();
document.fonts?.ready.then(scalePreview);
scalePreview();
window.renderQuote = (d) => { current = d; render(d); scalePreview(); }; // for testing
