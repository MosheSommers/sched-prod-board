import { fetchIncidents, ack } from './api.js';

const REFRESH_MS = 2000;
const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const list = $('incident-list');
let loader = $('loader');
let empty = null;
const errorBox = $('error');

// Ack state outlives re-renders: a refresh must not un-ack a row.
const acked = new Map(); // incident id -> receipt
const pending = new Set();

// Viewer's own locale and zone; the locale decides dd/mm vs mm/dd.
const timeFormat = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
});

function span(cls, text) {
  const el = document.createElement('span');
  el.className = cls;
  el.textContent = text;
  return el;
}

function ackedMark(receipt) {
  const el = document.createElement('span');
  el.className = 'acked';
  el.dataset.testid = 'acked';
  el.textContent = 'Acked';
  el.title = receipt;
  return el;
}

// The first characters of the receipt show on screen, so a recording of
// the board can be matched to the receipt the API sealed.
function receiptNote(receipt) {
  return span('receipt', `receipt ${receipt.slice(0, 10)}…`);
}

function ackButton(id) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ack';
  btn.dataset.testid = 'ack';
  btn.textContent = 'Ack';
  btn.addEventListener('click', () => askToAck(id));
  return btn;
}

function buildRow(i) {
  const row = document.createElement('li');
  row.dataset.testid = 'incident-row';
  row.dataset.id = i.id;
  row.className = `row ${i.severity}`;
  const time = document.createElement('time');
  time.dateTime = i.openedAt; // full UTC value
  time.textContent = timeFormat.format(new Date(i.openedAt));
  const action = document.createElement('span');
  action.className = 'action';
  row.append(
    span('id', i.id),
    span('sev', i.severity),
    span('what', `${i.service} · ${i.region} · ${i.summary}`),
    time,
    action,
  );
  return row;
}

function paintAction(row) {
  const action = row.querySelector('.action');
  const id = row.dataset.id;
  action.replaceChildren(
    ...(acked.has(id)
      ? [ackedMark(acked.get(id)), receiptNote(acked.get(id))]
      : [ackButton(id)]),
  );
  const btn = action.querySelector('button');
  if (btn) btn.disabled = pending.has(id);
}

// Keyed update: rows already on screen are kept as they are, so a click
// or hover in flight is never lost to a refresh. New rows go in order.
function render(incidents) {
  const sorted = [...incidents].sort(
    (a, b) => new Date(b.openedAt) - new Date(a.openedAt),
  );
  const existing = new Map(
    [...list.children].map((row) => [row.dataset.id, row]),
  );
  const keep = new Set(sorted.map((i) => i.id));
  for (const [id, row] of existing) if (!keep.has(id)) row.remove();
  let prev = null;
  for (const i of sorted) {
    let row = existing.get(i.id);
    if (!row) {
      row = buildRow(i);
      paintAction(row);
    }
    const expected = prev ? prev.nextElementSibling : list.firstElementChild;
    if (row !== expected) list.insertBefore(row, expected);
    prev = row;
  }
  // The loader and the empty note leave the DOM instead of hiding.
  loader?.remove();
  loader = null;
  if (sorted.length === 0 && !empty) {
    empty = document.createElement('p');
    empty.dataset.testid = 'empty';
    empty.className = 'note';
    empty.textContent = 'No incidents right now.';
    list.before(empty);
  } else if (sorted.length > 0 && empty) {
    empty.remove();
    empty = null;
  }
  list.hidden = sorted.length === 0;
}

// Ack asks first. The dialog names the incident the click landed on, so a
// list that shifted under the pointer shows up before anything is sent.
const dialog = $('confirm');
const confirmAck = $('confirm-ack');
let asking = null;

function askToAck(id) {
  if (pending.has(id) || acked.has(id)) return;
  const row = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
  asking = id;
  $('confirm-title').textContent = `Ack ${id}?`;
  $('confirm-detail').textContent = row ? row.querySelector('.what').textContent : '';
  confirmAck.textContent = `Ack ${id}`;
  if (!dialog.open) dialog.showModal();
  $('confirm-cancel').focus(); // a stray Enter cancels, it does not ack
}

confirmAck.addEventListener('click', () => {
  const id = asking;
  asking = null;
  dialog.close();
  if (id) onAck(id);
});
$('confirm-cancel').addEventListener('click', () => {
  asking = null;
  dialog.close();
});
dialog.addEventListener('cancel', () => {
  asking = null; // Esc
});

async function onAck(id) {
  if (pending.has(id) || acked.has(id)) return;
  pending.add(id);
  const row = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (row) paintAction(row);
  try {
    const reply = await ack(id);
    acked.set(id, reply.receipt);
    errorBox.hidden = true;
  } catch (err) {
    errorBox.textContent = `Could not ack ${id}. Try again.`;
    errorBox.hidden = false;
    console.error(err);
  } finally {
    pending.delete(id);
    const current = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (current) paintAction(current);
  }
}

// One request at a time, started every REFRESH_MS: a slow answer can
// never land after a newer one.
async function loop() {
  for (;;) {
    const started = Date.now();
    try {
      const page = await fetchIncidents();
      render(page.incidents);
      if (!pending.size) errorBox.hidden = true;
    } catch (err) {
      console.error(err);
      if (loader) loader.textContent = 'Still trying to load incidents…';
      else {
        errorBox.textContent = 'Connection lost. Retrying…';
        errorBox.hidden = false;
      }
    }
    const wait = Math.max(0, REFRESH_MS - (Date.now() - started));
    await new Promise((r) => setTimeout(r, wait));
  }
}

loop();
