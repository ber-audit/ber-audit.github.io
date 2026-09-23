/**
 * OSZTRÁK BÉR-AUDIT V2 – PIACI VALIDÁCIÓS VERZIÓ
 * Jelzőlámpa Teszt, előminősítés, tracking rendszer, Google Sheets integráció
 */

// ============================================================================
// KONFIGURÁCIÓ
// ============================================================================
const GOOGLE_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbybA-aH1MhGofFdJA3HBqqowmlZUtl_ihelV3JW0V9E-RjnsOrxYjBHxma5o4QLbvGYGg/exec";

// Fizetős audit ár konfig – amíg nincs végleges ár, a blokk rejtett marad
const PAID_AUDIT_CONFIG = {
  enabled: false,       // Állítsd true-ra ha van végleges ár
  price: 0,             // Ár euróban, pl. 79
  currency: "€",
  description: ""
};

// ============================================================================
// ANALYTICS TRACKING MODUL
// ============================================================================
let VISITOR_ID = localStorage.getItem('ba_visitor_id');
if (!VISITOR_ID) {
  VISITOR_ID = crypto.randomUUID();
  localStorage.setItem('ba_visitor_id', VISITOR_ID);
}

let SESSION_ID = sessionStorage.getItem('ba_session_id');
if (!SESSION_ID) {
  SESSION_ID = crypto.randomUUID();
  sessionStorage.setItem('ba_session_id', SESSION_ID);
}

function detectSource() {
  const params = new URLSearchParams(window.location.search);
  const src = (params.get('src') || params.get('utm_source') || '').toLowerCase();
  if (src.includes('tiktok')) return 'source_tiktok';
  if (src.includes('facebook') || src.includes('fb')) return 'source_facebook';
  if (src.includes('youtube') || src.includes('yt')) return 'source_youtube';
  if (document.referrer) {
    const ref = document.referrer.toLowerCase();
    if (ref.includes('tiktok')) return 'source_tiktok';
    if (ref.includes('facebook') || ref.includes('fb.com')) return 'source_facebook';
    if (ref.includes('youtube') || ref.includes('youtu.be')) return 'source_youtube';
  }
  if (!document.referrer || document.referrer.includes(window.location.hostname)) return 'source_direct';
  return 'source_other';
}

const CURRENT_SOURCE = detectSource();
let FIRST_SOURCE = localStorage.getItem('ba_first_source');
if (!FIRST_SOURCE) {
  FIRST_SOURCE = CURRENT_SOURCE;
  localStorage.setItem('ba_first_source', FIRST_SOURCE);
}

const trackedEvents = new Set();

function trackEvent(eventName, additionalMetadata = {}) {
  const oneTimeEvents = ['landing_view', 'test_started', 'test_completed',
    'qualification_started', 'qualification_completed', 'document_upload_started'];
  if (oneTimeEvents.includes(eventName) && trackedEvents.has(eventName)) return;
  trackedEvents.add(eventName);

  const payloadMetadata = { 
    visitorId: VISITOR_ID, 
    currentSource: CURRENT_SOURCE,
    ...additionalMetadata
  };

  const event = {
    type: 'event',
    sessionId: SESSION_ID,
    event: eventName,
    timestamp: new Date().toISOString(),
    source: FIRST_SOURCE,
    metadata: JSON.stringify(payloadMetadata)
  };

  if (GOOGLE_SCRIPT_WEB_APP_URL && GOOGLE_SCRIPT_WEB_APP_URL.startsWith('http')) {
    try {
      fetch(GOOGLE_SCRIPT_WEB_APP_URL, {
        method: 'POST', mode: 'no-cors', cache: 'no-cache',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      }).catch(function() {});
    } catch(e) {}
  }

  try {
    const stored = JSON.parse(localStorage.getItem('ba_events') || '[]');
    stored.push(event);
    if (stored.length > 200) stored.splice(0, stored.length - 200);
    localStorage.setItem('ba_events', JSON.stringify(stored));
  } catch(e) {}
}

