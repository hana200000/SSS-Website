// ═══════════════════════════════════════════════
// DATA & GOOGLE SHEETS FETCH
// ═══════════════════════════════════════════════
const SHEET_ID = '1S2Je9TEmvsOIgCdJAhVCKb_VmWcsD6bX3yDZBvsTIZ8';
let posts = [];
let currentPost = null;

// ── Pagination state — one counter per grid ──
let displayedLinkedinCount = 6;
let displayedArticlesCount = 3;
const LINKEDIN_PER_PAGE    = 6;
const ARTICLES_PER_PAGE    = 3;

// ─── Parse Google Sheets Date(year,month,day) → readable string ───
function parseSheetDate(val) {
  if (typeof val === 'string' && val.startsWith('Date(')) {
    const parts = val.replace('Date(', '').replace(')', '').split(',');
    const year  = parseInt(parts[0]);
    const month = parseInt(parts[1]); // Google Sheets month is 0-indexed
    const day   = parseInt(parts[2]);
    const d = new Date(year, month, day);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  return val;
}

async function fetchGoogleSheetPosts() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
  try {
    const response = await fetch(url);
    const text = await response.text();
    const jsonString = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/)[1];
    const data = JSON.parse(jsonString);

    const cols = data.table.cols.map(c => c.label.toLowerCase().trim());
    const rows = data.table.rows;

    posts = rows.map((row, index) => {
      let post = { id: index + 1 };
      cols.forEach((colName, i) => {
        let val = row.c[i] && row.c[i].v !== null ? row.c[i].v : '';
        if (colName === 'date') val = parseSheetDate(String(val));
        post[colName] = val;
      });

      return {
        id:            post.id,
        category:      post.category || 'General',
        title:         post.title    || 'Untitled Post',
        excerpt:       post.excerpt  || 'Click to view the post...',
        content:       post.content  || '',
        embed:         post.embed    || '',
        date:          post.date     || 'Recent',
        likes:         post.likes    || 0,
        comments:      post.comments || 0,
        url:           post.url      || '',
        // Premium Digital Library Fields
        thumbnail_url: post.thumbnail_url || '',
        doc_type:      post.doc_type || 'Article',
        language:      post.language || 'EN'
      };
    }).reverse();

    renderFeaturedPosts();
    renderInsights();
  } catch (err) {
    console.error('Error fetching Google Sheets:', err);
  }
}

// ═══════════════════════════════════════════════
// SMART LOGIC (DRIVE & PDF DETECTION)
// ═══════════════════════════════════════════════
function isPdfLink(link) {
  if (!link) return false;
  const l = link.toLowerCase();
  return l.endsWith('.pdf') || l.includes('drive.google.com/file/');
}

function isArticlePost(p) {
  if (isPdfLink(p.embed) || isPdfLink(p.url)) return true;
  if (!p.embed && (!p.url || !p.url.toLowerCase().includes('linkedin'))) return true;
  return false;
}

// ═══════════════════════════════════════════════
// SMART PLACEHOLDER GENERATORS
// ═══════════════════════════════════════════════
function getDocTypeIcon(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('dictionary') || t.includes('book')) {
    return `<svg class="custom-svg-icon" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
  }
  if (t.includes('case study')) {
    return `<svg class="custom-svg-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
  }
  if (t.includes('contract')) {
    return `<svg class="custom-svg-icon" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  }
  // Default Document/Guide Icon
  return `<svg class="custom-svg-icon" viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
}

function getDocTypeGradient(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('dictionary') || t.includes('book')) return 'linear-gradient(135deg, var(--aramco-dark-blue), var(--navy-mid))';
  if (t.includes('case study')) return 'linear-gradient(135deg, var(--aramco-blue), var(--aramco-dark-blue))';
  if (t.includes('contract')) return 'linear-gradient(135deg, var(--aramco-green), var(--aramco-dark-green))';
  // Default Guide/Whitepaper
  return 'linear-gradient(135deg, var(--aramco-blue), var(--aramco-green))';
}

// ═══════════════════════════════════════════════
// RENDER & CARDS
// ═══════════════════════════════════════════════
function getCatClass(cat) {
  const map = {
    'Procurement':  'cat-procurement',
    'Leadership':   'cat-leadership',
    'AI':           'cat-ai',
    'Vision 2030':  'cat-vision2030',
    'Supply Chain': 'cat-supplychain',
    'Contracts':    'cat-contracts',
    'Articles':     'cat-articles'
  };
  return map[cat] || 'cat-procurement';
}

