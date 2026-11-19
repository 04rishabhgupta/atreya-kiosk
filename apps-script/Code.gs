/**
 * atreya.ai kiosk backend, as a Google Apps Script web app bound to the response spreadsheet.
 * Paste into Extensions > Apps Script. No Google Cloud project or service account is needed:
 * the script runs as the deploying account and stores files in that account's Drive.
 *
 * Script properties (Project Settings > Script properties):
 *   SECRET           long random string, same value as APPS_SCRIPT_SECRET on the Next.js server
 *   DRIVE_FOLDER_ID  folder that receives one subfolder per submission
 *
 * The Next.js server validates everything and sends the column headers it fills; this script only
 * stores files, appends the row, and keeps retries from creating duplicates.
 *
 * Values are placed by matching header names in row 1, not by position, so columns can be inserted
 * or reordered in the sheet without misaligning rows. Headers the sheet lacks are added at the end.
 *
 * Photos (1920x1080 PNG, ~3.5 MB each) are too big to send together, so each arrives first in its own
 * "part" request (one or more pieces). The final request then joins each photo's pieces into one file
 * and writes the row. Older kiosk pages that still send small JPEGs inside the final request keep working.
 */

var TAB = "Form_Responses";
var ID_HEADER = "Subject ID";
var MAX_FILES = 6;
var MAX_FILE_B64 = 6 * 1024 * 1024; // one 4 MB photo piece is ~5.3 MB of base64
var MAX_PARTS = 3; // pieces per photo
var PHOTO_NAME = /^[a-z]+\.png$/;

function doGet() {
  return json_({ ok: true, service: "atreya-kiosk" });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty("SECRET");
    if (!secret || !req || req.secret !== secret) return json_({ ok: false, error: "unauthorized" });
    return json_(handle_(req, props));
  } catch (err) {
    var msg = String((err && err.message) || err);
    console.error("kiosk_error " + msg.slice(0, 200)); // message only, never the payload
    var busy = /too many|rate|quota|lock|timed out|service|unavailable/i.test(msg);
    return json_({ ok: false, error: busy ? "busy" : "server" });
  }
}

function validIds_(req) {
  return /^[0-9a-f-]{36}$/i.test(String(req.submissionKey || "")) && /^ATR-[0-9A-Z]{5}-[0-9A-Z]{5}$/.test(String(req.referenceId));
}

function handle_(req, props) {
  if (req.action === "part") return part_(req, props);
  var key = String(req.submissionKey || "");
  var headers = req.headers;
  var parts = req.parts || [];
  if (!validIds_(req) || !Array.isArray(headers) || !Array.isArray(req.files) || req.files.length > MAX_FILES || !Array.isArray(parts) || parts.length > MAX_FILES) {
    return { ok: false, error: "invalid" };
  }
  for (var j = 0; j < parts.length; j++) {
    var ps = parts[j];
    if (!ps || !PHOTO_NAME.test(String(ps.name)) || !(ps.count >= 1 && ps.count <= MAX_PARTS) || !ps.header) return { ok: false, error: "invalid" };
  }

  // One submission at a time: makes "already saved?" checks and folder creation race-free.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { ok: false, error: "busy" };
  try {
    var layout = ensureSheet_(headers);
    var sheet = layout.sheet;
    var idCol = layout.cols.indexOf(ID_HEADER) + 1;
    if (!idCol) return { ok: false, error: "invalid" };

    // Already appended by an earlier attempt? The Subject ID is derived from the kiosk's key, so a retry
    // carries the same one.
    var hit = sheet.getRange(1, idCol, sheet.getMaxRows(), 1).createTextFinder(String(req.referenceId)).matchEntireCell(true).findNext();
    if (hit && hit.getRow() > 1) {
      return { ok: true, referenceId: String(req.referenceId), duplicate: true };
    }

    var where = folderFor_(key, String(req.referenceId), req.dateStamp, props);
    var folder = where.folder;
    var ref = where.ref;
    var pKey = where.pKey;

    var cells = req.cells || {};
    cells[ID_HEADER] = ref;
    cells["Drive Folder Link"] = folder.getUrl();
    // Photos uploaded earlier in pieces: join each into its final file (idempotent on retry).
    for (var k = 0; k < parts.length; k++) {
      var photo = assemble_(folder, String(parts[k].name), Number(parts[k].count));
      if (!photo) return { ok: false, error: "busy" }; // a piece isn't visible yet: the server retries
      cells[parts[k].header] = photo.getUrl();
    }
    for (var i = 0; i < req.files.length; i++) {
      var f = req.files[i];
      if (String(f.data).length > MAX_FILE_B64) return { ok: false, error: "invalid" };
      var existing = folder.getFilesByName(f.name);
      var file = existing.hasNext()
        ? existing.next()
        : folder.createFile(Utilities.newBlob(Utilities.base64Decode(f.data), f.mime, f.name));
      cells[f.header] = file.getUrl(); // private: inherits the folder's sharing (named accounts only)
    }

    var row = layout.cols.map(function (h) {
      var v = cells[h];
      return v === undefined || v === null ? "" : v;
    });
    // RAW = stored exactly as sent: no formula evaluation, no date/number guessing.
    Sheets.Spreadsheets.Values.append({ values: [row] }, SpreadsheetApp.getActive().getId(), "'" + TAB + "'!A1", {
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
    });
    props.deleteProperty(pKey);
    return { ok: true, referenceId: ref };
  } finally {
    lock.releaseLock();
  }
}

