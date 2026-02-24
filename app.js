let artists = [];
let commentsUnsubscribe = null;

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
    const savedName = (localStorage.getItem('commentName') || '').replace(/"/g, '&quot;');

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

        <div class="comments-section">
            <h3>💬 Commenti dei visitatori</h3>
            <div class="comment-form">
                <input
                    type="text"
                    id="commentName"
                    class="comment-input"
                    placeholder="Il tuo nome (es. Mario Rossi)..."
                    maxlength="50"
                    value="${savedName}">
                <textarea
                    id="commentText"
                    class="comment-textarea"
                    placeholder="Lascia un commento su questo artista..."
                    maxlength="500"
                    rows="3"></textarea>
                <button class="btn-comment" onclick="submitComment(${artist.id})">✉️ Pubblica commento</button>
            </div>
            <div id="commentsList" class="comments-list">
                <div class="comments-loading">⏳ Caricamento commenti...</div>
            </div>
        </div>
    `;

    modal.style.display = 'block';
    loadComments(artist.id);
}

function closeModal() {
    document.getElementById('reviewModal').style.display = 'none';
    if (commentsUnsubscribe) {
        commentsUnsubscribe();
        commentsUnsubscribe = null;
    }
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
        closeModal();
    }
    if (event.target === imageModal) {
        imageModal.style.display = 'none';
    }
}

// ============================================================
// SISTEMA DI COMMENTI (Firebase Firestore)
// ============================================================

function loadComments(artistId) {
    // Annulla il listener precedente se esiste
    if (commentsUnsubscribe) {
        commentsUnsubscribe();
        commentsUnsubscribe = null;
    }

    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;

    if (!window.db) {
        commentsList.innerHTML = '<div class="no-comments">⚠️ Sistema commenti non ancora configurato.<br>Segui le istruzioni in <code>firebase-config.js</code>.</div>';
        return;
    }

    commentsUnsubscribe = window.db
        .collection('comments')
        .where('artistId', '==', artistId)
        .orderBy('timestamp', 'asc')
        .onSnapshot(
            snapshot => {
                const list = document.getElementById('commentsList');
                if (!list) return;

                if (snapshot.empty) {
                    list.innerHTML = '<div class="no-comments">Nessun commento ancora. Sii il primo! 🎤</div>';
                    return;
                }

                list.innerHTML = snapshot.docs.map(doc => {
                    const c = doc.data();
                    const date = c.timestamp
                        ? c.timestamp.toDate().toLocaleString('it-IT', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                          })
                        : '';
                    return `
                        <div class="comment-item">
                            <div class="comment-header">
                                <span class="comment-author">👤 ${escapeHtml(c.authorName)}</span>
                                <span class="comment-date">${date}</span>
                            </div>
                            <div class="comment-body">${escapeHtml(c.text)}</div>
                        </div>
                    `;
                }).join('');
            },
            error => {
                console.error('Errore caricamento commenti:', error);
                const list = document.getElementById('commentsList');
                if (list) list.innerHTML = '<div class="no-comments">❌ Errore nel caricamento dei commenti.</div>';
            }
        );
}

function submitComment(artistId) {
    if (!window.db) {
        alert('Sistema commenti non configurato.\nSegui le istruzioni in firebase-config.js');
        return;
    }

    const nameInput = document.getElementById('commentName');
    const textInput = document.getElementById('commentText');
    const btn = document.querySelector('.btn-comment');

    const name = nameInput.value.trim();
    const text = textInput.value.trim();

    if (!name) {
        nameInput.focus();
        nameInput.classList.add('input-error');
        setTimeout(() => nameInput.classList.remove('input-error'), 2000);
        return;
    }

    if (!text) {
        textInput.focus();
        textInput.classList.add('input-error');
        setTimeout(() => textInput.classList.remove('input-error'), 2000);
        return;
    }

    // Salva il nome in localStorage per le visite future
    localStorage.setItem('commentName', name);

    btn.disabled = true;
    btn.textContent = '⏳ Pubblicazione...';

    window.db.collection('comments').add({
        artistId: artistId,
        authorName: name,
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        textInput.value = '';
        btn.disabled = false;
        btn.textContent = '✉️ Pubblica commento';
    })
    .catch(err => {
        console.error('Errore pubblicazione commento:', err);
        alert('Errore nella pubblicazione. Riprova più tardi.');
        btn.disabled = false;
        btn.textContent = '✉️ Pubblica commento';
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}