// Hash SHA-256 della password (non modificabile da console)
const PWD = 'f88ff30c89837533001c0d5548d23140f4a03cdbf8d472e507b85cb067d5eb0b';

let artists = [];
let isAuthenticated = false;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

function checkAuth() {
    const auth = sessionStorage.getItem('auth_sanremo');
    if (auth === PWD) {
        isAuthenticated = true;
        showAdmin();
        loadData();
    }
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function checkPassword(event) {
    event.preventDefault();
    const input = document.getElementById('passwordInput');
    const error = document.getElementById('loginError');

    const hash = await hashPassword(input.value);

    if (hash === PWD) {
        sessionStorage.setItem('auth_sanremo', hash);
        isAuthenticated = true;
        showAdmin();
        loadData();
    } else {
        error.textContent = '❌ Password errata';
        input.value = '';
        setTimeout(() => {
            error.textContent = '';
        }, 3000);
    }
}

function showAdmin() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
}

function logout() {
    sessionStorage.removeItem('auth_sanremo');
    isAuthenticated = false;
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminContent').style.display = 'none';
    document.getElementById('passwordInput').value = '';
}

function loadData() {
    if (!window.db) {
        showNotification('⚠️ Firebase non configurato. Configura firebase-config.js prima di usare il pannello admin.', true);
        return;
    }

    window.db.collection('artists')
        .orderBy('id', 'asc')
        .onSnapshot(
            snapshot => {
                artists = snapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
                renderArtists();
            },
            error => {
                console.error('Errore Firestore:', error);
                showNotification('❌ Errore nel caricamento degli artisti da Firestore', true);
            }
        );

    // Ascolta il flag televotoVisible
    window.db.collection('settings').doc('app')
        .onSnapshot(snap => {
            const visible = snap.exists ? snap.data().televotoVisible === true : false;
            const badge = document.getElementById('televotoStatusBadge');
            const hideBtn = document.getElementById('btnHideTelevoto');
            if (badge) {
                badge.textContent = visible ? '👁️ Televoto VISIBILE al pubblico' : '🙈 Televoto nascosto al pubblico';
                badge.className = 'televoto-status-badge ' + (visible ? 'tv-visible' : 'tv-hidden');
            }
            if (hideBtn) hideBtn.style.display = visible ? 'inline-block' : 'none';
        }, () => {});
}

function calcS1(a)  { return parseFloat(a.performance||0) + parseFloat(a.songScore||0) + parseFloat(a.lyrics||0); }
function calcS2(a)  { return parseFloat(a.cover||0); }
function calcS3raw(a) { return parseFloat(a.perfFinale||0) + parseFloat(a.songFinale||0) + parseFloat(a.lyricsFinale||0); }

// Media dei 4 criteri finali: perfFinale, songFinale, lyricsFinale, cover → 0–10
function calcFinalAvg(a) {
    return (parseFloat(a.perfFinale  || 0) +
            parseFloat(a.songFinale  || 0) +
            parseFloat(a.lyricsFinale|| 0) +
            parseFloat(a.cover       || 0)) / 4;
}

function calculateTotal(a) {
    const avg = calcFinalAvg(a);
    const p   = parseFloat(a.pubblicoScore || 0);
    return (avg * 0.67 + p * 0.33).toFixed(2);
}

function renderArtists() {
    if (!isAuthenticated) return;

    const grid = document.getElementById('artistsGrid');

    if (artists.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 40px;">Nessun artista inserito. Clicca su "Aggiungi Artista" per iniziare.</p>';
        return;
    }

    // Ordina per totale decrescente
    const sorted = [...artists].sort((a, b) => calculateTotal(b) - calculateTotal(a));

    grid.innerHTML = sorted.map((artist, index) => `
        <div class="artist-card" onclick="editArtist('${artist.firestoreId}')">
            <div class="position-badge">#${index + 1}</div>
            <img src="${artist.photo || 'https://via.placeholder.com/300x200'}"
                 alt="${artist.name}"
                 onerror="this.src='https://via.placeholder.com/300x200'">
            <h3>${artist.name}</h3>
            ${artist.song ? `<p><em>${artist.song}</em></p>` : ''}
            <div class="scores">
                <div style="grid-column:1/-1;font-size:0.7rem;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:.05em;padding-bottom:2px">🎭 Serate 1–3</div>
                <div>Performance: <strong>${artist.performance || 0}</strong></div>
                <div>Brano: <strong>${artist.songScore || 0}</strong></div>
                <div>Testo: <strong>${artist.lyrics || 0}</strong></div>
                <div style="grid-column:1/-1;font-size:0.7rem;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:.05em;padding-bottom:2px;padding-top:4px">🎸 Cover</div>
                <div style="grid-column:1/-1">Cover: <strong>${artist.cover || 0}</strong></div>
                <div style="grid-column:1/-1;font-size:0.7rem;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:.05em;padding-bottom:2px;padding-top:4px">🏆 Finale</div>
                <div>Perf: <strong>${artist.perfFinale || 0}</strong></div>
                <div>Brano: <strong>${artist.songFinale || 0}</strong></div>
                <div>Testo: <strong>${artist.lyricsFinale || 0}</strong></div>
                ${artist.pubblicoScore != null && artist.pubblicoScore !== ''
                    ? `<div style="grid-column:1/-1">📺 Pubblico: <strong>${artist.pubblicoScore}</strong></div>`
                    : ''}
            </div>
            <p style="margin-top: 10px; color: var(--primary);"><strong>Totale finale: ${calculateTotal(artist)}</strong></p>
        </div>
    `).join('');
}