function renderFeaturedPosts() {
  const container = document.getElementById('featuredPosts');
  if (!container) return;
  const featured = posts.slice(0, 3);
  container.innerHTML = featured.map(p => {
    const displayCat = p.category === 'AI' ? 'AI & Tech' : p.category;
    return `
    <div class="post-card" onclick="openPost(${p.id})">
      <span class="post-cat ${getCatClass(p.category)}">${displayCat}</span>
      <div class="post-title">${p.title}</div>
      <div class="post-excerpt">${p.excerpt}</div>
      <div class="post-meta">
        <span class="post-date">${p.date}</span>
        <div class="post-engagement">
          <span class="post-eng-item"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/></svg>${p.likes}</span>
          <span class="post-eng-item"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>${p.comments}</span>
        </div>
      </div>
    </div>`
  }).join('');
}

// Premium Digital Library Card Builder
function buildArticleCard(p) {
  const langText = p.language ? p.language.substring(0, 2).toUpperCase() : 'EN'; 
  const docType  = p.doc_type || 'Article';
  const isPdf = isPdfLink(p.embed) || isPdfLink(p.url);
  
  const actionText = isPdf ? 'Download PDF' : 'View Document';
  const actionIcon = isPdf 
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

  let coverHtml = '';
  if (p.thumbnail_url && p.thumbnail_url.trim() !== '') {
    coverHtml = `<img src="${p.thumbnail_url}" alt="${p.title}" class="article-cover-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                 <div class="article-placeholder" style="display:none; background: ${getDocTypeGradient(docType)};">${getDocTypeIcon(docType)}</div>`;
  } else {
    coverHtml = `<div class="article-placeholder" style="background: ${getDocTypeGradient(docType)};">${getDocTypeIcon(docType)}</div>`;
  }

  let displayExcerpt = p.excerpt || '';
  if (!displayExcerpt || displayExcerpt.trim() === 'Click to view the post...' || displayExcerpt.trim() === '') {
    displayExcerpt = 'Click to open and read this document...';
  }

  return `
    <div class="article-card" onclick="openPost(${p.id})">
      <div class="article-cover">
        ${coverHtml}
        <div class="article-cover-overlay">
          <button class="btn-primary" style="pointer-events:none;">${actionIcon} ${actionText}</button>
        </div>
      </div>
      <div class="article-card-body">
        <div class="article-meta-row">
          <span class="doc-badge">${docType}</span>
          <span class="lang-badge">${langText}</span>
        </div>
        <h3 class="article-title" dir="auto">${p.title}</h3>
        <p class="article-excerpt" dir="auto">${displayExcerpt}</p>
        <div class="article-footer">
          <div class="insight-date">${p.date}</div>
        </div>
      </div>
    </div>`;
}

// Standard LinkedIn Card Builder
function buildInsightCard(p) {
  if (isArticlePost(p)) return buildArticleCard(p);

  const displayCat = p.category === 'AI' ? 'AI & Tech' : p.category;
  let displayExcerpt = p.excerpt || '';
  if (!displayExcerpt || displayExcerpt.trim() === 'Click to view the post...' || displayExcerpt.trim() === '') {
    displayExcerpt = 'Click to view the post...';
  }

  return `
    <div class="insight-card" onclick="openPost(${p.id})">
      <div class="insight-card-top">
        <span class="post-cat ${getCatClass(p.category)}">${displayCat}</span>
        <div class="insight-title" dir="auto">${p.title}</div>
      </div>
      <div class="insight-card-body">
        <div class="insight-content" dir="auto">${displayExcerpt}</div>
      </div>
      <div class="insight-footer">
        <div class="insight-author">
          <div class="insight-avatar"><img src="./imgs/1742757129322.jpeg" alt="Abdulmajeed Al Sheraim"></div>
          <div><div class="insight-author-name">Abdulmajeed Al Sheraim</div><div class="insight-date">${p.date}</div></div>
        </div>
        <div class="insight-stats">
          <span class="insight-stat"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/></svg>${p.likes || 0}</span>
          <span class="insight-stat"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>${p.comments || 0}</span>
        </div>
      </div>
    </div>`;
}

// ─── INSIGHTS FILTER LOGIC ───
let activeInsightFilter = 'All';

