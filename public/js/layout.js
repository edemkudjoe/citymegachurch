// ============================================================
// Shared layout: header, footer, mobile nav, skyline divider
// ============================================================

const NAV_LINKS = [
  { href: '/index.html', label: 'Home' },
  { href: '/about.html', label: 'About' },
  { href: '/services.html', label: 'Services' },
  { href: '/ministries.html', label: 'Ministries' },
  { href: '/events.html', label: 'Events' },
  { href: '/sermons.html', label: 'Sermons' },
  { href: '/gallery.html', label: 'Gallery' },
  { href: '/contact.html', label: 'Contact' },
];

function renderHeader() {
  const user = getStoredUser();
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  const links = NAV_LINKS.map(link => {
    const isActive = link.href.endsWith(currentPath);
    return `<li><a href="${link.href}" class="${isActive ? 'active' : ''}">${link.label}</a></li>`;
  }).join('');

  const accountLink = user
    ? `<a href="/dashboard.html" class="btn btn-outline">My Account</a>`
    : `<a href="/login.html" class="btn btn-outline">Log In</a>`;

  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <nav class="nav">
      <a href="/index.html" aria-label="City Mega Church home">
        <img src="/images/logo.png" alt="City Mega Church" class="nav-logo" />
      </a>
      <ul class="nav-links" id="navLinks">${links}</ul>
      <div class="nav-actions">
        ${accountLink}
        <a href="/book-camp.html" class="btn btn-primary">Book Camp</a>
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
            <li><a href="/book-camp.html">Book Prayer Camp</a></li>
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

    const socials = document.getElementById('footerSocials');
    const socialMap = [
      { key: 'facebook_url', icon: 'f' },
      { key: 'instagram_url', icon: 'ig' },
      { key: 'twitter_url', icon: 'x' },
      { key: 'youtube_url', icon: 'yt' },
      { key: 'tiktok_url', icon: 'tt' },
    ];
    socials.innerHTML = socialMap
      .filter(s => info[s.key])
      .map(s => `<a href="${info[s.key]}" target="_blank" rel="noopener">${s.icon}</a>`)
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