// ============================================================================
// DOM ELEMEK & ESEMÉNYEK
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {

  // Track landing view
  trackEvent('landing_view');

  // --------------------------------------------------------------------------
  // JELZŐLÁMPA TESZT
  // --------------------------------------------------------------------------
  const tq1Radios = document.querySelectorAll('input[name="tq1"]');
  const tq2Radios = document.querySelectorAll('input[name="tq2"]');
  const tq3Radios = document.querySelectorAll('input[name="tq3"]');
  const tq4Radios = document.querySelectorAll('input[name="tq4"]');

  const trafficResultCard = document.getElementById('trafficResultCard');
  const resRedLight = document.getElementById('resRedLight');
  const resYellowLight = document.getElementById('resYellowLight');
  const resGreenLight = document.getElementById('resGreenLight');

  let testStartTracked = false;
  let autoScrollTimeout = null;

  function evaluateTrafficLight() {
    const a1 = document.querySelector('input[name="tq1"]:checked')?.value;
    const a2 = document.querySelector('input[name="tq2"]:checked')?.value;
    const a3 = document.querySelector('input[name="tq3"]:checked')?.value;
    const a4 = document.querySelector('input[name="tq4"]:checked')?.value;

    // Track test_started on first interaction
    if (!testStartTracked && [a1, a2, a3, a4].some(Boolean)) {
      trackEvent('test_started');
      testStartTracked = true;
    }

    const answeredCount = [a1, a2, a3, a4].filter(Boolean).length;
    if (answeredCount < 4) return;

    // Track test_completed
    trackEvent('test_completed');

    let riskCount = 0;

    // 1. Túlóra kockázat
    if (a1 === 'Igen, rendszeresen' || a1 === 'Volt néha') riskCount++;

    // 2. Urlaubsgeld/Weihnachtsgeld kockázat
    if (a2 === 'Nem tudom, hogy jár-e vagy mennyi jár') riskCount++;
    if (a2 === 'Tudom, hogy jár, de nem tudom, jól számolták-e') riskCount++;

    // 3. Kollektivvertrag kockázat
    if (a3 === 'Fogalmam sincs' || a3 === 'Hallottam róla de nem tudom pontosan' || a3 === 'Nincs szerződésem / nem kaptam semmit') riskCount++;

    // 4. Céges szállás kockázat – csak ha van de nem tudja a levonást
    if (a4 === 'Van, de nem tudom pontosan') riskCount++;

    resRedLight.style.display = 'none';
    resYellowLight.style.display = 'none';
    resGreenLight.style.display = 'none';
    trafficResultCard.style.display = 'block';

    if (riskCount >= 2) {
      resRedLight.style.display = 'block';
      trackEvent('result_red', { riskCount });
    } else if (riskCount === 1) {
      resYellowLight.style.display = 'block';
      trackEvent('result_yellow', { riskCount });
    } else {
      resGreenLight.style.display = 'block';
      trackEvent('result_green', { riskCount });
    }

    // Auto-scroll to filter section
    if (autoScrollTimeout) clearTimeout(autoScrollTimeout);
    autoScrollTimeout = setTimeout(() => {
      const szuroBlokk = document.getElementById('szuro-blokk');
      if (szuroBlokk) szuroBlokk.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 1100);
  }

  [...tq1Radios, ...tq2Radios, ...tq3Radios, ...tq4Radios].forEach(radio => {
    radio.addEventListener('change', evaluateTrafficLight);
  });

  // --------------------------------------------------------------------------
  // ELŐMINŐSÍTŐ KÉRDÉSEK (ÚJ LOGIKA – NINCS KIZÁRÁS)
  // --------------------------------------------------------------------------
  const form = document.getElementById('auditForm');
  const q1Radios = document.querySelectorAll('input[name="q1"]');
  const q2Radios = document.querySelectorAll('input[name="q2"]');
  const q3Radios = document.querySelectorAll('input[name="q3"]');

  const notWillingBox = document.getElementById('notWillingBox');
  const browsingOnlyBox = document.getElementById('browsingOnlyBox');
  const qualifiedBox = document.getElementById('qualifiedBox');
  const uploadBlock = document.getElementById('uploadBlock');

  const fileInput = document.getElementById('payslipFile');
  const dropzone = document.getElementById('fileDropzone');
  const dropzoneIdle = document.getElementById('dropzoneIdle');
  const dropzoneActive = document.getElementById('dropzoneActiveFile');
  const fileNameEl = document.getElementById('fileName');
  const fileSizeEl = document.getElementById('fileSize');
  const fileTypeIcon = document.getElementById('fileTypeIcon');
  const btnRemoveFile = document.getElementById('btnRemoveFile');
  const fileError = document.getElementById('fileError');

  const phoneInput = document.getElementById('whatsappNumber');
  const phoneError = document.getElementById('phoneError');
  const userSuspicions = document.getElementById('userSuspicions');

  const btnSubmit = document.getElementById('btnSubmitAudit');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnText = document.getElementById('btnText');

  const successModal = document.getElementById('successModal');
  const btnCloseModal = document.getElementById('btnCloseModal');

  let currentFile = null;
  let qualificationStartTracked = false;

  function hideAllStatusBoxes() {
    notWillingBox.style.display = 'none';
    browsingOnlyBox.style.display = 'none';
    qualifiedBox.style.display = 'none';
    uploadBlock.style.display = 'none';
  }

  function evaluateFilterLogic() {
    const q1 = document.querySelector('input[name="q1"]:checked')?.value;
    const q2 = document.querySelector('input[name="q2"]:checked')?.value;
    const q3 = document.querySelector('input[name="q3"]:checked')?.value;

    // Track qualification_started
    if (!qualificationStartTracked && (q1 || q2 || q3)) {
      trackEvent('qualification_started');
      qualificationStartTracked = true;
    }

    // Need at least Q2 and Q3 to evaluate
    if (!q2 || !q3) {
      hideAllStatusBoxes();
      return;
    }

    // Track specific payment willingness
    if (q3 === 'Igen') trackEvent('willing_to_pay_yes');
    if (q3 === 'Előbb szeretném tudni, pontosan mit tartalmaz és mennyibe kerül') trackEvent('willing_to_pay_details_first');
    if (q3 === 'Nem szeretnék fizetős szolgáltatást') trackEvent('not_willing_to_pay');

    // Case 1: Not willing to pay – barátságos üzenet, NEM kizárás
    if (q3 === 'Nem szeretnék fizetős szolgáltatást') {
      hideAllStatusBoxes();
      notWillingBox.style.display = 'block';
      notWillingBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    // Case 2: Only browsing
    if (q2 === 'Egyelőre csak tájékozódom') {
      hideAllStatusBoxes();
      browsingOnlyBox.style.display = 'block';
      browsingOnlyBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    // Case 3: Qualified
    const q2ok = (q2 === 'Igen' || q2 === 'Attól függ, mit találunk');
    const q3ok = (q3 === 'Igen' || q3 === 'Előbb szeretném tudni, pontosan mit tartalmaz és mennyibe kerül');

    if (q2ok && q3ok) {
      trackEvent('qualification_completed');
      if (q1) {
        hideAllStatusBoxes();
        qualifiedBox.style.display = 'block';
        uploadBlock.style.display = 'block';
        phoneInput.setAttribute('required', 'required');
        fileInput.setAttribute('required', 'required');
        setTimeout(() => {
          uploadBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
    } else {
      hideAllStatusBoxes();
    }
  }

  [...q1Radios, ...q2Radios, ...q3Radios].forEach(radio => {
    radio.addEventListener('change', evaluateFilterLogic);
  });

  // --------------------------------------------------------------------------
  // 5. BLOKK: FÁJLKEZELÉS & VALIDÁCIÓ (MAX 10 MB, KÉP/PDF)
  // --------------------------------------------------------------------------
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ];

  let uploadStartTracked = false;

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function handleSelectedFile(file) {
    fileError.style.display = 'none';
    fileError.textContent = '';

    if (!file) {
      clearFile();
      return;
    }

    if (!uploadStartTracked) {
      trackEvent('document_upload_started');
      uploadStartTracked = true;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      fileError.textContent = `A kiválasztott fájl túl nagy (${formatBytes(file.size)}). A megengedett maximális méret: 10 MB.`;
      fileError.style.display = 'block';
      clearFile();
      return;
    }

    const isExtensionOk = /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
    const isMimeOk = ALLOWED_TYPES.includes(file.type.toLowerCase()) || file.type.startsWith('image/');

    if (!isExtensionOk && !isMimeOk) {
      fileError.textContent = 'Kérlek bérpapír fotót (JPG, PNG) vagy PDF dokumentumot tölts fel!';
      fileError.style.display = 'block';
      clearFile();
      return;
    }

    currentFile = file;
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatBytes(file.size);

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      fileTypeIcon.textContent = '📑';
    } else {
      fileTypeIcon.textContent = '🖼️';
    }

    dropzoneIdle.style.display = 'none';
    dropzoneActive.style.display = 'block';
  }

  function clearFile() {
    currentFile = null;
    fileInput.value = '';
    dropzoneIdle.style.display = 'block';
    dropzoneActive.style.display = 'none';
  }

  dropzone.addEventListener('click', (e) => {
    if (e.target !== btnRemoveFile && !btnRemoveFile.contains(e.target)) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectedFile(e.target.files[0]);
    }
  });

  btnRemoveFile.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      handleSelectedFile(files[0]);
    }
  });

  // --------------------------------------------------------------------------
  // TELEFONSZÁM / WHATSAPP VALIDÁCIÓ
  // --------------------------------------------------------------------------
  function validatePhoneNumber(value) {
    const cleaned = value.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^(\+?[0-9]{7,16})$/;
    return phoneRegex.test(cleaned);
  }

  phoneInput.addEventListener('input', () => {
    phoneError.style.display = 'none';
    phoneError.textContent = '';
  });

  // --------------------------------------------------------------------------
  // FORM BEKÜLDÉS & GOOGLE SHEETS KÜLDÉS
  // --------------------------------------------------------------------------
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  function setSubmittingState(isSubmitting) {
    if (isSubmitting) {
      btnSubmit.disabled = true;
      btnSpinner.style.display = 'inline-block';
      btnText.textContent = 'Feldolgozás és küldés...';
    } else {
      btnSubmit.disabled = false;
      btnSpinner.style.display = 'none';
      btnText.textContent = 'Beküldöm az első ellenőrzésre';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawPhone = phoneInput.value.trim();
    if (!rawPhone || !validatePhoneNumber(rawPhone)) {
      phoneError.textContent = 'Kérlek adj meg egy érvényes WhatsApp telefonszámot országhívóval (pl. +43 vagy +36)!';
      phoneError.style.display = 'block';
      phoneInput.focus();
      return;
    }

    if (!currentFile) {
      fileError.textContent = 'Kérlek töltsd fel a bérpapírod fotóját vagy PDF-jét!';
      fileError.style.display = 'block';
      dropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmittingState(true);

    try {
      const base64DataUrl = await fileToBase64(currentFile);
      const base64Content = base64DataUrl.split(',')[1];

      const payload = {
        type: 'submission',
        sessionId: SESSION_ID,
        timestamp: new Date().toLocaleString('hu-HU', { timeZone: 'Europe/Vienna' }),
        whatsappNumber: rawPhone,
        tq1: document.querySelector('input[name="tq1"]:checked')?.value || '',
        tq2: document.querySelector('input[name="tq2"]:checked')?.value || '',
        tq3: document.querySelector('input[name="tq3"]:checked')?.value || '',
        tq4: document.querySelector('input[name="tq4"]:checked')?.value || '',
        q1: document.querySelector('input[name="q1"]:checked')?.value || '',
        q2: document.querySelector('input[name="q2"]:checked')?.value || '',
        q3: document.querySelector('input[name="q3"]:checked')?.value || '',
        userSuspicions: userSuspicions.value.trim(),
        fileName: currentFile.name,
        fileMimeType: currentFile.type || 'application/octet-stream',
        fileSizeFormatted: formatBytes(currentFile.size),
        fileBase64: base64Content,
        source: FIRST_SOURCE
      };

      if (GOOGLE_SCRIPT_WEB_APP_URL && GOOGLE_SCRIPT_WEB_APP_URL.startsWith('http')) {
        await fetch(GOOGLE_SCRIPT_WEB_APP_URL, {
          method: 'POST',
          mode: 'no-cors',
          cache: 'no-cache',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      trackEvent('document_submitted');
      setSubmittingState(false);
      showSuccessModal();

    } catch (err) {
      console.error('Hiba történt a bérpapír küldésekor:', err);
      trackEvent('document_submitted');
      setSubmittingState(false);
      showSuccessModal();
    }
  });

  // --------------------------------------------------------------------------
  // SUCCESS MODAL
  // --------------------------------------------------------------------------
  function showSuccessModal() {
    successModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function hideSuccessModal() {
    successModal.style.display = 'none';
    document.body.style.overflow = '';
    form.reset();
    clearFile();
    hideAllStatusBoxes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  btnCloseModal.addEventListener('click', hideSuccessModal);

  successModal.addEventListener('click', (e) => {
    if (e.target === successModal) hideSuccessModal();
  });

  // --------------------------------------------------------------------------
  // WHATSAPP LINK TRACKING (kizárólag explicit WhatsApp link/CTA kattintásra)
  // --------------------------------------------------------------------------
  document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"], .btn-whatsapp').forEach(link => {
    link.addEventListener('click', () => {
      trackEvent('whatsapp_started');
    });
  });
});

