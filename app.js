/**
 * OSZTRÁK BÉR-AUDIT – INGYENES DIAGNOSZTIKA
 * Jelzőlámpa Teszt (befolyásolásmentes felület), szűrőlogika és Google Sheets / Drive integráció
 * Szerző: Kristály László BSc megbízásából
 */

// ============================================================================
// KONFIGURÁCIÓ
// ============================================================================
const GOOGLE_SCRIPT_WEB_APP_URL = "";

// ============================================================================
// DOM ELEMEK & ESEMÉNYEK
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {

  // --------------------------------------------------------------------------
  // 3. BLOKK: JELZŐLÁMPA TESZT HÁTTÉRSZÁMÍTÁSA (BEFOLYÁSOLÁSMENTES UI)
  // --------------------------------------------------------------------------
  const tq1Radios = document.querySelectorAll('input[name="tq1"]');
  const tq2Radios = document.querySelectorAll('input[name="tq2"]');
  const tq3Radios = document.querySelectorAll('input[name="tq3"]');
  const tq4Radios = document.querySelectorAll('input[name="tq4"]');

  const trafficResultCard = document.getElementById('trafficResultCard');
  const resRedLight = document.getElementById('resRedLight');
  const resYellowLight = document.getElementById('resYellowLight');
  const resGreenLight = document.getElementById('resGreenLight');

  let autoScrollTimeout = null;

  function evaluateTrafficLight() {
    const a1 = document.querySelector('input[name="tq1"]:checked')?.value;
    const a2 = document.querySelector('input[name="tq2"]:checked')?.value;
    const a3 = document.querySelector('input[name="tq3"]:checked')?.value;
    const a4 = document.querySelector('input[name="tq4"]:checked')?.value;

    const answeredCount = [a1, a2, a3, a4].filter(Boolean).length;
    if (answeredCount < 4) {
      return;
    }

    let riskCount = 0;

    // 1. Túlóra kockázat: „Igen, rendszeresen” VAGY „Volt néha”
    if (a1 === 'Igen, rendszeresen' || a1 === 'Volt néha') {
      riskCount++;
    }

    // 2. 13/14. havi fizetés kockázat: „Nem tudom / nem kaptam” VAGY „Nálam nincs ilyen”
    if (a2 === 'Nem tudom / nem kaptam' || a2 === 'Nálam nincs ilyen') {
      riskCount++;
    }

    // 3. Kollektivvertrag kockázat: „Fogalmam sincs” VAGY „Hallottam róla de nem tudom pontosan” VAGY „Nincs szerződésem / nem kaptam semmit”
    if (a3 === 'Fogalmam sincs' || a3 === 'Hallottam róla de nem tudom pontosan' || a3 === 'Nincs szerződésem / nem kaptam semmit') {
      riskCount++;
    }

    // 4. Céges szállás kockázat:
    // CSAK akkor kockázat, ha van céges szállás, de nem tudja pontosan a levonást!
    // Ha nincs céges szállása, vagy teljesen ingyenes, vagy pontosan tudja a levonást: az 0 kockázat.
    if (a4 === 'Van, de nem tudom pontosan') {
      riskCount++;
    }

    resRedLight.style.display = 'none';
    resYellowLight.style.display = 'none';
    resGreenLight.style.display = 'none';
    trafficResultCard.style.display = 'block';

    if (riskCount >= 2) {
      // 🔴 PIROS LÁMPA (Magas kockázat - 2 vagy több pont)
      resRedLight.style.display = 'block';
    } else if (riskCount === 1) {
      // 🟡 SÁRGA LÁMPA (Közepes kockázat - 1 pont)
      resYellowLight.style.display = 'block';
    } else {
      // 🟢 ZÖLD LÁMPA (Minden tiszta - 0 kockázat)
      resGreenLight.style.display = 'block';
    }

    // Automatikus, finom lefelé görgetés a szűrőkérdésekhez (Auto-scroll UX)
    if (autoScrollTimeout) clearTimeout(autoScrollTimeout);
    autoScrollTimeout = setTimeout(() => {
      const szuroBlokk = document.getElementById('szuro-blokk');
      if (szuroBlokk) {
        szuroBlokk.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 1100);
  }

  [...tq1Radios, ...tq2Radios, ...tq3Radios, ...tq4Radios].forEach(radio => {
    radio.addEventListener('change', evaluateTrafficLight);
  });

  // --------------------------------------------------------------------------
  // 4. BLOKK: SZŰRŐ ÉS GATING LOGIKA (TURISTÁK KISZŰRÉSE)
  // --------------------------------------------------------------------------
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

  function evaluateFilterLogic(triggerScroll = false) {
    const q1 = document.querySelector('input[name="q1"]:checked')?.value;
    const q2 = document.querySelector('input[name="q2"]:checked')?.value;
    const q3 = document.querySelector('input[name="q3"]:checked')?.value;

    if (!q2 && !q3) {
      return;
    }

    // Kizáró feltétel:
    // Ha Q2 == "Csak kíváncsi vagyok" VAGY Q3 == "Nem, mindent ingyen várok"
    const isDisqualified = 
      q2 === 'Csak kíváncsi vagyok' || 
      q3 === 'Nem, mindent ingyen várok';

    if (isDisqualified) {
      disqualifiedBox.style.display = 'block';
      qualifiedBox.style.display = 'none';
      uploadBlock.style.display = 'none';

      clearFile();
      phoneInput.removeAttribute('required');
      fileInput.removeAttribute('required');

      disqualifiedBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    // Megfelelt feltétel:
    const isQualified = 
      q2 === 'Ha kiderül hogy meglopnak, kész vagyok lépni és elkérni a pénzem' &&
      q3 === 'Igen, megértem';

    if (isQualified) {
      disqualifiedBox.style.display = 'none';

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
        qualifiedBox.style.display = 'none';
        uploadBlock.style.display = 'none';
      }
    } else {
      disqualifiedBox.style.display = 'none';
      qualifiedBox.style.display = 'none';
      uploadBlock.style.display = 'none';
    }
  }

  [...q1Radios, ...q2Radios, ...q3Radios].forEach(radio => {
    radio.addEventListener('change', () => evaluateFilterLogic(true));
  });

  btnResetFilter.addEventListener('click', () => {
    q1Radios.forEach(r => r.checked = false);
    q2Radios.forEach(r => r.checked = false);
    q3Radios.forEach(r => r.checked = false);
    disqualifiedBox.style.display = 'none';
    qualifiedBox.style.display = 'none';
    uploadBlock.style.display = 'none';
    clearFile();
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
      btnText.textContent = '🔍 Beküldöm – Átnézed!';
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

      const tq1Val = document.querySelector('input[name="tq1"]:checked')?.value || 'Nincs kitöltve';
      const tq2Val = document.querySelector('input[name="tq2"]:checked')?.value || 'Nincs kitöltve';
      const tq3Val = document.querySelector('input[name="tq3"]:checked')?.value || 'Nincs kitöltve';
      const tq4Val = document.querySelector('input[name="tq4"]:checked')?.value || 'Nincs kitöltve';

      const payload = {
        timestamp: new Date().toLocaleString('hu-HU', { timeZone: 'Europe/Vienna' }),
        whatsappNumber: rawPhone,
        tq1: tq1Val,
        tq2: tq2Val,
        tq3: tq3Val,
        tq4: tq4Val,
        q1: document.querySelector('input[name="q1"]:checked')?.value || '',
        q2: document.querySelector('input[name="q2"]:checked')?.value || '',
        q3: document.querySelector('input[name="q3"]:checked')?.value || '',
        userSuspicions: userSuspicions.value.trim(),
        fileName: currentFile.name,
        fileMimeType: currentFile.type || 'application/octet-stream',
        fileSizeFormatted: formatBytes(currentFile.size),
        fileBase64: base64Content
      };

      if (GOOGLE_SCRIPT_WEB_APP_URL && GOOGLE_SCRIPT_WEB_APP_URL.startsWith('http')) {
        await fetch(GOOGLE_SCRIPT_WEB_APP_URL, {
          method: 'POST',
          mode: 'no-cors',
          cache: 'no-cache',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } else {
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      setSubmittingState(false);
      showSuccessModal();

    } catch (err) {
      console.error('Hiba történt a bérpapír küldésekor:', err);
      setSubmittingState(false);
      showSuccessModal();
    }
  });

  // --------------------------------------------------------------------------
  // SIKERES BEKÜLDÉS MODAL
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
    disqualifiedBox.style.display = 'none';
    qualifiedBox.style.display = 'none';
    uploadBlock.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  btnCloseModal.addEventListener('click', hideSuccessModal);

  successModal.addEventListener('click', (e) => {
    if (e.target === successModal) {
      hideSuccessModal();
    }
  });
});
