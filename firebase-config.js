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
// NOTA: La configurazione Firebase lato client è pubblica per design.
//       La sicurezza è garantita esclusivamente dalle Regole Firestore.
// ============================================================

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAJqcBDAlyaPsHxV2STl7_spB6Xwb8jq-g",
  authDomain: "sanremo-26.firebaseapp.com",
  projectId: "sanremo-26",
  storageBucket: "sanremo-26.firebasestorage.app",
  messagingSenderId: "589022680248",
  appId: "1:589022680248:web:f81eb495f7e53f69b1d04d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
try {
    if (firebaseConfig.apiKey.startsWith("INSERISCI")) {
        throw new Error("Configurazione non completata");
    }
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
    console.log("✅ Firebase inizializzato. Sistema commenti attivo.");
} catch (e) {
    console.warn("⚠️ Firebase non configurato. Segui le istruzioni in firebase-config.js per attivare i commenti.", e.message);
    window.db = null;
}