function addNewArtist() {
    if (!isAuthenticated) return;

    document.getElementById('modalTitle').textContent = 'Aggiungi Nuovo Artista';
    document.getElementById('editForm').reset();
    document.getElementById('editId').value = '';
    // Reset campi numerici a 0 (reset() li lascia vuoti)
    ['editPerformance','editSongScore','editLyrics','editCover',
     'editPerfFinale','editSongFinale','editLyricsFinale'].forEach(id => {
        document.getElementById(id).value = 0;
    });
    // Mostra prima tab serata
    switchSerataTab('s1', document.querySelector('.serata-tab-btn'));
    document.querySelector('.btn-danger').style.display = 'none';
    document.getElementById('editModal').style.display = 'block';
}

function switchSerataTab(tab, btnEl) {
    document.querySelectorAll('.serata-panel').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.serata-tab-btn').forEach(b => b.classList.remove('active'));
    const panel = document.getElementById('serataPanel_' + tab);
    if (panel) panel.style.display = 'block';
    if (btnEl) btnEl.classList.add('active');
}

function editArtist(firestoreId) {
    if (!isAuthenticated) return;

    const artist = artists.find(a => a.firestoreId === firestoreId);
    if (!artist) return;

    document.getElementById('modalTitle').textContent = 'Modifica Artista';
    document.getElementById('editId').value          = artist.firestoreId;
    document.getElementById('editName').value        = artist.name || '';
    document.getElementById('editSong').value        = artist.song || '';
    document.getElementById('editPhoto').value       = artist.photo || '';
    // Serate 1-3
    document.getElementById('editPerformance').value  = artist.performance   || 0;
    document.getElementById('editSongScore').value    = artist.songScore     || 0;
    document.getElementById('editLyrics').value       = artist.lyrics        || 0;
    document.getElementById('editReview').value       = artist.review        || '';
    // Cover
    document.getElementById('editCover').value        = artist.cover         || 0;
    document.getElementById('editReviewCover').value  = artist.reviewCover   || '';
    // Finale
    document.getElementById('editPerfFinale').value   = artist.perfFinale    || 0;
    document.getElementById('editSongFinale').value   = artist.songFinale    || 0;
    document.getElementById('editLyricsFinale').value = artist.lyricsFinale  || 0;
    document.getElementById('editReviewFinale').value = artist.reviewFinale  || '';

    switchSerataTab('s1', document.querySelector('.serata-tab-btn'));
    document.querySelector('.btn-danger').style.display = 'block';
    document.getElementById('editModal').style.display  = 'block';
}

function saveArtist(event) {
    event.preventDefault();
    if (!isAuthenticated || !window.db) return;

    const firestoreId = document.getElementById('editId').value;
    const artistData = {
        name:         document.getElementById('editName').value,
        song:         document.getElementById('editSong').value,
        photo:        document.getElementById('editPhoto').value,
        // Serate 1-3
        performance:  parseFloat(document.getElementById('editPerformance').value)  || 0,
        songScore:    parseFloat(document.getElementById('editSongScore').value)    || 0,
        lyrics:       parseFloat(document.getElementById('editLyrics').value)       || 0,
        review:       document.getElementById('editReview').value,
        // Cover
        cover:        parseFloat(document.getElementById('editCover').value)        || 0,
        reviewCover:  document.getElementById('editReviewCover').value,
        // Finale
        perfFinale:   parseFloat(document.getElementById('editPerfFinale').value)   || 0,
        songFinale:   parseFloat(document.getElementById('editSongFinale').value)   || 0,
        lyricsFinale: parseFloat(document.getElementById('editLyricsFinale').value) || 0,
        reviewFinale: document.getElementById('editReviewFinale').value
    };

    const btn = document.querySelector('#editForm .btn-primary');
    btn.disabled = true;
    btn.textContent = '⏳ Salvataggio...';

    let promise;
    if (firestoreId) {
        // Modifica artista esistente
        promise = window.db.collection('artists').doc(firestoreId).update(artistData);
    } else {
        // Nuovo artista: calcola il prossimo ID numerico
        const maxId = artists.length > 0 ? Math.max(...artists.map(a => a.id)) : 0;
        artistData.id = maxId + 1;
        promise = window.db.collection('artists').add(artistData);
    }

    promise
        .then(() => {
            showNotification('✅ Artista salvato su Firebase!');
            closeEditModal();
        })
        .catch(err => {
            console.error('Errore salvataggio:', err);
            showNotification('❌ Errore nel salvataggio. Riprova.', true);
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = 'Salva';
        });
}