function setInsightFilter(el, cat) {
  activeInsightFilter = cat;
  document.querySelectorAll('#insightFilterChips .filter-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderInsights(true);
}

function renderInsights(reset = true) {
  const linkedinGrid   = document.getElementById('linkedinGrid');
  const articlesGrid   = document.getElementById('articlesGrid');
  const noR            = document.getElementById('noResults');
  const liNoR          = document.getElementById('linkedinNoResults');
  const arNoR          = document.getElementById('articlesNoResults');
  const liLoadMore     = document.getElementById('linkedinLoadMoreContainer');
  const arLoadMore     = document.getElementById('articlesLoadMoreContainer');

  if (!linkedinGrid || !articlesGrid) return;

  if (reset) {
    displayedLinkedinCount = LINKEDIN_PER_PAGE;
    displayedArticlesCount = ARTICLES_PER_PAGE;
  }

  const liSearch = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const arSearch = (document.getElementById('articlesSearchInput')?.value || '').toLowerCase();

  function matchesLinkedinSearch(p) {
    if (!liSearch) return true;
    return p.title.toLowerCase().includes(liSearch) || p.excerpt.toLowerCase().includes(liSearch) || p.category.toLowerCase().includes(liSearch);
  }

  function matchesArticlesSearch(p) {
    if (!arSearch) return true;
    return p.title.toLowerCase().includes(arSearch) || p.excerpt.toLowerCase().includes(arSearch) || (p.doc_type && p.doc_type.toLowerCase().includes(arSearch));
  }

  function matchesInsightFilter(p) {
    if (activeInsightFilter === 'All') return true;
    return p.category === activeInsightFilter;
  }

  const filteredLinkedin = posts.filter(p => !isArticlePost(p) && matchesLinkedinSearch(p) && matchesInsightFilter(p));
  const filteredArticles = posts.filter(p => isArticlePost(p) && matchesArticlesSearch(p));

  if (!filteredLinkedin.length) {
    linkedinGrid.innerHTML = '';
    if (liNoR) liNoR.style.display = 'block';
    if (liLoadMore) liLoadMore.style.display = 'none';
  } else {
    if (liNoR) liNoR.style.display = 'none';
    const liItems = filteredLinkedin.slice(0, displayedLinkedinCount);
    linkedinGrid.innerHTML = liItems.map(buildInsightCard).join('');
    if (liLoadMore) liLoadMore.style.display = displayedLinkedinCount >= filteredLinkedin.length ? 'none' : 'flex';
  }

  if (!filteredArticles.length) {
    articlesGrid.innerHTML = '';
    if (arNoR) arNoR.style.display = 'block';
    if (arLoadMore) arLoadMore.style.display = 'none';
  } else {
    if (arNoR) arNoR.style.display = 'none';
    const arItems = filteredArticles.slice(0, displayedArticlesCount);
    articlesGrid.innerHTML = arItems.map(buildArticleCard).join('');
    if (arLoadMore) arLoadMore.style.display = displayedArticlesCount >= filteredArticles.length ? 'none' : 'flex';
  }

  if (noR) noR.style.display = !filteredLinkedin.length ? 'block' : 'none';
  const liSection = document.getElementById('linkedinSection');
  if (liSection) liSection.style.display = filteredLinkedin.length ? '' : (liSearch ? 'none' : '');
}

function loadMoreLinkedin() { displayedLinkedinCount += LINKEDIN_PER_PAGE; renderInsights(false); }
function loadMoreArticles() { displayedArticlesCount += ARTICLES_PER_PAGE; renderInsights(false); }

// ═══════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════
function openPost(id) {
  const post = posts.find(p => String(p.id) === String(id));
  if (!post) return;
  currentPost = post;

  const isArticle = isArticlePost(post);
  const displayCat = post.category === 'AI' ? 'AI & Tech' : post.category;
  
  // Toggle Reader Mode class
  const modalContainer = document.getElementById('postModal').querySelector('.modal');
  if (isArticle) {
    modalContainer.classList.add('article-mode');
  } else {
    modalContainer.classList.remove('article-mode');
  }

  // Set Top Header Data
  if (isArticle && post.doc_type) {
    document.getElementById('modalCat').innerHTML = `<span class="doc-badge" style="margin-bottom:0;">${post.doc_type}</span>`;
  } else {
    document.getElementById('modalCat').innerHTML = `<span class="post-cat ${getCatClass(post.category)}" style="margin-bottom:0;">${displayCat}</span>`;
  }
  
  document.getElementById('modalTitle').textContent = post.title;
  document.getElementById('modalDate').textContent  = post.date;

  const modalBody = document.getElementById('modalBody');
  let contentHtml = '';

  const pdfLink = isPdfLink(post.embed) ? post.embed : isPdfLink(post.url) ? post.url : null;
  const isPdf = !!pdfLink;
  const isLinkedinEmbed = !isPdf && post.embed && post.embed.trim() !== '';

  if (isPdf) {
    contentHtml = `
      <div style="display:flex;justify-content:center;width:100%; height: 85vh; padding-bottom: 20px;">
        <iframe src="${pdfLink}" style="width: 100%; height: 100%; border: none; border-radius:0 0 10px 10px;" allowfullscreen="" title="PDF Document"></iframe>
      </div>`;
  } else if (isLinkedinEmbed) {
    contentHtml = `
      <div style="display:flex;justify-content:center;width:100%;padding:20px 0;">
        <iframe src="${post.embed}" height="669" width="100%" frameborder="0" allowfullscreen="" title="Embedded post" style="border-radius:10px;max-width:504px;box-shadow:0 4px 12px rgba(0,0,0,0.1);"></iframe>
      </div>`;
  } else {
    const rawText = (post.content || post.excerpt || '').trim();
    const finalRawText = (rawText && rawText !== 'Click to view the post...') ? rawText : (isArticle ? 'Click the button below to view the document.' : '');

    const lines = finalRawText.split(/\r?\n/);
    let htmlParts = [];
    let listBuffer = [];

    function flushList() {
      if (listBuffer.length) { htmlParts.push(`<ul class="modal-list">${listBuffer.join('')}</ul>`); listBuffer = []; }
    }
    function applyInline(text) {
      return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    }

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) { flushList(); htmlParts.push('<div class="modal-para-gap"></div>'); return; }
      if (/^(---|___|\*\*\*)$/.test(trimmed)) { flushList(); htmlParts.push('<hr class="modal-divider">'); return; }
      if (trimmed.startsWith('### ')) { flushList(); htmlParts.push(`<h4 class="modal-h4">${applyInline(trimmed.slice(4))}</h4>`); return; }
      if (trimmed.startsWith('## ')) { flushList(); htmlParts.push(`<h3 class="modal-h3">${applyInline(trimmed.slice(3))}</h3>`); return; }
      if (trimmed.startsWith('# ')) { flushList(); htmlParts.push(`<h2 class="modal-h2">${applyInline(trimmed.slice(2))}</h2>`); return; }
      if (trimmed.startsWith('> ')) { flushList(); htmlParts.push(`<blockquote class="modal-blockquote">${applyInline(trimmed.slice(2))}</blockquote>`); return; }
      if (/^[-*]\s/.test(trimmed)) { listBuffer.push(`<li>${applyInline(trimmed.slice(2))}</li>`); return; }
      flushList(); htmlParts.push(`<p dir="auto">${applyInline(trimmed)}</p>`);
    });
    flushList();
    contentHtml = `<div class="modal-text-content">${htmlParts.join('\n')}</div>`;
  }

 let statsHtml = '';
  if (!isArticle && !isLinkedinEmbed && !isPdf) {
    statsHtml = `
      <div class="modal-stats">
        <span class="modal-stat"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/></svg> ${post.likes || 0}</span>
        <span class="modal-stat"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg> ${post.comments || 0}</span>
      </div>`;
  }

  let btnHtml = '';
  if (isPdf) {
    btnHtml = `
      <a href="${pdfLink}" target="_blank" rel="noopener noreferrer" class="modal-linkedin-btn" style="background: var(--aramco-blue);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Open / Download
      </a>`;
  } else if (!isArticle && post.url && post.url.trim() !== '') {
    btnHtml = `
      <a href="${post.url.trim()}" target="_blank" rel="noopener noreferrer" class="modal-linkedin-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        View on LinkedIn
      </a>`;
  }

  const topAction = document.getElementById('modalTopAction');
  if (topAction) topAction.innerHTML = btnHtml;

  let footerHtml = '';
  if (statsHtml !== '') {
    footerHtml = `<div class="modal-engagement-footer">${statsHtml}</div>`;
  }

  modalBody.innerHTML = contentHtml + footerHtml;
  modalBody.style.background = '#ffffff';

  document.getElementById('postModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('postModal')) return;
  document.getElementById('postModal').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('modalBody').innerHTML = '';
}

