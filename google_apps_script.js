/**
 * ============================================================================
 * OSZTRÁK BÉR-AUDIT – GOOGLE APPS SCRIPT HÁTTÉRRENDSZER (STANDALONE VERZIÓ)
 * ============================================================================
 */

const SPREADSHEET_NAME = "Osztrák Bér-Audit Adatbázis";
const FOLDER_NAME = "Osztrák Bér-Audit Feltöltések";

// Ez a függvény automatikusan megkeresi vagy létrehozza a táblázatot
function getOrCreateSpreadsheet() {
  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  return SpreadsheetApp.create(SPREADSHEET_NAME);
}

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

function initialSetup() {
  const ss = getOrCreateSpreadsheet();
  
  // 1. Leads Sheet
  let leadsSheet = ss.getSheetByName('Leads');
  if (!leadsSheet) {
    if (ss.getSheets()[0].getName() === 'Sheet1' || ss.getSheets()[0].getName() === 'Munka1') {
      leadsSheet = ss.getSheets()[0];
      leadsSheet.setName('Leads');
    } else {
      leadsSheet = ss.insertSheet('Leads');
    }
  }
  
  const leadsHeaders = [
    "Időpont", "Session ID", "Forrás", "WhatsApp", 
    "T1 (Túlóra)", "T2 (13/14 havi)", "T3 (KV)", "T4 (Szállás)",
    "Q1 (Miért)", "Q2 (Lépne)", "Q3 (Fizetős)", 
    "Gyanú / Leírás", "Fájlnév", "Drive Link"
  ];
  
  if (leadsSheet.getLastRow() === 0) {
    leadsSheet.appendRow(leadsHeaders);
    const headerRange = leadsSheet.getRange(1, 1, 1, leadsHeaders.length);
    headerRange.setBackground("#ff5e1a").setFontColor("#ffffff").setFontWeight("bold");
    leadsSheet.setFrozenRows(1);
  }

  // 2. Events Sheet
  let eventsSheet = ss.getSheetByName('Events');
  if (!eventsSheet) {
    eventsSheet = ss.insertSheet('Events');
  }
  
  const eventsHeaders = ["Session ID", "Esemény", "Időpont", "Forrás", "Metaadatok"];
  
  if (eventsSheet.getLastRow() === 0) {
    eventsSheet.appendRow(eventsHeaders);
    const headerRange = eventsSheet.getRange(1, 1, 1, eventsHeaders.length);
    headerRange.setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
    eventsSheet.setFrozenRows(1);
  }
  
  // Drive mappa létrehozása ha még nincs
  getOrCreateFolder(FOLDER_NAME);
  Logger.log("A beállítás sikeresen lefutott! Létrehoztam az 'Osztrák Bér-Audit Adatbázis' fájlt a Drive-odon.");
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const type = postData.type || 'submission';
    const ss = getOrCreateSpreadsheet();
    
    // ANALYTICS ESEMÉNYEK KEZELÉSE
    if (type === 'event') {
      let eventsSheet = ss.getSheetByName('Events');
      if (!eventsSheet) {
        initialSetup();
        eventsSheet = ss.getSheetByName('Events');
      }
      
      const eventRow = [
        postData.sessionId || 'ismeretlen',
        postData.event || 'unknown',
        postData.timestamp || new Date().toISOString(),
        postData.source || 'unknown',
        postData.metadata || ''
      ];
      
      eventsSheet.appendRow(eventRow);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // BÉRPAPÍR BEKÜLDÉS KEZELÉSE (LEADS)
    if (type === 'submission') {
      const folder = getOrCreateFolder(FOLDER_NAME);
      let fileUrl = "Nincs csatolva";
      let fileName = postData.fileName || "ismeretlen_berpapir";
      
      if (postData.fileBase64) {
        const decodedBytes = Utilities.base64Decode(postData.fileBase64);
        const mimeType = postData.fileMimeType || "application/octet-stream";
        
        const cleanPhone = (postData.whatsappNumber || "anonim").replace(/[^0-9+]/g, '');
        const uniqueFileName = `${cleanPhone}_${new Date().getTime()}_${fileName}`;
        
        const blob = Utilities.newBlob(decodedBytes, mimeType, uniqueFileName);
        const savedFile = folder.createFile(blob);
        fileUrl = savedFile.getUrl();
      }
      
      let leadsSheet = ss.getSheetByName('Leads');
      if (!leadsSheet) {
        initialSetup();
        leadsSheet = ss.getSheetByName('Leads');
      }
      
      const rowData = [
        postData.timestamp || new Date().toLocaleString("hu-HU", { timeZone: "Europe/Vienna" }),
        postData.sessionId || 'ismeretlen',
        postData.source || 'unknown',
        postData.whatsappNumber || "",
        postData.tq1 || "",
        postData.tq2 || "",
        postData.tq3 || "",
        postData.tq4 || "",
        postData.q1 || "",
        postData.q2 || "",
        postData.q3 || "",
        postData.userSuspicions || "",
        fileName,
        fileUrl
      ];
      
      leadsSheet.appendRow(rowData);
      
      return ContentService
        .createTextOutput(JSON.stringify({ status: "success", fileUrl: fileUrl }))
        .setMimeType(ContentService.MimeType.JSON);
    }
      
  } catch (error) {
    Logger.log("Hiba: " + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  if (e.parameter.action === 'getStats') {
    try {
      const ss = getOrCreateSpreadsheet();
      const eventsSheet = ss.getSheetByName('Events');
      if (!eventsSheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Nincs Events munkalap" })).setMimeType(ContentService.MimeType.JSON);
      }
      
      const data = eventsSheet.getDataRange().getValues();
      const stats = {
        uniqueVisitors: 0,
        testsStarted: 0,
        testsCompleted: 0,
        resultRed: 0,
        resultYellow: 0,
        resultGreen: 0,
        disqualified: 0,
        qualified: 0,
        formSubmits: 0,
        whatsappStarts: 0,
        freeReviewsCompleted: 0,
        paidOffersShown: 0,
        purchases: 0
      };
      
      const sessionIds = new Set();
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const sessionId = row[0];
        const eventName = row[1];
        
        if (eventName === 'landing_view') {
          if (!sessionIds.has(sessionId)) {
            stats.uniqueVisitors++;
            sessionIds.add(sessionId);
          }
        } else if (eventName === 'test_started') stats.testsStarted++;
        else if (eventName === 'test_completed') stats.testsCompleted++;
        else if (eventName === 'result_red') stats.resultRed++;
        else if (eventName === 'result_yellow') stats.resultYellow++;
        else if (eventName === 'result_green') stats.resultGreen++;
        else if (eventName === 'not_willing_to_pay') stats.disqualified++;
        else if (eventName === 'qualification_completed') stats.qualified++;
        else if (eventName === 'document_submitted') stats.formSubmits++;
        else if (eventName === 'whatsapp_started') stats.whatsappStarts++;
        else if (eventName === 'free_review_completed') stats.freeReviewsCompleted++;
        else if (eventName === 'paid_offer_shown') stats.paidOffersShown++;
        else if (eventName === 'purchase_completed') stats.purchases++;
      }
      
      return ContentService
        .createTextOutput(JSON.stringify({ status: "success", data: stats }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "Osztrák Bér-Audit Webhook V2 (Standalone) működik!" }))
    .setMimeType(ContentService.MimeType.JSON);
}