/**
 * The participant's Drive folder: reused from an earlier partial attempt (remembered in script properties
 * until the row is written), otherwise created.
 */
function folderFor_(key, ref, dateStamp, props) {
  var pKey = "folder:" + key;
  var folder = null;
  var saved = props.getProperty(pKey);
  if (saved) {
    try {
      folder = DriveApp.getFolderById(saved.split("|")[0]);
      if (folder.isTrashed()) folder = null;
      else ref = saved.split("|")[1] || ref;
    } catch (_) {
      folder = null;
    }
  }
  if (!folder) {
    var parent = DriveApp.getFolderById(props.getProperty("DRIVE_FOLDER_ID"));
    folder = parent.createFolder(ref + "_" + String(dateStamp).replace(/[^0-9]/g, ""));
    props.setProperty(pKey, folder.getId() + "|" + ref);
  }
  return { folder: folder, ref: ref, pKey: pKey };
}

/** True if the sheet already has a row with this Subject ID (a retry after a lost response). */
function alreadySaved_(ref) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(TAB);
  if (!sheet || !sheet.getLastColumn()) return false;
  var cols = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var idCol = cols.indexOf(ID_HEADER) + 1;
  if (!idCol) return false;
  var hit = sheet.getRange(1, idCol, sheet.getMaxRows(), 1).createTextFinder(ref).matchEntireCell(true).findNext();
  return !!(hit && hit.getRow() > 1);
}

/** Stores one piece of a photo as "<name>.part<i>" in the participant's folder. Safe to repeat. */
function part_(req, props) {
  var name = String(req.name || "");
  var index = Number(req.index);
  if (!validIds_(req) || !PHOTO_NAME.test(name) || !(index >= 0 && index < MAX_PARTS) || Math.floor(index) !== index || typeof req.data !== "string" || req.data.length > MAX_FILE_B64) {
    return { ok: false, error: "invalid" };
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { ok: false, error: "busy" };
  try {
    var ref = String(req.referenceId);
    // Already submitted (retry after a lost response): don't start a new folder for nothing.
    if (alreadySaved_(ref)) return { ok: true, referenceId: ref, duplicate: true };
    var folder = folderFor_(String(req.submissionKey), ref, req.dateStamp, props).folder;
    var partName = name + ".part" + index;
    // A finished photo or an already-stored piece is complete (Drive creates files atomically): keep it.
    if (!findFile_(folder, name) && !findFile_(folder, partName)) {
      folder.createFile(Utilities.newBlob(Utilities.base64Decode(req.data), "image/png", partName));
    }
    return { ok: true, referenceId: ref };
  } finally {
    lock.releaseLock();
  }
}

/** The first non-trashed file with this name in the folder, or null. */
function findFile_(folder, name) {
  var it = folder.getFilesByName(name);
  while (it.hasNext()) {
    var f = it.next();
    if (!f.isTrashed()) return f;
  }
  return null;
}

/** Joins a photo's pieces into "<name>" (or reuses it if already joined). Null if a piece is missing. */
function assemble_(folder, name, count) {
  var done = findFile_(folder, name);
  if (done) return done;
  var pieces = [];
  for (var i = 0; i < count; i++) {
    var piece = findFile_(folder, name + ".part" + i);
    if (!piece) return null;
    pieces.push(piece);
  }
  // One piece (the usual case) already is the whole PNG: just rename it, no re-upload.
  if (count === 1) return pieces[0].setName(name);
  var bytes = [];
  for (var p = 0; p < pieces.length; p++) bytes = bytes.concat(pieces[p].getBlob().getBytes());
  var file = folder.createFile(Utilities.newBlob(bytes, "image/png", name));
  for (var q = 0; q < pieces.length; q++) pieces[q].setTrashed(true);
  return file;
}

/**
 * Create the tab if missing and add any of `headers` not yet in row 1 at the end.
 * Returns the sheet's actual header row: the row to append follows that order.
 */
function ensureSheet_(headers) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
  var lastCol = sheet.getLastColumn();
  var cols = lastCol
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); })
    : [];
  while (cols.length && cols[cols.length - 1] === "") cols.pop();
  var missing = headers.filter(function (h) { return cols.indexOf(h) < 0; });
  if (missing.length) {
    var need = cols.length + missing.length;
    var maxCols = sheet.getMaxColumns();
    if (maxCols < need) sheet.insertColumnsAfter(maxCols, need - maxCols);
    sheet.getRange(1, cols.length + 1, 1, missing.length).setValues([missing]);
    cols = cols.concat(missing);
  }
  return { sheet: sheet, cols: cols };
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
