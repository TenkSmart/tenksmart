
# Tenk Smart – Demo v2

## Slik kjører du lokalt
1. Åpne mappen i VS Code.
2. Installer *Live Server* → høyreklikk `index.html` → **Open with Live Server**.
   - Alternativt: `python -m http.server 5500` → `http://localhost:5500/index.html`.

## Publisering (Netlify – gratis)
1. Lag konto på Netlify.
2. Dra hele mappen inn i Netlify Dashboard (Deploys → Drag & Drop).
3. Ferdig! Du får en delbar https-lenke, f.eks. `https://tenksmart-demo.netlify.app`.

## Firebase (valgfritt for felles leaderboard)
1. Opprett Firebase-prosjekt → aktiver Firestore (Native mode).
2. Lag `firebase-config.json` i rotmappen med innhold fra **firebase-config.sample.json** (fyll inn nøkler).
3. Publiser på Netlify igjen.
4. Nå vil leaderboardet vise alle testerens summer (klientside aggregert).

## Felt som er lagt til i v2
- Kategori (select)
- Notat
- Kvitteringsbilde (base64, vises i liste)
- Profil (navn + valg av lagring)
- Leaderboard per måned (lokalt eller via Firebase)
- Eksport CSV
- PWA (manifest + service worker)
