let artists = [];
let commentsUnsubscribe = null;
let allCommentsUnsubscribe = null;

// Carica i dati da Firestore all'avvio
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

function loadData() {
    setGridLoading();

    if (!window.db) {
        fetch('data.json')
            .then(r => r.json())
            .then(data => { artists = data; renderAllTabs(); })
            .catch(() => setGridError());
        return;
    }

    window.db.collection('artists')
        .orderBy('id', 'asc')
        .onSnapshot(
            snapshot => {
                if (snapshot.empty) { setGridEmpty(); return; }
                artists = snapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
                renderAllTabs();
            },
            error => { console.error('Errore Firestore:', error); setGridError(); }
        );
}

function setGridLoading() {
    ['gridS1','gridS2','gridS3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p class="ranking-empty">⏳ Caricamento...</p>';
    });
}
function setGridEmpty() {
    ['gridS1','gridS2','gridS3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p class="ranking-empty">Nessun artista ancora inserito.</p>';
    });
}
function setGridError() {
    ['gridS1','gridS2','gridS3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p class="ranking-empty">❌ Errore nel caricamento dei dati.</p>';
    });
}

// ── Calcoli punteggi ────────────────────────────────────────
function calcS1(a) {   // Prime 3 serate
    return parseFloat(a.performance || 0) +
           parseFloat(a.songScore   || 0) +
           parseFloat(a.lyrics      || 0);
}
function calcS2(a) {   // Serata Cover
    return parseFloat(a.cover || 0);
}
function calcS3raw(a) { // Finale (solo criteri)
    return parseFloat(a.perfFinale || 0) +
           parseFloat(a.songFinale  || 0) +
           parseFloat(a.lyricsFinale|| 0);
}
function calcCriteria(a) {
    return calcS1(a) + calcS2(a) + calcS3raw(a);
}
// Totale ponderato: criteri 67% + televoto 33%
// max criteri = 7 × 10 = 70; pubblico normalizzato sulla stessa scala
function calculateTotal(a) {
    const c = calcCriteria(a);
    const p = parseFloat(a.pubblicoScore || 0);
    return (c * 0.67 + p * 2.31).toFixed(1);  // p*2.31 = (p/10)*70*0.33
}

// ── Render per serata ───────────────────────────────────────
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

function buildCard(artist, index, scoreFn, scoreItems, totalLabel, totalValue) {
    const pos      = index + 1;
    const posLabel = MEDALS[pos] || `#${pos}`;
    return `
    <div class="artist-card ranking-card" onclick="showReview(${artist.id})">
        <div class="position-badge ranking-pos">${posLabel}</div>
        <img src="${artist.photo || 'https://via.placeholder.com/300x200'}"
             alt="${artist.name}"
             onerror="this.src='https://via.placeholder.com/300x200'">
        <div class="ranking-card-body">
            <h3>${artist.name}</h3>
            ${artist.song ? `<p class="ranking-song">🎵 ${artist.song}</p>` : ''}
            <div class="scores ranking-scores">
                ${scoreItems}
            </div>
            <div class="ranking-total">
                <span>${totalLabel}</span>
                <strong>${totalValue}</strong>
            </div>
            <button class="btn-review ranking-btn"
                    onclick="event.stopPropagation(); showReview(${artist.id})">
                📝 Valutazione e commenti
            </button>
        </div>
    </div>`;
}

function renderS1() {
    const grid   = document.getElementById('gridS1');
    if (!grid) return;
    const sorted = [...artists].sort((a, b) => calcS1(b) - calcS1(a));
    if (!sorted.length) { grid.innerHTML = '<p class="ranking-empty">Nessun artista.</p>'; return; }
    grid.innerHTML = sorted.map((a, i) => buildCard(a, i, calcS1, `
        <div><span>🎤 Performance</span><strong>${a.performance || '-'}</strong></div>
        <div><span>🎵 Brano</span><strong>${a.songScore || '-'}</strong></div>
        <div><span>📝 Testo</span><strong>${a.lyrics || '-'}</strong></div>
    `, 'Punteggio serate 1–3', calcS1(a).toFixed(1))).join('');
}

function renderS2() {
    const grid   = document.getElementById('gridS2');
    if (!grid) return;
    const sorted = [...artists].sort((a, b) => calcS2(b) - calcS2(a));
    if (!sorted.length) { grid.innerHTML = '<p class="ranking-empty">Nessun artista.</p>'; return; }
    grid.innerHTML = sorted.map((a, i) => buildCard(a, i, calcS2, `
        <div class="score-cover-solo"><span>🎸 Serata Cover</span><strong>${a.cover || '-'}</strong></div>
    `, 'Punteggio Cover', calcS2(a).toFixed(1))).join('');
}

