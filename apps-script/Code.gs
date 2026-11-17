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
 */

var TAB = "Form_Responses";
var ID_HEADER = "Subject ID";
var MAX_FILES = 6;
var MAX_FILE_B64 = 4 * 1024 * 1024;

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

function handle_(req, props) {
  var key = String(req.submissionKey || "");
  var headers = req.headers;
  if (!/^[0-9a-f-]{36}$/i.test(key) || !/^ATR-[0-9A-Z]{5}-[0-9A-Z]{5}$/.test(String(req.referenceId)) || !Array.isArray(headers) || !Array.isArray(req.files) || req.files.length > MAX_FILES) {
    return { ok: false, error: "invalid" };
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

    // Reuse the folder from an earlier partial attempt (remembered until the row is written).
    var pKey = "folder:" + key;
    var ref = String(req.referenceId);
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
      folder = parent.createFolder(ref + "_" + String(req.dateStamp).replace(/[^0-9]/g, ""));
      props.setProperty(pKey, folder.getId() + "|" + ref);
    }

    var cells = req.cells || {};
    cells[ID_HEADER] = ref;
    cells["Drive Folder Link"] = folder.getUrl();
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
