// ═══════════════════════════════════════════════
// DATA & GOOGLE SHEETS FETCH
// ═══════════════════════════════════════════════
const SHEET_ID = '1S2Je9TEmvsOIgCdJAhVCKb_VmWcsD6bX3yDZBvsTIZ8';
let posts = [];
let activeFilter = 'All';
let currentPost = null;

// NEW: Pagination State
let displayedInsightsCount = 6;
const INSIGHTS_PER_PAGE = 6;

// ─── FIX: Parse Google Sheets Date(year,month,day) → readable string ───
function parseSheetDate(val) {
  if (typeof val === 'string' && val.startsWith('Date(')) {
    const parts = val.replace('Date(', '').replace(')', '').split(',');
    const year  = parseInt(parts[0]);
    const month = parseInt(parts[1]); // Google Sheets month is 0-indexed
    const day   = parseInt(parts[2]);
    const d = new Date(year, month, day);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  return val; // already a string or empty
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
        // ─── FIX: parse date values from Google Sheets format ───
        let val = row.c[i] && row.c[i].v !== null ? row.c[i].v : '';
        if (colName === 'date') {
          val = parseSheetDate(String(val));
        }
        post[colName] = val;
      });

      return {
        id:       post.id,
        category: post.category || 'General',
        title:    post.title    || 'Untitled Post',
        excerpt:  post.excerpt  || 'Click to view the post...',
        content:  post.content  || '',
        embed:    post.embed    || '',
        date:     post.date     || 'Recent',
        likes:    post.likes    || 0,
        comments: post.comments || 0,
        url:      post.url      || ''
      };
    }).reverse(); // latest post first

    renderFeaturedPosts();
    renderInsights();

  } catch (err) {
    console.error('Error fetching Google Sheets:', err);
  }
}

// ═══════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════
function getCatClass(cat) {
  const map = {
    'Procurement':  'cat-procurement',
    'Leadership':   'cat-leadership',
    'AI':           'cat-ai',
    'Vision 2030':  'cat-vision2030',
    'Supply Chain': 'cat-supplychain',
    'Contracts':    'cat-contracts'
  };
  return map[cat] || 'cat-procurement';
}

function renderFeaturedPosts() {
  const container = document.getElementById('featuredPosts');
  if (!container) return;
  const featured = posts.slice(0, 3);
  container.innerHTML = featured.map(p => {
    // ─── AI Display Fix ───
    const displayCat = p.category === 'AI' ? 'AI & Tech' : p.category;
    return `
    <div class="post-card" onclick="openPost(${p.id})">
      <span class="post-cat ${getCatClass(p.category)}">${displayCat}</span>
      <div class="post-title">${p.title}</div>
      <div class="post-excerpt">${p.excerpt}</div>
      <div class="post-meta">
        <span class="post-date">${p.date}</span>
        <div class="post-engagement">
          <span class="post-eng-item">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
            </svg>
            ${p.likes}
          </span>
          <span class="post-eng-item">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
            </svg>
            ${p.comments}
          </span>
        </div>
      </div>
    </div>
  `}).join('');
}

function renderInsights(reset = true) {
  const grid = document.getElementById('insightsGrid');
  const noR  = document.getElementById('noResults');
  const loadMore = document.getElementById('loadMoreContainer');
  if (!grid || !noR) return;

  // Reset the count if we are filtering or searching
  if (reset) {
    displayedInsightsCount = INSIGHTS_PER_PAGE;
  }

  const search   = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const filtered = posts.filter(p => {
    const matchCat    = activeFilter === 'All' || p.category === activeFilter;
    const matchSearch = !search
      || p.title.toLowerCase().includes(search)
      || p.excerpt.toLowerCase().includes(search)
      || p.category.toLowerCase().includes(search);
    return matchCat && matchSearch;
  });

  if (!filtered.length) {
    grid.innerHTML = '';
    noR.style.display = 'block';
    if (loadMore) loadMore.style.display = 'none';
    return;
  }
  noR.style.display = 'none';

  // Slice the filtered array to only show the allowed count
  const itemsToShow = filtered.slice(0, displayedInsightsCount);

  grid.innerHTML = itemsToShow.map(p => {
    // ─── AI Display Fix ───
    const displayCat = p.category === 'AI' ? 'AI & Tech' : p.category;
    return `
    <div class="insight-card" onclick="openPost(${p.id})">
      <div class="insight-card-top">
        <span class="post-cat ${getCatClass(p.category)}">${displayCat}</span>
        <div class="insight-title">${p.title}</div>
      </div>
      <div class="insight-card-body">
        <div class="insight-content">${p.excerpt}</div>
      </div>
      <div class="insight-footer">
        <div class="insight-author">
          <div class="insight-avatar">
            <img src="./imgs/1742757129322.jpeg" alt="Abdulmajeed Al Sheraim">
          </div>
          <div>
            <div class="insight-author-name">Abdulmajeed Al Sheraim</div>
            <div class="insight-date">${p.date}</div>
          </div>
        </div>
        <div class="insight-stats">
          <span class="insight-stat">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
            </svg>
            ${p.likes}
          </span>
          <span class="insight-stat">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
            </svg>
            ${p.comments}
          </span>
        </div>
      </div>
    </div>
  `}).join('');

  // Handle "Load More" button visibility
  // Handle "Load More" button visibility
  if (loadMore) {
    if (displayedInsightsCount >= filtered.length) {
      loadMore.style.display = 'none';
    } else {
      loadMore.style.display = 'flex'; 
    }
  }
}