// ═══════════════════════════════════════════════
// NAV & ROUTING
// ═══════════════════════════════════════════════
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (page === 'insights' || page === 'articles') renderInsights();
}

function filterPosts() { renderInsights(); }
function filterArticles() { renderInsights(); }

function filterByTag(category) {
  showPage('insights');
  const chip = document.querySelector(`#insightFilterChips .filter-chip[data-cat="${category}"]`);
  if (chip) {
    setInsightFilter(chip, category);
  } else {
    setInsightFilter(null, category); 
  }
}

function toggleMobile() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

// ═══════════════════════════════════════════════
// FORMS
// ═══════════════════════════════════════════════
function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  const group = field.closest('.form-group');
  group.classList.add('has-error');
  field.classList.add('input-error');
  const existing = group.querySelector('.field-error');
  if (existing) existing.remove();
  const err = document.createElement('span');
  err.className = 'field-error';
  err.setAttribute('role', 'alert');
  err.textContent = message;
  field.insertAdjacentElement('afterend', err);
}

function clearFieldErrors() {
  document.querySelectorAll('.form-group.has-error').forEach(g => g.classList.remove('has-error'));
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  document.querySelectorAll('.field-error').forEach(el => el.remove());
}

function showToast(message, type = 'error') {
  const existing = document.getElementById('formToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'formToast';
  toast.className = `form-toast form-toast--${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('form-toast--visible'));
  setTimeout(() => {
    toast.classList.remove('form-toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 5000);
}

async function submitForm() {
  clearFieldErrors();
  const firstName = document.getElementById('cfFirstName').value.trim();
  const lastName  = document.getElementById('cfLastName').value.trim();
  const email     = document.getElementById('cfEmail').value.trim();
  const company   = document.getElementById('cfCompany').value.trim();
  const subject   = document.getElementById('cfSubject').value.trim();
  const message   = document.getElementById('cfMessage').value.trim();

  let hasErrors = false;
  if (!firstName) { setFieldError('cfFirstName', 'Please enter your first name.'); hasErrors = true; }
  if (!lastName) { setFieldError('cfLastName', 'Please enter your last name.'); hasErrors = true; }
  if (!email) { setFieldError('cfEmail', 'Please enter your email address.'); hasErrors = true; } 
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError('cfEmail', 'Please enter a valid email address.'); hasErrors = true; }
  if (!company) { setFieldError('cfCompany', 'Please provide your company.'); hasErrors = true; }
  if (!subject) { setFieldError('cfSubject', 'Please select a subject.'); hasErrors = true; }
  if (!message) { setFieldError('cfMessage', "Don't forget to write your message."); hasErrors = true; }

  if (hasErrors) return;

  const submitBtn = document.querySelector('.form-submit');
  const originalBtnText = submitBtn.innerText;
  submitBtn.innerText = 'Sending…';
  submitBtn.disabled = true;

  try {
    const response = await fetch('https://formspree.io/f/mnjwqkkw', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ Name: firstName + ' ' + lastName, Email: email, Company: company, Subject: subject, Message: message })
    });
    if (response.ok) {
      document.getElementById('contactFormEl').style.display = 'none';
      document.getElementById('formSuccess').style.display   = 'block';
    } else {
      showToast('Problem submitting form.');
    }
  } catch (error) {
    showToast('Could not send message. Please check connection.');
  } finally {
    submitBtn.innerText = originalBtnText;
    submitBtn.disabled  = false;
  }
}

// ═══════════════════════════════════════════════
// UI EXTRAS
// ═══════════════════════════════════════════════
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.addEventListener('DOMContentLoaded', fetchGoogleSheetPosts);

let currentSlide = 0;
function moveCarousel(direction) {
  const track = document.getElementById('featuredCarouselTrack');
  if (!track) return;
  const slides = track.querySelectorAll('.carousel-slide');
  let visibleSlides = window.innerWidth <= 768 ? 1 : 2;
  const maxSlide = slides.length - visibleSlides;

  currentSlide += direction;
  if (currentSlide < 0) currentSlide = 0;
  if (currentSlide > maxSlide) currentSlide = maxSlide;

  track.style.transform = `translateX(-${currentSlide * (slides[0].offsetWidth + 24)}px)`;
}
window.addEventListener('resize', () => {
  currentSlide = 0;
  const track = document.getElementById('featuredCarouselTrack');
  if (track) track.style.transform = 'translateX(0px)';
});
