// ============================================================
// Shared layout: header, footer, mobile nav, skyline divider
// ============================================================

const NAV_LINKS = [
  { href: '/index.html', label: 'Home' },
  { href: '/about.html', label: 'About' },
];

const EXPLORE_LINKS = [
  { href: '/services.html', label: 'Services' },
  { href: '/ministries.html', label: 'Ministries' },
  { href: '/events.html', label: 'Events' },
  { href: '/sermons.html', label: 'Sermons' },
  { href: '/gallery.html', label: 'Gallery' },
];

function renderHeader() {
  const user = getStoredUser();
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  const primaryLinks = NAV_LINKS.map(link => {
    const isActive = link.href.endsWith(currentPath);
    return `<li><a href="${link.href}" class="${isActive ? 'active' : ''}">${link.label}</a></li>`;
  }).join('');

  const exploreActive = EXPLORE_LINKS.some(link => link.href.endsWith(currentPath));
  const exploreItems = EXPLORE_LINKS.map(link => {
    const isActive = link.href.endsWith(currentPath);
    return `<li><a href="${link.href}" class="${isActive ? 'active' : ''}">${link.label}</a></li>`;
  }).join('');

  const exploreDropdown = `
    <li class="nav-dropdown" id="exploreDropdown">
      <button type="button" class="nav-dropdown-trigger ${exploreActive ? 'active' : ''}" id="exploreTrigger" aria-expanded="false">
        Explore <span class="nav-caret">&#9662;</span>
      </button>
      <ul class="nav-dropdown-menu">${exploreItems}</ul>
    </li>
  `;

  const contactLink = `<li><a href="/contact.html" class="${'/contact.html'.endsWith(currentPath) ? 'active' : ''}">Contact</a></li>`;

  const accountLink = user
    ? `<a href="${user.role === 'admin' ? '/admin/dashboard.html' : '/dashboard.html'}" class="btn btn-outline">My Account</a>`
    : `<a href="/login.html" class="btn btn-outline">Log In</a>`;

  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <nav class="nav">
      <a href="/index.html" aria-label="City Mega Church home">
        <img src="/images/logo.png" alt="City Mega Church" class="nav-logo" />
      </a>
      <ul class="nav-links" id="navLinks">
        ${primaryLinks}${exploreDropdown}${contactLink}
        <li class="nav-mobile-actions">
          ${accountLink}
          <a href="/book-camp.html" class="btn btn-primary">Secure your Camp Spot</a>
        </li>
      </ul>
      <div class="nav-actions">
        ${accountLink}
        <a href="/book-camp.html" class="btn btn-primary">Secure your Camp Spot</a>
      </div>
      <button class="nav-toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false">&#9776;</button>
    </nav>
  `;
  document.body.prepend(header);

  document.getElementById('navToggle').addEventListener('click', () => {
    const navLinks = document.getElementById('navLinks');
    const isOpen = navLinks.classList.toggle('open');
    document.getElementById('navToggle').setAttribute('aria-expanded', isOpen);
  });

  const exploreDropdownEl = document.getElementById('exploreDropdown');
  const exploreTrigger = document.getElementById('exploreTrigger');
  exploreTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = exploreDropdownEl.classList.toggle('open');
    exploreTrigger.setAttribute('aria-expanded', isOpen);
  });
  document.addEventListener('click', (e) => {
    if (!exploreDropdownEl.contains(e.target)) {
      exploreDropdownEl.classList.remove('open');
      exploreTrigger.setAttribute('aria-expanded', 'false');
    }
  });
}
function renderFooter() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="container">
      ${skylineDividerSVG()}
      <div class="footer-grid mt-32">
        <div class="footer-col">
          <img src="/images/logo.png" alt="City Mega Church" style="height:32px; margin-bottom:16px;" />
          <p id="footerSlogan">Building Lives, Transforming Cities.</p>
        </div>
        <div class="footer-col">
          <h4>Explore</h4>
          <ul>
            <li><a href="/about.html">About Us</a></li>
            <li><a href="/services.html">Services</a></li>
            <li><a href="/events.html">Events</a></li>
            <li><a href="/sermons.html">Sermons</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Get Involved</h4>
          <ul>
            <li><a href="/book-camp.html">Secure your Camp Spot</a></li>
            <li><a href="/ministries.html">Ministries</a></li>
            <li><a href="/gallery.html">Gallery</a></li>
            <li><a href="/contact.html">Plan a Visit</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Contact</h4>
          <ul id="footerContact">
            <li>Loading...</li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; ${new Date().getFullYear()} City Mega Church. All rights reserved.</span>
        <div class="social-links" id="footerSocials"></div>
      </div>
    </div>
  `;
  document.body.appendChild(footer);

  // Populate live church info
  api('/church-info').then(info => {
    if (info.slogan) document.getElementById('footerSlogan').textContent = info.slogan;

    const contactList = document.getElementById('footerContact');
    contactList.innerHTML = `
      ${info.address ? `<li>${info.address}</li>` : ''}
      ${info.phone ? `<li><a href="tel:${info.phone}">${info.phone}</a></li>` : ''}
      ${info.email ? `<li><a href="mailto:${info.email}">${info.email}</a></li>` : ''}
    `;
    function normalizeExternalUrl(url) {
      if (!url) return url;
      return /^https?:\/\//i.test(url) ? url : `https://${url}`;
    }
    const socials = document.getElementById('footerSocials');
    const socialMap = [
      { key: 'facebook_url', label: 'Facebook', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M22 12.06C22 6.51 17.52 2 12 2S2 6.51 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34v7.03C18.34 21.21 22 17.06 22 12.06z"/></svg>' },
      { key: 'instagram_url', label: 'Instagram', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>' },
      { key: 'twitter_url', label: 'X', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>' },
      { key: 'youtube_url', label: 'YouTube', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5.5" width="20" height="13" rx="4"/><path d="M10.5 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none"/></svg>' },
      { key: 'tiktok_url', label: 'TikTok', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M14.5 3h2.6c.2 1.6 1.4 2.9 3 3.1v2.6c-1.1 0-2.2-.3-3.1-.9v6.6a4.9 4.9 0 1 1-4.9-4.9c.2 0 .4 0 .6.1v2.7a2.2 2.2 0 1 0 1.5 2.1V3z"/></svg>' },
    ];
    socials.innerHTML = socialMap
      .filter(s => info[s.key])
      .map(s => `<a href="${normalizeExternalUrl(info[s.key])}" target="_blank" rel="noopener" aria-label="${s.label}">${s.icon}</a>`)
      .join('');
  }).catch(() => { /* fail silently on footer content */ });
}

// Signature element: skyline silhouette divider, echoing the logo mark.
function skylineDividerSVG() {
  return `
    <svg class="skyline-divider" viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,32 L60,32 L60,18 L120,18 L120,32 L220,32 L220,10 L240,10 L240,4 L260,4 L260,10 L280,10 L280,32
               L380,32 L380,22 L420,22 L420,32 L520,32 L520,6 L560,6 L560,32 L680,32 L680,16 L740,16 L740,32
               L860,32 L860,24 L900,24 L900,32 L1000,32 L1000,8 L1020,8 L1020,2 L1040,2 L1040,8 L1060,8 L1060,32
               L1200,32" />
    </svg>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderFooter();
});