// NEW: Function to load the next set of insights
function loadMoreInsights() {
  displayedInsightsCount += INSIGHTS_PER_PAGE;
  renderInsights(false); // Pass false so it doesn't reset the count
}

// ═══════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════
function openPost(id) {
  const post = posts.find(p => String(p.id) === String(id));
  if (!post) return;
  currentPost = post;

  // ─── AI Display Fix ───
  const displayCat = post.category === 'AI' ? 'AI & Tech' : post.category;

  document.getElementById('modalCat').innerHTML =
    `<span class="post-cat ${getCatClass(post.category)}">${displayCat}</span>`;
  document.getElementById('modalTitle').textContent = post.title;
  document.getElementById('modalDate').textContent  = post.date;

  const modalBody = document.getElementById('modalBody');
  let contentHtml = '';

  const isEmbed = post.embed && post.embed.trim() !== '';

  if (isEmbed) {
    // ── Show LinkedIn embed iframe ──
    contentHtml = `
      <div style="display:flex;justify-content:center;width:100%;padding:20px 0;">
        <iframe
          src="${post.embed}"
          height="669" width="100%"
          frameborder="0" allowfullscreen=""
          title="Embedded post"
          style="border-radius:10px;max-width:504px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        </iframe>
      </div>`;
  } else {
    // ─── Rich text rendering for Arabic/English ───
    const rawText = (post.content || post.excerpt || '').trim();

    const paragraphs = rawText
      .split(/\n\n|\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const textHtml = paragraphs.map(para => {
      // Handle simple dash dividers from sheet
      if (para === '---' || para === '___') return '<hr class="modal-divider">';

      let formatted = para.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

      // dir="auto" handles Arabic alignment automatically
      return `<p dir="auto">${formatted}</p>`;
    }).join('');

    contentHtml = `<div class="modal-text-content">${textHtml}</div>`;
  }

  // ─── Footer: stats + dynamic URL button from sheet ───
  // postUrl comes from the 'url' column in the Google Sheet.
  // If the cell is empty, the button is hidden entirely.
  const postUrl = post.url && post.url.trim() !== '' ? post.url.trim() : null;

  const footerHtml = `
    <div class="modal-engagement-footer">
      ${!isEmbed ? `
      <div class="modal-stats">
        <span class="modal-stat">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
          </svg>
          ${post.likes || 0}
        </span>
        <span class="modal-stat">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
          </svg>
          ${post.comments || 0}
        </span>
      </div>` : '<div></div>'}
      
      ${postUrl ? `
      <a href="${postUrl}" target="_blank" rel="noopener noreferrer" class="modal-linkedin-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        View on LinkedIn
      </a>` : ''}
    </div>
  `;

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
// NAV & PAGE ROUTING
// ═══════════════════════════════════════════════
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (page === 'insights') renderInsights();
}

function setFilter(el, cat) {
  activeFilter = cat;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderInsights();
}

function filterPosts() { renderInsights(); }

// ─── Hero tag → navigate to Insights page with category pre-filtered ───
function filterByTag(category) {
  showPage('insights');
  activeFilter = category;
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.textContent.trim() === category);
  });
  renderInsights();
}

function toggleMobile() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

// ═══════════════════════════════════════════════
// FORMS
// ═══════════════════════════════════════════════

// ─── Inline field error helpers ───────────────────────────
function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  const group = field.closest('.form-group');
  group.classList.add('has-error');
  field.classList.add('input-error');

  // Remove any existing error message for this field first
  const existing = group.querySelector('.field-error');
  if (existing) existing.remove();

  const err = document.createElement('span');
  err.className = 'field-error';
  err.setAttribute('role', 'alert');
  err.textContent = message;
  field.insertAdjacentElement('afterend', err);
}

function clearFieldErrors() {
  document.querySelectorAll('.form-group.has-error').forEach(g => {
    g.classList.remove('has-error');
  });
  document.querySelectorAll('.input-error').forEach(el => {
    el.classList.remove('input-error');
  });
  document.querySelectorAll('.field-error').forEach(el => el.remove());
}

