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
}

function calculateTotal(artist) {
    return (
        parseFloat(artist.performance || 0) +
        parseFloat(artist.songScore || 0) +
        parseFloat(artist.lyrics || 0) +
        parseFloat(artist.cover || 0)
    ).toFixed(1);
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
                <div>Performance: <strong>${artist.performance || 0}</strong></div>
                <div>Brano: <strong>${artist.songScore || 0}</strong></div>
                <div>Testo: <strong>${artist.lyrics || 0}</strong></div>
                <div>Cover: <strong>${artist.cover || 0}</strong></div>
            </div>
            <p style="margin-top: 10px; color: var(--primary);"><strong>Totale/Finale: ${calculateTotal(artist)}</strong></p>
        </div>
    `).join('');
}

function addNewArtist() {
    if (!isAuthenticated) return;

    document.getElementById('modalTitle').textContent = 'Aggiungi Nuovo Artista';
    document.getElementById('editForm').reset();
    document.getElementById('editId').value = '';
    document.querySelector('.btn-danger').style.display = 'none';
    document.getElementById('editModal').style.display = 'block';
}

function editArtist(firestoreId) {
    if (!isAuthenticated) return;

    const artist = artists.find(a => a.firestoreId === firestoreId);
    if (!artist) return;

    document.getElementById('modalTitle').textContent = 'Modifica Artista';
    document.getElementById('editId').value = artist.firestoreId; // doc ID Firestore
    document.getElementById('editName').value = artist.name || '';
    document.getElementById('editSong').value = artist.song || '';
    document.getElementById('editPhoto').value = artist.photo || '';
    document.getElementById('editPerformance').value = artist.performance || 0;
    document.getElementById('editSongScore').value = artist.songScore || 0;
    document.getElementById('editLyrics').value = artist.lyrics || 0;
    document.getElementById('editCover').value = artist.cover || 0;
    document.getElementById('editReview').value = artist.review || '';

    document.querySelector('.btn-danger').style.display = 'block';
    document.getElementById('editModal').style.display = 'block';
}

function saveArtist(event) {
    event.preventDefault();
    if (!isAuthenticated || !window.db) return;

    const firestoreId = document.getElementById('editId').value; // doc ID Firestore (stringa)
    const artistData = {
        name: document.getElementById('editName').value,
        song: document.getElementById('editSong').value,
        photo: document.getElementById('editPhoto').value,
        performance: parseFloat(document.getElementById('editPerformance').value) || 0,
        songScore: parseFloat(document.getElementById('editSongScore').value) || 0,
        lyrics: parseFloat(document.getElementById('editLyrics').value) || 0,
        cover: parseFloat(document.getElementById('editCover').value) || 0,
        review: document.getElementById('editReview').value
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
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        closeEditModal();
    }
}

// Proteggi contro tentativi di bypass
Object.freeze(PWD);