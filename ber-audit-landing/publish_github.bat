@echo off
chcp 65001 > nul
title Osztrák Bér-Audit – GitHub Pages Publikáló

echo =======================================================
echo   OSZTRÁK BÉR-AUDIT LANDING OLDAL PUBLIKÁLÁSA
echo =======================================================
echo.

:: Ellenőrizzük, hogy a Git telepítve van-e
where git >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Git megtalálva a gépeden!
    echo.
    goto GIT_FOUND
) else (
    echo [INFO] A Git parancssori eszköz nincs telepítve ezen a gépen.
    echo.
    echo A legegyszerűbb és leggyorsabb (2 perces) ingyenes publikálás:
    echo 1. Megnyitjuk a böngésződben a GitHub új repó oldalát: https://github.com/new
    echo 2. Megnyitjuk ezt a mappát a fájlkezelőben.
    echo 3. Csak húzd be (drag-and-drop) a fájlokat és a kész oldal azonnal él!
    echo.
    pause
    start https://github.com/new
    explorer .
    exit /b
)

:GIT_FOUND
echo Inicializáljuk a helyi Git tárhelyet...
if not exist ".git" (
    git init
    git branch -M main
)

git add .
git commit -m "Osztrák Bér-Audit - Ingyenes Diagnosztika végleges verzió"

echo.
echo Kérlek add meg a GitHub repository HTTPS címét
echo (Pl: https://github.com/felhasznaloneved/ber-audit.git):
set /p REPO_URL="Repo URL: "

if "%REPO_URL%"=="" (
    echo Nem adtál meg URL-t. A folyamat megszakadt.
    pause
    exit /b
)

git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%
git push -u origin main --force

echo.
echo =======================================================
echo   SIKERESEN FELTÖLTVE A GITHUB-RA!
echo =======================================================
echo.
echo Most kapcsold be a Pages-t a repódban:
echo Settings -> Pages -> Branch: main -> Save
echo.
echo Pár percen belül az oldalad éles és elérhető a világ bármely pontjáról!
echo.
pause
