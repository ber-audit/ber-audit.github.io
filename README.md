# 🇦🇹 Osztrák Bér-Audit – Ingyenes Diagnosztika Landing Oldal

Mobilra optimalizált, prémium sötét tónusú (narancs/vörös neon akcentusú) érkezőoldal (landing page) **Kristály László BSc** diplomás munkavállalási tanácsadó számára.

---

## 📂 Mappa tartalma

| Fájl / Mappa | Funkció |
| :--- | :--- |
| `index.html` | A teljes landing oldal (mind a 8 blokk, űrlap, modális ablak) |
| `style.css` | Reszponzív, modern CSS (sötét UI, glassmorphism, 48px+ érintési zónák) |
| `app.js` | Szűrőlogika (Q1, Q2, Q3 gating), fájlfeltöltés validáció, WhatsApp beküldés |
| `assets/laszlo.jpg` | Kristály László nagyfelbontású profilfotója |
| `google_apps_script.js` | Google Sheets + Google Drive webhook háttérkód (automatikus táblázat és mappa mentés) |

---

## 🚀 1. Publikálás GitHub Pages-re (2 perc, ingyenes és örökéletű)

Mivel a weboldal 100%-ban statikus és önálló (HTML/CSS/JS), a **GitHub Pages** a legstabilabb, teljesen ingyenes és örökös tárhely számára:

1. Nyisd meg a [github.com](https://github.com/) oldalt és lépj be a fiókodba.
2. Kattints a **New Repository** (Új tárhely) gombra:
   - **Repository name:** pl. `ber-audit` vagy `osztrak-ber-audit`
   - **Public / Private:** Válaszd a **Public** (Nyilvános) opciót.
   - Ne pipálj be semmi mást, majd kattints a zöld **Create repository** gombra.
3. Az új tárhely oldalán kattints az **„uploading an existing file”** kék linkre.
4. Húzd be (drag-and-drop) az összes fájlt és a mappát ebből a könyvtárból:
   - `index.html`
   - `style.css`
   - `app.js`
   - `assets/` (benne a `laszlo.jpg`)
   - `google_apps_script.js`
5. Kattints a lap alján a zöld **Commit changes** gombra.
6. Menj a felső menüben a **Settings** (Beállítások) -> bal oldali sávban a **Pages** menüpontra:
   - **Build and deployment / Source:** válaszd ki: `Deploy from a branch`
   - **Branch:** válaszd ki a `main` (vagy `master`) ágat, mellette hagyd a `/(root)` opciót.
   - Kattints a **Save** (Mentés) gombra!
7. **Kész!** ~1-2 percen belül megjelenik a zöld sáv a linkkel:
   `https://<felhasznaloneved>.github.io/ber-audit/`

*(Tipp: Később bármikor csatlakoztathatsz saját egyedi domaint is, pl. `ber-audit.at` a Custom domain mezőben!)*

---

## 📊 2. Google Sheets és Google Drive összekötése (3 perc)

Hogy a beküldött adatok és bérpapír fájlok automatikusan megjelenjenek a saját Google fiókodban:

1. Nyiss meg egy üres böngészőlapot és menj a [sheets.new](https://sheets.new) címre (ez létrehoz egy új Google Táblázatot).
2. Nevezd el pl.: `Osztrák Bér-Audit Jelentkezések`.
3. A felső menüben kattints a **Bővítmények (Extensions)** ➔ **Apps Script** pontra.
4. Töröld ki a mintakódot, és másold be a `google_apps_script.js` teljes tartalmát.
5. Nyomd meg a felső **Mentés (Ctrl+S)** gombot.
6. Futtasd le egyszer az `initialSetup` függvényt a felső „Futtatás” gombbal, és add meg az engedélyt a saját fiókodhoz. (Ez létrehozza a fejlécet és a Google Drive-ban az „Osztrák Bér-Audit Feltöltések” mappát).
7. Kattints a jobb felső kék **Telepítés (Deploy)** ➔ **Új telepítés (New deployment)** gombra.
8. A fogaskeréknél válaszd a **Webalkalmazás (Web app)** típust:
   - **Végrehajtás mint:** `Én (a te fiókod)`
   - **Ki férhet hozzá:** `Bárki (Anyone)` ⚠️ *Ez szükséges, hogy a látogatók feltölthessék az adatokat!*
9. Kattints a **Telepítés** gombra, majd másold ki a kapott hosszú **Webalkalmazás URL**-t.
10. Nyisd meg az `app.js` fájlt, és a tetején lévő változóhoz illeszd be:
    ```javascript
    const GOOGLE_SCRIPT_WEB_APP_URL = "IDE_ILLESZD_BE_A_KAPOTT_LINKET";
    ```
11. Töltsd fel a módosított `app.js`-t a GitHub tárhelyedre!

---

## ✨ Kész funkcionalitások ellenőrzése

- [x] **Hero blokk:** Kiemelt figyelemfelkeltő kérdés, piros figyelmeztető lámpa és bérpapír szimuláció.
- [x] **Bizalomépítés:** 3 diszkrét biztonsági kártya (100% Névtelen, Főnök nem tudja meg, Nem jogi tanács / tiszta matek).
- [x] **Ki vagyok:** Kristály László BSc bemutatkozása, 15 év kinti tapasztalat, beillesztve a nagyfelbontású fotóval.
- [x] **Hogyan működik:** 4 lépéses folyamat.
- [x] **Szűrőkérdések (Gating):**
  - Ha valaki a „Csak kíváncsi vagyok” VAGY a „Nem, mindent ingyen várok” választ jelöli: a feltöltés rejtve marad, és megjelenik a specifikáció szerinti udvarias elköszönő üzenet.
  - Ha mindkét kérdésre komoly választ ad: kinyílik a dokumentum feltöltő blokk.
- [x] **Dokumentum feltöltés:**
  - Névtelenítésre intő figyelmeztetés.
  - Drag-and-drop és tallózás: PDF, JPG, PNG támogatás.
  - Max. 10 MB szigorú méretellenőrzés kliensoldalon.
  - Opcionális leírás a gyanúról.
  - Kötelező érvényes WhatsApp telefonszám.
- [x] **CTA és Visszaigazolás:**
  - „🔍 Beküldöm – Átnézed!” gomb.
  - Töltésjelző spinner.
  - Felugró sikeres ablak: *„Köszönöm! 48 órán belül visszaírok WhatsAppon. Készítsd elő a számodat.”*
- [x] **Lábléc:** Jogi elhatárolódás és szakértői aláírás.
