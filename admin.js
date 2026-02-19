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

async function loadData() {
    try {
        const timestamp = new Date().getTime(); // cache-busting
        const response = await fetch('data.json?v=' + timestamp, {
            cache: 'no-store'
        });
        artists = await response.json();
        renderTable();
    } catch (error) {
        console.error('Errore nel caricamento dei dati:', error);
        document.getElementById('tableBody').innerHTML = 
            '<tr><td colspan="9" style="text-align: center; padding: 40px;">Errore nel caricamento dei dati</td></tr>';
    }
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
        <div class="artist-card" onclick="editArtist(${artist.id})">
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

function editArtist(id) {
    if (!isAuthenticated) return;

    const artist = artists.find(a => a.id === id);
    if (!artist) return;

    document.getElementById('modalTitle').textContent = 'Modifica Artista';
    document.getElementById('editId').value = artist.id;
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

    if (!isAuthenticated) return;

    const id = document.getElementById('editId').value;
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

    // Non salviamo più finalScore - viene calcolato automaticamente

    if (id) {
        // Modifica esistente
        const index = artists.findIndex(a => a.id == id);
        artists[index] = { ...artists[index], ...artistData };
    } else {
        // Nuovo artista - trova ID massimo e incrementa
        const maxId = artists.length > 0 ? Math.max(...artists.map(a => a.id)) : 0;
        artistData.id = maxId + 1;
        artists.push(artistData);
    }

    // Mostra il JSON aggiornato
    displayJsonForDownload();
    renderArtists();
    closeEditModal();
}

function deleteArtist() {
    if (!isAuthenticated) return;

    const id = document.getElementById('editId').value;
    if (!id) return;

    if (confirm('Sei sicuro di voler eliminare questo artista?')) {
        artists = artists.filter(a => a.id != id);
        displayJsonForDownload();
        renderArtists();
        closeEditModal();
    }
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function displayJsonForDownload() {
    if (!isAuthenticated) return;

    const jsonStr = JSON.stringify(artists, null, 2);

    // Mostra in console per facile copia
    console.log('=== NUOVO JSON DA COPIARE IN data.json ===');
    console.log(jsonStr);
    console.log('===========================================');

    // Mostra notifica
    showNotification('Dati salvati! Vedi console (F12) per copiare il JSON aggiornato');
}

function showNotification(message) {
    // Crea notifica temporanea
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #059669;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 600;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function exportData() {
    if (!isAuthenticated) return;

    const dataStr = JSON.stringify(artists, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data.json`;
    link.click();
    URL.revokeObjectURL(url);

    showNotification('JSON esportato! Ricaricalo su GitHub per aggiornare il sito');
}

function importData(event) {
    if (!isAuthenticated) return;

    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                artists = imported;
                renderArtists();
                showNotification('Dati importati con successo!');
            } else {
                alert('Formato JSON non valido.');
            }
        } catch (error) {
            alert('Errore nel leggere il file JSON.');
        }
    };
    reader.readAsText(file);
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