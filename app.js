let artists = [];
let commentsUnsubscribe = null;
let allCommentsUnsubscribe = null;

// Carica i dati da Firestore all'avvio
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

function loadData() {
    const tbody = document.getElementById('tableBody');

    if (!window.db) {
        // Fallback a data.json se Firebase non è configurato
        fetch('data.json')
            .then(r => r.json())
            .then(data => { artists = data; renderTable(); })
            .catch(() => {
                tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;">Errore nel caricamento dei dati</td></tr>';
            });
        return;
    }

    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;">⏳ Caricamento classifica...</td></tr>';

    // Listener real-time: si aggiorna automaticamente se l'admin modifica i dati
    window.db.collection('artists')
        .orderBy('id', 'asc')
        .onSnapshot(
            snapshot => {
                if (snapshot.empty) {
                    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;">Nessun artista ancora inserito.</td></tr>';
                    return;
                }
                artists = snapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
                renderTable();
            },
            error => {
                console.error('Errore Firestore:', error);
                tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;">❌ Errore nel caricamento dei dati</td></tr>';
            }
        );
}

function calculateTotal(artist) {
    return (
        parseFloat(artist.performance || 0) +
        parseFloat(artist.songScore || 0) +
        parseFloat(artist.lyrics || 0) +
        parseFloat(artist.cover || 0) +
        parseFloat(artist.pubblicoScore || 0)
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
            <td class="score">${artist.pubblicoScore !== undefined && artist.pubblicoScore !== null && artist.pubblicoScore !== '' ? artist.pubblicoScore : '-'}</td>
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

// ============================================================
// TAB SWITCHING
// ============================================================

function switchTab(tab) {
    const rankingPanel  = document.getElementById('rankingPanel');
    const commentsPanel = document.getElementById('commentsPanel');
    const tabRanking    = document.getElementById('tabRanking');
    const tabComments   = document.getElementById('tabComments');

    if (tab === 'ranking') {
        rankingPanel.style.display  = 'block';
        commentsPanel.style.display = 'none';
        tabRanking.classList.add('active');
        tabComments.classList.remove('active');
        if (allCommentsUnsubscribe) {
            allCommentsUnsubscribe();
            allCommentsUnsubscribe = null;
        }
    } else {
        rankingPanel.style.display  = 'none';
        commentsPanel.style.display = 'block';
        tabRanking.classList.remove('active');
        tabComments.classList.add('active');
        loadAllComments();
    }
}

function loadAllComments() {
    const container = document.getElementById('allCommentsContainer');
    if (!container) return;

    if (!window.db) {
        container.innerHTML = '<div class="no-comments" style="padding:40px;text-align:center">⚠️ Sistema commenti non configurato.</div>';
        return;
    }

    container.innerHTML = '<div class="comments-loading">&#8987; Caricamento commenti...</div>';

    if (allCommentsUnsubscribe) {
        allCommentsUnsubscribe();
    }

    allCommentsUnsubscribe = window.db
        .collection('comments')
        .orderBy('timestamp', 'asc')
        .onSnapshot(
            snapshot => {
                if (snapshot.empty) {
                    container.innerHTML = '<div class="no-comments" style="padding:40px;text-align:center">Nessun commento ancora presente. Sii il primo! 🎤</div>';
                    return;
                }

                // Raggruppa per artistId
                const grouped = {};
                snapshot.docs.forEach(doc => {
                    const c = doc.data();
                    if (!grouped[c.artistId]) grouped[c.artistId] = [];
                    grouped[c.artistId].push(c);
                });

                // Ordina i gruppi seguendo la classifica attuale
                const sorted = [...artists].sort((a, b) => calculateTotal(b) - calculateTotal(a));

                let html = '';
                let hasAny = false;

                sorted.forEach(artist => {
                    const comments = grouped[artist.id];
                    if (!comments || comments.length === 0) return;
                    hasAny = true;

                    const count = comments.length;
                    html += `
                        <div class="acg-group">
                            <div class="acg-header">
                                <img src="${artist.photo || 'https://via.placeholder.com/50'}"
                                     alt="${escapeHtml(artist.name)}"
                                     onerror="this.src='https://via.placeholder.com/50'">
                                <div class="acg-header-info">
                                    <span class="acg-artist-name">${escapeHtml(artist.name)}</span>
                                    ${artist.song ? `<span class="acg-artist-song">${escapeHtml(artist.song)}</span>` : ''}
                                </div>
                                <span class="acg-count">${count} comment${count !== 1 ? 'i' : 'o'}</span>
                            </div>
                            <div class="acg-list">
                                ${comments.map(c => {
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
                                }).join('')}
                            </div>
                        </div>
                    `;
                });

                // Artisti senza match in classifica (es. id non trovato)
                Object.keys(grouped).forEach(artistId => {
                    const id = parseInt(artistId);
                    if (sorted.find(a => a.id === id)) return;
                    const comments = grouped[artistId];
                    const count = comments.length;
                    html += `
                        <div class="acg-group">
                            <div class="acg-header">
                                <div class="acg-header-info">
                                    <span class="acg-artist-name">Artista #${escapeHtml(artistId)}</span>
                                </div>
                                <span class="acg-count">${count} comment${count !== 1 ? 'i' : 'o'}</span>
                            </div>
                            <div class="acg-list">
                                ${comments.map(c => {
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
                                }).join('')}
                            </div>
                        </div>
                    `;
                });

                container.innerHTML = hasAny ? html : '<div class="no-comments" style="padding:40px;text-align:center">Nessun commento ancora presente. Sii il primo! 🎤</div>';
            },
            error => {
                console.error('Errore caricamento tutti i commenti:', error);
                container.innerHTML = '<div class="no-comments" style="padding:40px;text-align:center">❌ Errore nel caricamento dei commenti.</div>';
            }
        );
}