function renderS3() {
    const grid   = document.getElementById('gridS3');
    if (!grid) return;
    const sorted = [...artists].sort((a, b) => calculateTotal(b) - calculateTotal(a));
    if (!sorted.length) { grid.innerHTML = '<p class="ranking-empty">Nessun artista.</p>'; return; }
    const hasPub = artists.some(a => a.pubblicoScore != null && a.pubblicoScore !== '');
    grid.innerHTML = sorted.map((a, i) => {
        const pubItem = (a.pubblicoScore != null && a.pubblicoScore !== '')
            ? `<div class="score-pubblico"><span>📺 Pubblico (33%)</span><strong>${a.pubblicoScore}</strong></div>`
            : '';
        return buildCard(a, i, calculateTotal, `
            <div><span>🎤 Performance</span><strong>${a.perfFinale || '-'}</strong></div>
            <div><span>🎵 Brano</span><strong>${a.songFinale || '-'}</strong></div>
            <div><span>📝 Testo</span><strong>${a.lyricsFinale || '-'}</strong></div>
            ${pubItem}
        `, 'Punteggio Finale (67%+33%)', calculateTotal(a));
    }).join('');
}

function renderAllTabs() {
    renderS1();
    renderS2();
    renderS3();
}

// ── Cambio tab ──────────────────────────────────────────────
function switchTab(tab) {
    const panels = {
        s1:       'panelS1',
        s2:       'panelS2',
        s3:       'panelS3',
        comments: 'commentsPanel'
    };
    const tabs = {
        s1:       'tabS1',
        s2:       'tabS2',
        s3:       'tabS3',
        comments: 'tabComments'
    };

    Object.keys(panels).forEach(key => {
        const p = document.getElementById(panels[key]);
        const t = document.getElementById(tabs[key]);
        if (p) p.style.display = (key === tab) ? 'block' : 'none';
        if (t) t.classList.toggle('active', key === tab);
    });

    if (tab === 'comments') {
        loadAllComments();
    } else {
        if (allCommentsUnsubscribe) {
            allCommentsUnsubscribe();
            allCommentsUnsubscribe = null;
        }
    }
}

function showReview(id) {
    const artist = artists.find(a => a.id === id);
    if (!artist) return;

    const modal     = document.getElementById('reviewModal');
    const modalBody = document.getElementById('modalBody');
    const savedName = (localStorage.getItem('commentName') || '').replace(/"/g, '&quot;');

    const hasS3 = artist.perfFinale || artist.songFinale || artist.lyricsFinale || artist.reviewFinale;
    const hasPub = artist.pubblicoScore != null && artist.pubblicoScore !== '';

    modalBody.innerHTML = `
        <h2>${artist.name}</h2>
        ${artist.song ? `<p style="color:var(--text-light);font-style:italic;">${artist.song}</p>` : ''}

        <!-- Punteggi riepilogativi -->
        <div class="review-serata-block">
            <h4 class="review-serata-title">🎭 Serate 1–3</h4>
            <div class="scores-grid">
                <div class="score-item"><strong>Performance</strong><span>${artist.performance || '-'}</span></div>
                <div class="score-item"><strong>Brano</strong><span>${artist.songScore || '-'}</span></div>
                <div class="score-item"><strong>Testo</strong><span>${artist.lyrics || '-'}</span></div>
            </div>
            <div class="review-text">${artist.review || '<em>Nessuna valutazione.</em>'}</div>
        </div>

        <div class="review-serata-block">
            <h4 class="review-serata-title">🎸 Serata Cover</h4>
            <div class="scores-grid">
                <div class="score-item"><strong>Cover</strong><span>${artist.cover || '-'}</span></div>
            </div>
            ${artist.reviewCover ? `<div class="review-text">${artist.reviewCover}</div>` : '<div class="review-text"><em>Nessuna valutazione.</em></div>'}
        </div>

        ${hasS3 ? `
        <div class="review-serata-block">
            <h4 class="review-serata-title">🏆 Finale</h4>
            <div class="scores-grid">
                <div class="score-item"><strong>Performance</strong><span>${artist.perfFinale || '-'}</span></div>
                <div class="score-item"><strong>Brano</strong><span>${artist.songFinale || '-'}</span></div>
                <div class="score-item"><strong>Testo</strong><span>${artist.lyricsFinale || '-'}</span></div>
                ${hasPub ? `<div class="score-item score-item-pub"><strong>📺 Pubblico (33%)</strong><span>${artist.pubblicoScore}</span></div>` : ''}
            </div>
            ${artist.reviewFinale ? `<div class="review-text">${artist.reviewFinale}</div>` : ''}
            <div class="ranking-total" style="margin-top:10px;">
                <span>Punteggio Finale (67%+33%)</span>
                <strong>${calculateTotal(artist)}</strong>
            </div>
        </div>` : ''}

        <div class="comments-section">
            <h3>💬 Commenti dei visitatori</h3>
            <div class="comment-form">
                <input type="text" id="commentName" class="comment-input"
                    placeholder="Il tuo nome (es. Mario Rossi)..." maxlength="50" value="${savedName}">
                <textarea id="commentText" class="comment-textarea"
                    placeholder="Lascia un commento su questo artista..."
                    maxlength="500" rows="3"></textarea>
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

// switchTab è definita sopra (sezione renderCards)

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