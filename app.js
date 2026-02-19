let artists = [];

// Carica i dati dal JSON all'avvio
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

async function loadData() {
    try {
        const response = await fetch('data.json');
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

function renderTable() {
    const tbody = document.getElementById('tableBody');

    // Ordina per totale decrescente (posizione automatica)
    const sorted = [...artists].sort((a, b) => {
        return calculateTotal(b) - calculateTotal(a);
    });

    tbody.innerHTML = sorted.map((artist, index) => `
        <tr>
            <td class="position">${index + 1}</td>
            <td>
                <div class="artist-cell">
                    <img src="${artist.photo || 'https://via.placeholder.com/60'}" 
                         alt="${artist.name}" 
                         class="artist-photo clickable-image"
                         onclick="openImageModal('${artist.photo || 'https://via.placeholder.com/60'}', '${artist.name}')"
                         onerror="this.src='https://via.placeholder.com/60'">
                    <div class="artist-info">
                        <span class="artist-name">${artist.name}</span>
                        ${artist.song ? `<span class="artist-song">${artist.song}</span>` : ''}
                    </div>
                </div>
            </td>
            <td class="score">${artist.performance || '-'}</td>
            <td class="score">${artist.songScore || '-'}</td>
            <td class="score">${artist.lyrics || '-'}</td>
            <td class="score">${artist.cover || '-'}</td>
            <td class="total-score">${calculateTotal(artist)}</td>
            <td class="final-score">${calculateTotal(artist)}</td>
            <td>
                <button class="btn-review" onclick="showReview(${artist.id})">
                    📝 Valutazione
                </button>
            </td>
        </tr>
    `).join('');
}

function showReview(id) {
    const artist = artists.find(a => a.id === id);
    if (!artist) return;

    const modal = document.getElementById('reviewModal');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <h2>${artist.name}</h2>
        ${artist.song ? `<p style="color: var(--text-light); font-style: italic;">${artist.song}</p>` : ''}

        <div class="scores-grid">
            <div class="score-item">
                <strong>Performance</strong>
                <span>${artist.performance || '-'}</span>
            </div>
            <div class="score-item">
                <strong>Brano</strong>
                <span>${artist.songScore || '-'}</span>
            </div>
            <div class="score-item">
                <strong>Testo</strong>
                <span>${artist.lyrics || '-'}</span>
            </div>
            <div class="score-item">
                <strong>Cover</strong>
                <span>${artist.cover || '-'}</span>
            </div>
        </div>

        <h3>Punteggio Totale: ${calculateTotal(artist)}</h3>
        <h3>Punteggio Finale: ${calculateTotal(artist)}</h3>

        <h3>Valutazione Dettagliata</h3>
        <div class="review-text">
            ${artist.review || 'Nessuna valutazione ancora disponibile.'}
        </div>
    `;

    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('reviewModal').style.display = 'none';
}

function openImageModal(src, alt) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    modalImage.src = src;
    modalImage.alt = alt;
    modal.style.display = 'block';
}

function closeImageModal() {
    document.getElementById('imageModal').style.display = 'none';
}

// Chiudi modal cliccando fuori
window.onclick = function(event) {
    const reviewModal = document.getElementById('reviewModal');
    const imageModal = document.getElementById('imageModal');
    
    if (event.target === reviewModal) {
        reviewModal.style.display = 'none';
    }
    if (event.target === imageModal) {
        imageModal.style.display = 'none';
    }
}