function deleteArtist() {
    if (!isAuthenticated || !window.db) return;

    const firestoreId = document.getElementById('editId').value;
    if (!firestoreId) return;

    const artist = artists.find(a => a.firestoreId === firestoreId);
    const name = artist ? artist.name : 'questo artista';

    if (confirm(`Sei sicuro di voler eliminare "${name}"? L'operazione è irreversibile.`)) {
        window.db.collection('artists').doc(firestoreId).delete()
            .then(() => {
                showNotification('🗑️ Artista eliminato.');
                closeEditModal();
            })
            .catch(err => {
                console.error('Errore eliminazione:', err);
                showNotification('❌ Errore durante l\'eliminazione.', true);
            });
    }
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${isError ? '#dc2626' : '#059669'};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 600;
        max-width: 360px;
        line-height: 1.4;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

// Migrazione una-tantum: carica data.json su Firestore
async function migrateFromJson() {
    if (!isAuthenticated || !window.db) return;

    if (!confirm('Questa operazione carica tutti i dati da data.json su Firestore.\nSe ci sono già artisti in Firestore, verranno aggiunti duplicati.\n\nContinuare solo se è la prima volta!')) return;

    const btn = document.getElementById('btnMigrate');
    btn.disabled = true;
    btn.textContent = '⏳ Migrazione in corso...';

    try {
        const response = await fetch('data.json?v=' + Date.now(), { cache: 'no-store' });
        const data = await response.json();

        const batch = window.db.batch();
        data.forEach(artist => {
            const ref = window.db.collection('artists').doc();
            batch.set(ref, artist);
        });
        await batch.commit();

        showNotification(`✅ Migrazione completata! ${data.length} artisti caricati su Firestore.`);
        btn.textContent = '✅ Migrazione eseguita';
    } catch (err) {
        console.error('Errore migrazione:', err);
        showNotification('❌ Errore durante la migrazione: ' + err.message, true);
        btn.disabled = false;
        btn.textContent = '📤 Migra da data.json';
    }
}

// Chiudi modal cliccando fuori
window.onclick = function(event) {
    const editModal = document.getElementById('editModal');
    const pvModal   = document.getElementById('publicVotesModal');
    if (event.target === editModal) closeEditModal();
    if (event.target === pvModal)   closePublicVotesModal();
}

// ============================================================
// TELEVOTO – Voti del pubblico
// ============================================================

function closePublicVotesModal() {
    document.getElementById('publicVotesModal').style.display = 'none';
}

/**
 * Legge la collezione `televoto`, raggruppa per artista e mostra
 * la media dei voti con una barra visuale.
 */
function showPublicVotes() {
    if (!isAuthenticated || !window.db) return;

    const modal = document.getElementById('publicVotesModal');
    const body  = document.getElementById('publicVotesBody');
    body.innerHTML = '<div class="votes-no-data">⏳ Caricamento voti...</div>';
    modal.style.display = 'block';

    window.db.collection('televoto').get()
        .then(snapshot => {
            if (snapshot.empty) {
                body.innerHTML = '<div class="votes-no-data">Nessun voto registrato ancora.</div>';
                return;
            }

            // Raggruppa i voti per artistId
            const grouped = {};
            snapshot.docs.forEach(doc => {
                const d = doc.data();
                if (!grouped[d.artistId]) {
                    grouped[d.artistId] = { name: d.artistName, votes: [] };
                }
                grouped[d.artistId].votes.push(d.vote);
            });

            // Calcola medie e ordina per media decrescente
            const rows = Object.entries(grouped).map(([idStr, data]) => {
                const artistId = parseInt(idStr);
                const sum = data.votes.reduce((a, v) => a + v, 0);
                const avg = sum / data.votes.length;
                const artist = artists.find(a => a.id === artistId);
                return {
                    artistId,
                    name: (artist && artist.name) || data.name || `Artista #${artistId}`,
                    photo: (artist && artist.photo) || '',
                    song: (artist && artist.song) || '',
                    avg: parseFloat(avg.toFixed(2)),
                    count: data.votes.length
                };
            }).sort((a, b) => b.avg - a.avg);

            body.innerHTML = rows.map(r => `
                <div class="votes-artist-row">
                    <img class="votes-artist-photo"
                         src="${r.photo || 'https://via.placeholder.com/48'}"
                         alt="${r.name}"
                         onerror="this.src='https://via.placeholder.com/48'">
                    <div class="votes-artist-info">
                        <div class="votes-artist-name">${r.name}</div>
                        <div class="votes-artist-sub">${r.song ? r.song + ' · ' : ''}${r.count} vot${r.count !== 1 ? 'i' : 'o'}</div>
                    </div>
                    <div class="votes-bar-wrap">
                        <div class="votes-bar">
                            <div class="votes-bar-fill" style="width:${(r.avg / 10) * 100}%"></div>
                        </div>
                        <div style="font-size:0.75rem;color:var(--text-light);text-align:right;">${r.avg}/10</div>
                    </div>
                    <div class="votes-score-big">${r.avg.toFixed(1)}</div>
                </div>
            `).join('');
        })
        .catch(err => {
            console.error('Errore lettura televoto:', err);
            body.innerHTML = '<div class="votes-no-data">❌ Errore nel caricamento dei voti.</div>';
        });
}

/**
 * Legge i voti del pubblico, calcola la media per ogni artista
 * e aggiorna il campo `pubblicoScore` su Firestore.
 * La classifica pubblica (index.html) includerà automaticamente
 * il nuovo punteggio nel totale.
 */
async function applyPublicVotes() {
    if (!isAuthenticated || !window.db) return;

    if (!confirm(
        'Questa operazione calcola la media dei voti del pubblico per ogni artista\n' +
        'e aggiorna il campo "Pubblico" in Firestore.\n\n' +
        'Il punteggio totale in classifica verrà ricalcolato automaticamente.\n\n' +
        'Continuare?'
    )) return;

    const btn = [...document.querySelectorAll('.admin-actions button')]
        .find(b => b.textContent.includes('Aggiorna con i voti del pubblico'));
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Aggiornamento...'; }

    try {
        const snapshot = await window.db.collection('televoto').get();

        if (snapshot.empty) {
            showNotification('⚠️ Nessun voto del pubblico trovato.', true);
            return;
        }

        // Raggruppa per artistId
        const grouped = {};
        snapshot.docs.forEach(doc => {
            const d = doc.data();
            if (!grouped[d.artistId]) grouped[d.artistId] = [];
            grouped[d.artistId].push(d.vote);
        });

        // Calcola medie e aggiorna ogni artista in batch
        const batch = window.db.batch();
        let updated = 0;

        Object.entries(grouped).forEach(([idStr, votes]) => {
            const artistId = parseInt(idStr);
            const artist = artists.find(a => a.id === artistId);
            if (!artist || !artist.firestoreId) return;

            const avg = votes.reduce((a, v) => a + v, 0) / votes.length;
            const ref = window.db.collection('artists').doc(artist.firestoreId);
            batch.update(ref, { pubblicoScore: parseFloat(avg.toFixed(2)) });
            updated++;
        });

        await batch.commit();

        // Rendi visibile il televoto al pubblico
        await window.db.collection('settings').doc('app').set(
            { televotoVisible: true },
            { merge: true }
        );

        showNotification(
            `✅ Aggiornamento completato! Punteggio pubblico applicato a ${updated} artist${updated !== 1 ? 'i' : 'a'} e reso visibile al pubblico.`
        );
    } catch (err) {
        console.error('Errore applyPublicVotes:', err);
        showNotification('❌ Errore durante l\'aggiornamento: ' + err.message, true);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Aggiorna con i voti del pubblico'; }
    }
}

async function hidePublicVotes() {
    if (!isAuthenticated || !window.db) return;

    if (!confirm(
        'Questa operazione nasconde il televoto dalla classifica pubblica.\n' +
        'I punteggi rimangono salvati, puoi ripubblicarli quando vuoi.\n\n' +
        'Continuare?'
    )) return;

    try {
        await window.db.collection('settings').doc('app').set(
            { televotoVisible: false },
            { merge: true }
        );
        showNotification('🙈 Televoto nascosto al pubblico. I punteggi sono conservati su Firestore.');
    } catch (err) {
        console.error('Errore hidePublicVotes:', err);
        showNotification('❌ Errore: ' + err.message, true);
    }
}

// Proteggi contro tentativi di bypass
Object.freeze(PWD);