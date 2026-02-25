// ============================================================
// TELEVOTO - voto.js
// ============================================================
// Struttura Firestore:
//   televoto/{uid}_{artistId}  → { uid, artistId, artistName, vote, timestamp }
//
// localStorage:
//   televoto_uid    → ID univoco del visitatore (generato una volta sola)
//   televoto_voted  → JSON array di artistId già votati
// ============================================================

let allArtists = [];       // tutti gli artisti caricati
let pendingArtists = [];   // artisti ancora da votare
let currentIdx = 0;        // indice corrente in pendingArtists
let selectedVote = null;   // voto selezionato (0-10 oppure null)
let uid = '';
let votedIds = [];

document.addEventListener('DOMContentLoaded', () => {
    // Recupera o genera l'ID univoco del visitatore
    uid = localStorage.getItem('televoto_uid');
    if (!uid) {
        uid = generateUID();
        localStorage.setItem('televoto_uid', uid);
    }

    // Recupera gli artisti già votati
    try {
        votedIds = JSON.parse(localStorage.getItem('televoto_voted') || '[]');
    } catch(e) {
        votedIds = [];
    }

    buildVoteButtons();
    loadArtists();
});

// ─── Genera un ID univoco ───────────────────────────────────
function generateUID() {
    const ts = Date.now().toString(36);
    const rnd = Math.random().toString(36).substring(2, 11);
    return `tv_${ts}_${rnd}`;
}

// ─── Costruisce i bottoni da 0 a 10 ────────────────────────
function buildVoteButtons() {
    const container = document.getElementById('tvVoteButtons');
    for (let i = 0; i <= 10; i++) {
        const btn = document.createElement('button');
        btn.className = 'tv-vote-btn';
        btn.textContent = i;
        btn.dataset.score = i;
        btn.addEventListener('click', () => selectVote(i));
        container.appendChild(btn);
    }
}

// ─── Carica artisti da Firestore ────────────────────────────
function loadArtists() {
    if (!window.db) {
        document.getElementById('tvLoading').innerHTML =
            '<p>⚠️ Firebase non configurato.<br>Segui le istruzioni in <code>firebase-config.js</code>.</p>';
        return;
    }

    window.db.collection('artists')
        .orderBy('id', 'asc')
        .get()
        .then(snapshot => {
            allArtists = snapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));

            // Filtra gli artisti non ancora votati
            pendingArtists = allArtists.filter(a => !votedIds.includes(a.id));

            document.getElementById('tvLoading').style.display = 'none';

            if (pendingArtists.length === 0) {
                document.getElementById('tvCompleted').style.display = 'block';
            } else {
                document.getElementById('tvVoting').style.display = 'block';
                showCurrentArtist();
            }
        })
        .catch(err => {
            console.error('Errore caricamento artisti televoto:', err);
            document.getElementById('tvLoading').innerHTML =
                '<p>❌ Errore nel caricamento degli artisti. Riprova più tardi.</p>';
        });
}

// ─── Mostra l'artista corrente ──────────────────────────────
function showCurrentArtist() {
    const artist = pendingArtists[currentIdx];
    const votati = allArtists.length - pendingArtists.length + currentIdx;
    const totale = allArtists.length;

    // Testo progresso
    document.getElementById('tvProgressText').textContent =
        `Artista ${currentIdx + 1} di ${pendingArtists.length}` +
        (votati > 0 ? ` · ${votati} votati su ${totale}` : '');

    // Barra progresso
    const pct = totale > 0 ? (votati / totale) * 100 : 0;
    document.getElementById('tvProgressFill').style.width = pct + '%';

    // Foto, nome, canzone
    const photo = artist.photo || 'https://via.placeholder.com/160';
    const img = document.getElementById('tvArtistPhoto');
    img.src = photo;
    img.alt = artist.name;
    document.getElementById('tvArtistName').textContent = artist.name;
    document.getElementById('tvArtistSong').textContent = artist.song || '';

    // Reset selezione
    selectedVote = null;
    document.getElementById('tvSelectedDisplay').textContent = '';
    document.getElementById('tvNextBtn').disabled = true;
    document.getElementById('tvNextBtn').textContent = 'Avanti →';
    document.querySelectorAll('.tv-vote-btn').forEach(btn => btn.classList.remove('selected'));
}

// ─── Seleziona un voto ──────────────────────────────────────
function selectVote(score) {
    selectedVote = score;

    // Aggiorna i bottoni
    document.querySelectorAll('.tv-vote-btn').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.score) === score);
    });

    // Descrizione emoji
    let emoji;
    if      (score === 0)            emoji = '💀';
    else if (score <= 2)             emoji = '😖';
    else if (score <= 4)             emoji = '😕';
    else if (score <= 6)             emoji = '😐';
    else if (score <= 8)             emoji = '🙂';
    else if (score === 9)            emoji = '😊';
    else                             emoji = '🌟';

    document.getElementById('tvSelectedDisplay').textContent = `${emoji} Voto selezionato: ${score}/10`;
    document.getElementById('tvNextBtn').disabled = false;
}

// ─── Salva il voto e passa al prossimo artista ──────────────
function submitVote() {
    if (selectedVote === null) return;

    const artist = pendingArtists[currentIdx];
    const btn = document.getElementById('tvNextBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Salvataggio...';

    // ID documento univoco: garantisce un solo voto per utente per artista
    const docId = `${uid}_${artist.id}`;

    window.db.collection('televoto').doc(docId).set({
        uid:        uid,
        artistId:   artist.id,
        artistName: artist.name,
        vote:       selectedVote,
        timestamp:  firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        // Aggiorna localStorage
        votedIds.push(artist.id);
        localStorage.setItem('televoto_voted', JSON.stringify(votedIds));

        currentIdx++;

        if (currentIdx >= pendingArtists.length) {
            // Tutti gli artisti votati
            document.getElementById('tvVoting').style.display = 'none';
            document.getElementById('tvCompleted').style.display = 'block';
        } else {
            showCurrentArtist();
        }
    })
    .catch(err => {
        console.error('Errore salvataggio voto televoto:', err);
        alert('Si è verificato un errore nel salvataggio.\nRiprova tra qualche secondo.');
        btn.disabled = false;
        btn.textContent = 'Avanti →';
    });
}
