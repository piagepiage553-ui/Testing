/**
 * The AI Compass: response store.
 *
 * Paste this into a Google Sheet's Apps Script editor (Extensions > Apps Script)
 * and deploy it as a web app (Execute as: Me, Who has access: Anyone).
 * See README.md for the full steps.
 *
 *   GET  -> { sources: ["direct", "betteroffline", ...], points: [x, y, sourceIndex, ...] }
 *   POST -> body {id, x, y, source, peeked}; inserts a new dot or moves an existing one.
 *
 * Respondent IDs are never returned by GET, so nobody can move someone else's dot.
 */

var SHEET_NAME = 'responses';
var HEADERS = ['id', 'x', 'y', 'source', 'peeked', 'created', 'updated'];
var CACHE_KEY = 'points_v1';
var CACHE_SECONDS = 20;
var CHUNK = 90000; // CacheService values max out at 100 KB

function doGet() {
  var cache = CacheService.getScriptCache();
  var body = readCache_(cache);
  if (!body) {
    body = JSON.stringify(collect_());
    writeCache_(cache, body);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }

  var id = String(data.id || '');
  if (!/^v[0-9a-f]{12,40}$/.test(id)) return json_({ ok: false, error: 'bad_id' });

  var x = Number(data.x), y = Number(data.y);
  if (!isFinite(x) || !isFinite(y)) return json_({ ok: false, error: 'bad_point' });
  x = clamp_(x);
  y = clamp_(y);

  var source = String(data.source || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30) || 'direct';
  var peeked = data.peeked ? 1 : 0;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return json_({ ok: false, error: 'busy' });
  try {
    var sheet = sheet_();
    var now = new Date();
    var found = sheet.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
    if (found && found.getRow() > 1) {
      // Moving an existing dot keeps its original source, peeked flag and created time.
      var row = found.getRow();
      sheet.getRange(row, 2, 1, 2).setValues([[x, y]]);
      sheet.getRange(row, 7).setValue(now);
    } else {
      sheet.appendRow([id, x, y, source, peeked, now, now]);
    }
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

function collect_() {
  var sheet = sheet_();
  var last = sheet.getLastRow();
  var sources = [], index = {}, points = [];
  if (last > 1) {
    var rows = sheet.getRange(2, 2, last - 1, 3).getValues(); // x, y, source
    for (var i = 0; i < rows.length; i++) {
      var x = Number(rows[i][0]), y = Number(rows[i][1]);
      if (rows[i][0] === '' || !isFinite(x) || !isFinite(y)) continue;
      var s = String(rows[i][2] || 'direct');
      if (!(s in index)) { index[s] = sources.length; sources.push(s); }
      points.push(clamp_(x), clamp_(y), index[s]);
    }
  }
  return { sources: sources, points: points };
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function clamp_(v) {
  return Math.max(-100, Math.min(100, Math.round(v)));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function readCache_(cache) {
  var n = Number(cache.get(CACHE_KEY + '_n'));
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < n; i++) keys.push(CACHE_KEY + '_' + i);
  var parts = cache.getAll(keys);
  var out = '';
  for (var j = 0; j < n; j++) {
    if (parts[keys[j]] == null) return null;
    out += parts[keys[j]];
  }
  return out;
}

function writeCache_(cache, body) {
  var entries = {}, n = 0;
  for (var i = 0; i < body.length; i += CHUNK) entries[CACHE_KEY + '_' + n++] = body.slice(i, i + CHUNK);
  entries[CACHE_KEY + '_n'] = String(n);
  try { cache.putAll(entries, CACHE_SECONDS); } catch (err) { /* too large to cache; serve uncached */ }
}

/** Run once from the editor to create the sheet tab and grant permissions. */
function setup() {
  sheet_();
}
