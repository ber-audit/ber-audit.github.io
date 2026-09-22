/**
 * ============================================================================
 * OSZTRÁK BÉR-AUDIT – GOOGLE APPS SCRIPT HÁTTÉRRENDSZER
 * ============================================================================
 * 
 * Ez a script kezeli a landing oldalról érkező beküldéseket:
 * 1. Automatikusan létrehoz egy "Osztrák Bér-Audit Feltöltések" nevű Drive mappát.
 * 2. Elmenti a feltöltött bérpapírt (PDF vagy kép) a Drive-ba.
 * 3. Hozzáadja az adatokat a Google Táblázat új soraként:
 *    Időbélyeg | WhatsApp szám | 1. kérdés | 2. kérdés | 3. kérdés | Gyanú | Fájlnév | Drive Link
 * 
 * BEÜZEMELÉSI ÚTMUTATÓ:
 * 1. Hozz létre egy új Google Táblázatot (pl. "Osztrák Bér-Audit Jelentkezések").
 * 2. A menüben menj a Bővítmények -> Apps Script (Extensions -> Apps Script) menüpontra.
 * 3. Töröld ki az ott lévő kódot, és másold be ezt a teljes fájlt.
 * 4. Kattints a Mentés ikonra (Floppy / Ctrl+S).
 * 5. Futtasd le egyszer az 'initialSetup' funkciót a fejléc beállításához (Engedélyezd a jogosultságokat).
 * 6. Kattints a jobb felső kék "Telepítés" (Deploy) gombra -> "Új telepítés" (New deployment).
 * 7. Válassz típust: "Webalkalmazás" (Web app).
 *    - Leírás: "Bér-Audit Végpont"
 *    - Végrehajtás mint: "Én" (Me)
 *    - Ki férhet hozzá: "Bárki" (Anyone) - EZ KÖTELEZŐ, hogy a weboldal be tudja küldeni!
 * 8. Kattints a "Telepítés" gombra.
 * 9. Másold ki a kapott Webalkalmazás URL-t (Web app URL).
 * 10. Nyisd meg az 'app.js' fájlt a weboldal mappájában, és illeszd be a GOOGLE_SCRIPT_WEB_APP_URL változóba!
 */

const FOLDER_NAME = "Osztrák Bér-Audit Feltöltések";

function initialSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  
  // Oszlopfejlécek beállítása
  const headers = [
    "Időpont",
    "WhatsApp Telefonszám",
    "1. Mióta nem stimmel?",
    "2. Mit szeretne elérni?",
    "3. Fix díj elfogadva?",
    "Gyanú / Felhasználó leírása",
    "Bérpapír Fájlnév",
    "Google Drive Bérpapír Link",
    "Fájl Méret"
  ];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#ff5e1a");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  
  // Drive mappa létrehozása ha még nincs
  getOrCreateFolder(FOLDER_NAME);
  Logger.log("A beállítás sikeresen lefutott!");
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    
    // 1. Google Drive mappa elérése / létrehozása
    const folder = getOrCreateFolder(FOLDER_NAME);
    
    // 2. Fájl dekódolása és mentése
    let fileUrl = "Nincs csatolva";
    let fileName = postData.fileName || "ismeretlen_berpapir";
    
    if (postData.fileBase64) {
      const decodedBytes = Utilities.base64Decode(postData.fileBase64);
      const mimeType = postData.fileMimeType || "application/octet-stream";
      
      // Tisztított fájlnév előtaggal
      const cleanPhone = (postData.whatsappNumber || "anonim").replace(/[^0-9+]/g, '');
      const uniqueFileName = `${cleanPhone}_${new Date().getTime()}_${fileName}`;
      
      const blob = Utilities.newBlob(decodedBytes, mimeType, uniqueFileName);
      const savedFile = folder.createFile(blob);
      fileUrl = savedFile.getUrl();
    }
    
    // 3. Adatok beírása a táblázatba
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getActiveSheet();
    
    // Ha a fejléc még hiányzik
    if (sheet.getLastRow() === 0) {
      initialSetup();
      sheet = ss.getActiveSheet();
    }
    
    const rowData = [
      postData.timestamp || new Date().toLocaleString("hu-HU", { timeZone: "Europe/Vienna" }),
      postData.whatsappNumber || "",
      postData.q1 || "",
      postData.q2 || "",
      postData.q3 || "",
      postData.userSuspicions || "",
      fileName,
      fileUrl,
      postData.fileSizeFormatted || ""
    ];
    
    sheet.appendRow(rowData);
    
    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", fileUrl: fileUrl }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log("Hiba: " + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "Osztrák Bér-Audit Webhook működik!" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}