// ─── Toast for network-level errors ───────────────────────
function showToast(message, type = 'error') {
  const existing = document.getElementById('formToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'formToast';
  toast.className = `form-toast form-toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" flex-shrink="0">
      ${type === 'error'
        ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
        : '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>'}
    </svg>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  // Trigger entrance animation
  requestAnimationFrame(() => toast.classList.add('form-toast--visible'));

  // Auto-dismiss after 5 s
  setTimeout(() => {
    toast.classList.remove('form-toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 5000);
}

// ─── Main submit function ──────────────────────────────────
async function submitForm() {
  // Clear previous inline errors
  clearFieldErrors();

  const firstName = document.getElementById('cfFirstName').value.trim();
  const lastName  = document.getElementById('cfLastName').value.trim();
  const email     = document.getElementById('cfEmail').value.trim();
  const company   = document.getElementById('cfCompany').value.trim();
  const subject   = document.getElementById('cfSubject').value.trim();
  const message   = document.getElementById('cfMessage').value.trim();

  // Per-field validation — collect all errors before returning
  let hasErrors = false;

  if (!firstName) {
    setFieldError('cfFirstName', 'Please enter your first name.');
    hasErrors = true;
  }
  if (!lastName) {
    setFieldError('cfLastName', 'Please enter your last name.');
    hasErrors = true;
  }
  if (!email) {
    setFieldError('cfEmail', 'Please enter your email address.');
    hasErrors = true;
  } else if (!/^[a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    setFieldError('cfEmail', 'Please enter a valid email address (e.g. you@company.com).');
    hasErrors = true;
  }
  if (!company) {
    setFieldError('cfCompany', 'Please provide your company or organization name.');
    hasErrors = true;
  }
  if (!subject) {
    setFieldError('cfSubject', 'Please select a subject for your message.');
    hasErrors = true;
  }
  if (!message) {
    setFieldError('cfMessage', "Don't forget to write your message.");
    hasErrors = true;
  }

  if (hasErrors) {
    // Scroll the first errored field into view
    const firstError = document.querySelector('.input-error');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Clear errors on successful input change
  ['cfFirstName','cfLastName','cfEmail','cfCompany','cfSubject','cfMessage'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      const group = el.closest('.form-group');
      group.classList.remove('has-error');
      el.classList.remove('input-error');
      const errSpan = group.querySelector('.field-error');
      if (errSpan) errSpan.remove();
    }, { once: true });
  });

  const submitBtn = document.querySelector('.form-submit');
  const originalBtnText = submitBtn.innerText;
  submitBtn.innerText = 'Sending…';
  submitBtn.disabled = true;

  try {
    const response = await fetch('https://formspree.io/f/mzdkykko', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Name: firstName + ' ' + lastName,
        Email: email,
        Company: company,
        Subject: subject,
        Message: message
      })
    });

    if (response.ok) {
      // Explicitly clear all fields so data doesn't persist on refresh
      document.getElementById('cfFirstName').value = '';
      document.getElementById('cfLastName').value  = '';
      document.getElementById('cfEmail').value     = '';
      document.getElementById('cfCompany').value   = '';
      document.getElementById('cfSubject').value   = '';
      document.getElementById('cfMessage').value   = '';

      document.getElementById('contactFormEl').style.display = 'none';
      document.getElementById('formSuccess').style.display   = 'block';
    } else {
      showToast('There was a problem submitting your form. Please try again.');
    }
  } catch (error) {
    console.error('Form submission error:', error);
    showToast('Could not send your message. Please check your connection and try again.');
  } finally {
    submitBtn.innerText = originalBtnText;
    submitBtn.disabled  = false;
  }
}

// ═══════════════════════════════════════════════
// SCROLL REVEAL
// ═══════════════════════════════════════════════
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible');
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ═══════════════════════════════════════════════
// KEYBOARD
// ═══════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', fetchGoogleSheetPosts);

// ═══════════════════════════════════════════════
// CAROUSEL LOGIC (UPDATED FOR 2 SLIDES)
// ═══════════════════════════════════════════════
let currentSlide = 0;

function moveCarousel(direction) {
  const track = document.getElementById('featuredCarouselTrack');
  if (!track) return;
  const slides = track.querySelectorAll('.carousel-slide');
  const totalSlides = slides.length;

  let visibleSlides = 2; /* Updated to 2 slides */
  if (window.innerWidth <= 768)  visibleSlides = 1;

  const maxSlide = totalSlides - visibleSlides;

  currentSlide += direction;
  if (currentSlide < 0)         currentSlide = 0;
  if (currentSlide > maxSlide)  currentSlide = maxSlide;

  const slideWidth = slides[0].offsetWidth;
  const gap        = 24;
  const moveAmount = currentSlide * (slideWidth + gap);

  track.style.transform = `translateX(-${moveAmount}px)`;
}

window.addEventListener('resize', () => {
  currentSlide = 0;
  const track = document.getElementById('featuredCarouselTrack');
  if (track) track.style.transform = 'translateX(0px)';
});
