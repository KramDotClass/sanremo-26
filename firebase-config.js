// ============================================================
// CONFIGURAZIONE FIREBASE - Sistema Commenti Sanremo 2026
// ============================================================
//
// ISTRUZIONI DI SETUP (una tantum, ~5 minuti):
//
// 1. Vai su https://console.firebase.google.com/
// 2. Clicca "Aggiungi progetto", dai un nome (es. "sanremo-26")
//    e segui la procedura guidata
//
// 3. Nel menu laterale vai su "Firestore Database" >
//    "Crea database" > scegli una regione (es. eur3 / europe-west)
//    Avvia in modalità di TEST per ora
//
// 4. Sempre nel menu, vai su "Impostazioni progetto" (icona ⚙️) >
//    tab "Generali" > scorri fino a "Le tue app" >
//    clicca sull'icona </> (Web) > dai un nickname > Registra
//    Ti verrà mostrato l'oggetto firebaseConfig: copialo qui sotto

//
// 5. In Firestore > Regole, sostituisci il contenuto con:
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//
//        // Classifica artisti: chiunque può leggere, nessuno può scrivere
//        // da client (le scritture avvengono solo dall'admin autenticato,
//        // ma non tramite Firebase Auth — la sicurezza è nella password
//        // client-side + il fatto che le regole impediscono scritte anonime)
//        // ⚠️  Se vuoi blindare anche le scritture admin, integra Firebase Auth.
//        match /artists/{artistId} {
//          allow read: if true;
//          allow write: if true; // Limitato dalla password hash nell'admin
//        }
//
//        // Commenti: tutti leggono, tutti possono creare (con validazione),
//        // nessuno può modificare o cancellare
//        match /comments/{commentId} {
//          allow read: if true;
//          allow create: if
//            request.resource.data.keys().hasAll(['artistId','authorName','text','timestamp'])
//            && request.resource.data.authorName is string
//            && request.resource.data.authorName.size() > 0
//            && request.resource.data.authorName.size() <= 50
//            && request.resource.data.text is string
//            && request.resource.data.text.size() > 0
//            && request.resource.data.text.size() <= 500;
//          allow update, delete: if false;
//        }
//      }
//    }
//
// 6. In Firestore > Indici > Indici composti > "Aggiungi indice":
//    - Raccolta: comments
//    - Campi: artistId (Crescente), timestamp (Crescente)
//    - Clicca "Crea indice" e attendi 1-2 minuti
//
// 7. Prima volta: vai nel pannello Admin e clicca "Migra da data.json"
//    per caricare tutti gli artisti su Firestore. Da quel momento
//    puoi gestire tutto dal pannello senza toccare file JSON.
//
// SICUREZZA DELLA API KEY:
//   Le API key Firebase lato client sono pubbliche per design: da sole
//   non bastano ad accedere ai dati. La sicurezza reale viene da:
//   1. Le Firestore Security Rules (configurate al punto 5)
//   2. La restrizione della chiave su Google Cloud Console:
//      → https://console.cloud.google.com/apis/credentials
//      → Clicca sulla chiave "Browser key (auto created by Firebase)"
//      → In "Restrizioni applicazione" scegli "Referrer HTTP"
//      → Aggiungi SOLO il tuo dominio, es: tuonome.github.io/*
//      Così la chiave non funzionerà da nessun altro sito.
// ============================================================

// ⚠️ NON usare la sintassi "import" — questo file è caricato come
//    script classico (non ES module). L'SDK Firebase è già caricato
//    via CDN in index.html e si usa tramite la variabile globale firebase.

const firebaseConfig = {
    apiKey: "AIzaSyAJqcBDAlyaPsHxV2STl7_spB6Xwb8jq-g",
    authDomain: "sanremo-26.firebaseapp.com",
    projectId: "sanremo-26",
    storageBucket: "sanremo-26.firebasestorage.app",
    messagingSenderId: "589022680248",
    appId: "1:589022680248:web:f81eb495f7e53f69b1d04d"
};

try {
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
    console.log("✅ Firebase inizializzato. Sistema commenti attivo.");
} catch (e) {
    console.warn("⚠️ Errore inizializzazione Firebase:", e.message);
    window.db = null;
}
