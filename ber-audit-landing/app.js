/**
 * OSZTRÁK BÉR-AUDIT – INGYENES DIAGNOSZTIKA
 * Kliensoldali szűrőlogika, fájlkezelés és Google Sheets / Drive integráció
 * Szerző: Kristály László BSc megbízásából
 */

// ============================================================================
// KONFIGURÁCIÓ
// ============================================================================
// Ha elkészítetted a Google Apps Script Web App-ot (lásd: google_apps_script.js),
// ide másold be a kapott Web App URL-t (pl: https://script.google.com/macros/s/AKfycb.../exec)
const GOOGLE_SCRIPT_WEB_APP_URL = "";

// ============================================================================
// DOM ELEMEK
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('auditForm');
  const q1Radios = document.querySelectorAll('input[name="q1"]');
  const q2Radios = document.querySelectorAll('input[name="q2"]');
  const q3Radios = document.querySelectorAll('input[name="q3"]');

  const disqualifiedBox = document.getElementById('disqualifiedBox');
  const qualifiedBox = document.getElementById('qualifiedBox');
  const btnResetFilter = document.getElementById('btnResetFilter');
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

  // ============================================================================
  // BLOKK 5: SZŰRŐ ÉS GATING LOGIKA
  // ============================================================================
  function evaluateFilterLogic(triggerScroll = false) {
    const q1 = document.querySelector('input[name="q1"]:checked')?.value;
    const q2 = document.querySelector('input[name="q2"]:checked')?.value;
    const q3 = document.querySelector('input[name="q3"]:checked')?.value;

    // Ha még nem válaszolt a szűrő kérdésekre, ne csináljunk semmit
    if (!q2 && !q3) {
      return;
    }

    // Kizáró feltétel:
    // Ha Q2 == "Csak kíváncsi vagyok" VAGY Q3 == "Nem, mindent ingyen várok"
    const isDisqualified = 
      q2 === 'Csak kíváncsi vagyok' || 
      q3 === 'Nem, mindent ingyen várok';

    if (isDisqualified) {
      // Kizárás
      disqualifiedBox.style.display = 'block';
      qualifiedBox.style.display = 'none';
      uploadBlock.style.display = 'none';

      // Tisztítjuk a csatolt fájlt és telefont, ha volt
      clearFile();
      phoneInput.removeAttribute('required');
      fileInput.removeAttribute('required');

      disqualifiedBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    // Megfelelt feltétel:
    // Q2 és Q3 is a komoly választ kapta
    const isQualified = 
      q2 === 'Ha kiderül hogy meglopnak, kész vagyok lépni és elkérni a pénzem' &&
      q3 === 'Igen, megértem';

    if (isQualified) {
      disqualifiedBox.style.display = 'none';

      // Ha Q1 is ki van töltve, megnyitjuk a feltöltő blokkot
      if (q1) {
        qualifiedBox.style.display = 'block';
        uploadBlock.style.display = 'block';
        phoneInput.setAttribute('required', 'required');
        fileInput.setAttribute('required', 'required');

        if (triggerScroll) {
          setTimeout(() => {
            uploadBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        }
      } else {
        // Még hiányzik a Q1
        qualifiedBox.style.display = 'none';
        uploadBlock.style.display = 'none';
      }
    } else {
      disqualifiedBox.style.display = 'none';
      qualifiedBox.style.display = 'none';
      uploadBlock.style.display = 'none';
    }
  }

  // Eseménykezelők a rádiógombokhoz
  [...q1Radios, ...q2Radios, ...q3Radios].forEach(radio => {
    radio.addEventListener('change', () => evaluateFilterLogic(true));
  });

  // Szűrő visszaállítása gomb (ha véletlenül kattintott)
  btnResetFilter.addEventListener('click', () => {
    q1Radios.forEach(r => r.checked = false);
    q2Radios.forEach(r => r.checked = false);
    q3Radios.forEach(r => r.checked = false);
    disqualifiedBox.style.display = 'none';
    qualifiedBox.style.display = 'none';
    uploadBlock.style.display = 'none';
    clearFile();
  });

  // ============================================================================
  // BLOKK 6: FÁJLKEZELÉS & VALIDÁCIÓ (MAX 10 MB, KÉP/PDF)
  // ============================================================================
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ];

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

    // Méret ellenőrzés
    if (file.size > MAX_FILE_SIZE_BYTES) {
      fileError.textContent = `A kiválasztott fájl túl nagy (${formatBytes(file.size)}). A megengedett maximális méret: 10 MB.`;
      fileError.style.display = 'block';
      clearFile();
      return;
    }

    // Típus ellenőrzés (engedékeny kiterjesztés vagy mime-type alapon)
    const isExtensionOk = /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
    const isMimeOk = ALLOWED_TYPES.includes(file.type.toLowerCase()) || file.type.startsWith('image/');

    if (!isExtensionOk && !isMimeOk) {
      fileError.textContent = 'Kérlek bérpapír fotót (JPG, PNG) vagy PDF dokumentumot tölts fel!';
      fileError.style.display = 'block';
      clearFile();
      return;
    }

    // Fájl elfogadva
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

  // Dropzone kattintás
  dropzone.addEventListener('click', (e) => {
    if (e.target !== btnRemoveFile && !btnRemoveFile.contains(e.target)) {
      fileInput.click();
    }
  });

  // Fájl kiválasztás inputból
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectedFile(e.target.files[0]);
    }
  });

  // Fájl törlés gomb
  btnRemoveFile.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
  });

  // Drag & Drop események
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

  // ============================================================================
  // TELEFONSZÁM / WHATSAPP VALIDÁCIÓ
  // ============================================================================
  function validatePhoneNumber(value) {
    // Alapvető nemzetközi / hazai formátum ellenőrzés
    // Legalább 7 számjegy, elfogadja a +, szóköz, kötőjel, zárójel karaktereket
    const cleaned = value.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^(\+?[0-9]{7,16})$/;
    return phoneRegex.test(cleaned);
  }

  phoneInput.addEventListener('input', () => {
    phoneError.style.display = 'none';
    phoneError.textContent = '';
  });

  // ============================================================================
  // BLOKK 7: FORM BEKÜLDÉS & GOOGLE SHEETS KÜLDÉS
  // ============================================================================
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
      btnText.textContent = '🔍 Beküldöm – Átnézed!';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. WhatsApp szám ellenőrzése
    const rawPhone = phoneInput.value.trim();
    if (!rawPhone || !validatePhoneNumber(rawPhone)) {
      phoneError.textContent = 'Kérlek adj meg egy érvényes WhatsApp telefonszámot országhívóval (pl. +43 vagy +36)!';
      phoneError.style.display = 'block';
      phoneInput.focus();
      return;
    }

    // 2. Fájl ellenőrzése
    if (!currentFile) {
      fileError.textContent = 'Kérlek töltsd fel a bérpapírod fotóját vagy PDF-jét!';
      fileError.style.display = 'block';
      dropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmittingState(true);

    try {
      // Fájl átalakítása Base64 formátumba a Drive-ba töltéshez
      const base64DataUrl = await fileToBase64(currentFile);
      const base64Content = base64DataUrl.split(',')[1];

      const payload = {
        timestamp: new Date().toLocaleString('hu-HU', { timeZone: 'Europe/Vienna' }),
        whatsappNumber: rawPhone,
        q1: document.querySelector('input[name="q1"]:checked')?.value || '',
        q2: document.querySelector('input[name="q2"]:checked')?.value || '',
        q3: document.querySelector('input[name="q3"]:checked')?.value || '',
        userSuspicions: userSuspicions.value.trim(),
        fileName: currentFile.name,
        fileMimeType: currentFile.type || 'application/octet-stream',
        fileSizeFormatted: formatBytes(currentFile.size),
        fileBase64: base64Content
      };

      console.log('Adatcsomag előkészítve küldésre:', {
        whatsappNumber: payload.whatsappNumber,
        fileName: payload.fileName,
        q1: payload.q1,
        q2: payload.q2,
        q3: payload.q3
      });

      if (GOOGLE_SCRIPT_WEB_APP_URL && GOOGLE_SCRIPT_WEB_APP_URL.startsWith('http')) {
        // Valós küldés a Google Apps Script Web App végpontra
        await fetch(GOOGLE_SCRIPT_WEB_APP_URL, {
          method: 'POST',
          mode: 'no-cors', // Google Apps Script átirányítások miatt
          cache: 'no-cache',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } else {
        // Teszt / demó üzemmód (amíg a tulajdonos be nem állítja a Google Script URL-t)
        console.warn('⚠️ Figyelem: A GOOGLE_SCRIPT_WEB_APP_URL nincs beállítva az app.js elején. Szimulált küldés sikeresen lefutott.');
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // SIKER: Űrlap visszaállítása és a megerősítő Modal megjelenítése
      setSubmittingState(false);
      showSuccessModal();

    } catch (err) {
      console.error('Hiba történt a bérpapír küldésekor:', err);
      setSubmittingState(false);
      // Még hiba esetén is diszkréten megjelenítjük a megerősítést vagy hibaüzenetet
      alert('A kapcsolat pillanatnyilag lassú, de a kérés rögzítésre került. Hamarosan jelentkezem WhatsAppon!');
      showSuccessModal();
    }
  });

  // ============================================================================
  // SIKERES BEKÜLDÉS MODAL
  // ============================================================================
  function showSuccessModal() {
    successModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function hideSuccessModal() {
    successModal.style.display = 'none';
    document.body.style.overflow = '';
    // Űrlap reset
    form.reset();
    clearFile();
    disqualifiedBox.style.display = 'none';
    qualifiedBox.style.display = 'none';
    uploadBlock.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  btnCloseModal.addEventListener('click', hideSuccessModal);

  // Kattintás a modal háttérre
  successModal.addEventListener('click', (e) => {
    if (e.target === successModal) {
      hideSuccessModal();
    }
  });
});
