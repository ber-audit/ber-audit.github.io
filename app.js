/**
 * OSZTRÁK BÉR-AUDIT V2 – PIACI VALIDÁCIÓS VERZIÓ
 * Jelzőlámpa Teszt, előminősítés, tracking rendszer, Google Sheets integráció
 */

// ============================================================================
// KONFIGURÁCIÓ
// ============================================================================
const GOOGLE_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyRP-WwEZf-ik8_qra826MI9LFsCiDFVR8uTKqCv2kkZ5nTydTASW9Aj6tLFqPjgVVXHQ/exec";

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

    // Megjelenítjük a szűrő blokkot, de NEM görgetünk oda automatikusan,
    // így a felhasználó maga kattinthat a "Tovább" gombra, nem ugrik el a képernyő.
    const szuroBlokk = document.getElementById('szuro-blokk');
    if (szuroBlokk) {
      szuroBlokk.style.display = 'block';
    }
  }

  [...tq1Radios, ...tq2Radios, ...tq3Radios, ...tq4Radios].forEach(radio => {
    radio.addEventListener('change', evaluateTrafficLight);
  });

  // --------------------------------------------------------------------------
  // ELŐMINŐSÍTŐ KÉRDÉSEK (V2.1 - NINCS KIZÁRÁS)
  // --------------------------------------------------------------------------
  const form = document.getElementById('auditForm');
  const q1Radios = document.querySelectorAll('input[name="q1"]');
  const q2Radios = document.querySelectorAll('input[name="q2"]');
  const q3Radios = document.querySelectorAll('input[name="q3"]');
  const leadFormBlock = document.getElementById('leadFormBlock');
  const firstNameInput = document.getElementById('firstNameInput');
  const phoneInput = document.getElementById('whatsappNumber');
  const phoneError = document.getElementById('phoneError');
  const btnSubmit = document.getElementById('btnSubmitAudit');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnText = document.getElementById('btnText');
  const successModal = document.getElementById('successModal');

  let qualificationStartTracked = false;
  let leadFormShownTracked = false;
  let leadFormStartedTracked = false;

  function evaluateFilterLogic() {
    const q1 = document.querySelector('input[name="q1"]:checked')?.value;
    const q2 = document.querySelector('input[name="q2"]:checked')?.value;
    const q3 = document.querySelector('input[name="q3"]:checked')?.value;

    // Track qualification_started
    if (!qualificationStartTracked && (q1 || q2 || q3)) {
      trackEvent('qualification_started');
      qualificationStartTracked = true;
    }

    // Need all 3 to show the form
    if (!q1 || !q2 || !q3) {
      leadFormBlock.style.display = 'none';
      return;
    }

    trackEvent('qualification_completed');

    // Track specific payment willingness
    if (q3 === 'Igen') trackEvent('willing_to_pay_yes');
    if (q3 === 'Előbb szeretném tudni, pontosan mit tartalmaz és mennyibe kerül') trackEvent('willing_to_pay_details_first');
    if (q3 === 'Nem szeretnék fizetős szolgáltatást') trackEvent('not_willing_to_pay');

    // Mindig megjelenítjük a formot
    leadFormBlock.style.display = 'block';
    
    if (!leadFormShownTracked) {
      trackEvent('lead_form_shown');
      leadFormShownTracked = true;
    }
  }

  [...q1Radios, ...q2Radios, ...q3Radios].forEach(radio => {
    radio.addEventListener('change', evaluateFilterLogic);
  });

  // Track lead_form_started when user starts typing
  function trackFormStart() {
    if (!leadFormStartedTracked) {
      trackEvent('lead_form_started');
      leadFormStartedTracked = true;
    }
  }
  firstNameInput.addEventListener('focus', trackFormStart);
  phoneInput.addEventListener('focus', trackFormStart);

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
  function setSubmittingState(isSubmitting) {
    if (isSubmitting) {
      btnSubmit.disabled = true;
      btnSpinner.style.display = 'inline-block';
      btnText.textContent = 'Küldés...';
    } else {
      btnSubmit.disabled = false;
      btnSpinner.style.display = 'none';
      btnText.textContent = 'Kérem az ingyenes első áttekintést';
    }
  }

  function calculateLeadStatus(q1, q2, q3) {
    // 1. NURTURE (Priority)
    if (
      q2 === 'Egyelőre csak tájékozódom' || 
      q3 === 'Nem szeretnék fizetős szolgáltatást' || 
      q1 === 'Nincs konkrét gyanúm, csak szeretném ellenőrizni'
    ) {
      return 'NURTURE';
    }
    
    // 2. HOT
    const hasSpecificProblem = q1 && q1 !== 'Nincs konkrét gyanúm, csak szeretném ellenőrizni';
    if (hasSpecificProblem && q2 === 'Igen' && q3 === 'Igen') {
      return 'HOT';
    }
    
    // 3. WARM (Fallback)
    return 'WARM';
  }

  // Űrlapok alaphelyzetbe állítása az oldal betöltésekor
  // (ez megakadályozza, hogy iOS-en a back-gomb után bennmaradjanak a korábbi jelölések)
  document.getElementById('trafficLightForm').reset();
  form.reset();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Biztonsági ellenőrzés iOS-re (ha a böngésző átengedné a required mezőt)
    const privacyCheckbox = document.getElementById('privacyConsent');
    if (!privacyCheckbox.checked) {
      alert("Kérlek, pipáld be az adatkezelési tájékoztatót a jelentkezéshez!");
      return;
    }

    const rawPhone = phoneInput.value.trim();
    if (!rawPhone || !validatePhoneNumber(rawPhone)) {
      phoneError.textContent = 'Kérlek adj meg egy érvényes WhatsApp telefonszámot országhívóval (pl. +43 vagy +36)!';
      phoneError.style.display = 'block';
      phoneInput.focus();
      return;
    }

    setSubmittingState(true);

    try {
      const q1 = document.querySelector('input[name="q1"]:checked')?.value || '';
      const q2 = document.querySelector('input[name="q2"]:checked')?.value || '';
      const q3 = document.querySelector('input[name="q3"]:checked')?.value || '';
      
      let trafficLightResult = '';
      if (document.getElementById('resRedLight').style.display === 'block') trafficLightResult = 'Red';
      else if (document.getElementById('resYellowLight').style.display === 'block') trafficLightResult = 'Yellow';
      else if (document.getElementById('resGreenLight').style.display === 'block') trafficLightResult = 'Green';

      const payload = {
        type: 'submission',
        sessionId: SESSION_ID,
        timestamp: new Date().toLocaleString('hu-HU', { timeZone: 'Europe/Vienna' }),
        source: CURRENT_SOURCE,
        first_source: FIRST_SOURCE,
        firstName: firstNameInput.value.trim(),
        whatsappNumber: rawPhone,
        trafficLightResult: trafficLightResult,
        qualificationQ1: q1,
        qualificationQ2: q2,
        qualificationQ3: q3,
        leadStatus: calculateLeadStatus(q1, q2, q3)
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
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      trackEvent('lead_submitted');
      setSubmittingState(false);
      showSuccessModal();

    } catch (err) {
      console.error('Hiba történt a form küldésekor:', err);
      trackEvent('lead_submitted');
      setSubmittingState(false);
      showSuccessModal();
    }
  });

  // --------------------------------------------------------------------------
  // SUCCESS MODAL
  // --------------------------------------------------------------------------
  function showSuccessModal() {
    if(successModal) {
      successModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  // --------------------------------------------------------------------------
  // WHATSAPP LINK TRACKING (kizárólag explicit WhatsApp link/CTA kattintásra)
  // --------------------------------------------------------------------------
  document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"], .btn-whatsapp').forEach(link => {
    link.addEventListener('click', () => {
      trackEvent('whatsapp_started');
    });
  });
});

