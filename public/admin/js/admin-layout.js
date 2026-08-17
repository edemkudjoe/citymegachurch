// ============================================================
// Admin layout: auth guard + sidebar navigation
// ============================================================

// Guard: must be logged in AND role === 'admin'
(function guardAdmin() {
  const user = getStoredUser();
  const token = getToken();
  if (!user || !token || user.role !== 'admin') {
    window.location.href = '/login.html';
  }
})();

const ADMIN_NAV = [
  { href: '/admin/dashboard.html', label: 'Overview', icon: '&#9632;' },
  { href: '/admin/bookings.html', label: 'Bookings', icon: '&#9776;' },
  { href: '/admin/camps.html', label: 'Camps', icon: '&#9968;' },
  { href: '/admin/content.html', label: 'Website Content', icon: '&#9998;' },
];

function renderAdminLayout() {
  const currentPath = window.location.pathname.split('/').pop();
  const user = getStoredUser();

  const navItems = ADMIN_NAV.map(item => {
    const isActive = item.href.endsWith(currentPath);
    return `
      <a href="${item.href}" class="admin-nav-link ${isActive ? 'active' : ''}">
        <span>${item.icon}</span> ${item.label}
      </a>
    `;
  }).join('');

  const shell = document.createElement('div');
  shell.className = 'admin-shell';
  shell.innerHTML = `
    <div class="admin-topbar">
      <a href="/admin/dashboard.html" class="admin-logo">
        <img src="/images/logo.png" alt="City Mega Church" />
        <span>Admin</span>
      </a>
      <button class="admin-nav-toggle" id="adminNavToggle" aria-label="Toggle menu" aria-expanded="false">&#9776;</button>
    </div>
    <aside class="admin-sidebar" id="adminSidebar">
      <a href="/admin/dashboard.html" class="admin-logo admin-logo-desktop">
        <img src="/images/logo.png" alt="City Mega Church" />
        <span>Admin</span>
      </a>
      <nav class="admin-nav">${navItems}</nav>
      <div class="admin-sidebar-footer">
        <div class="admin-user">${user ? user.full_name : ''}</div>
        <a href="/index.html" class="admin-nav-link" style="opacity:0.7;">&larr; View Site</a>
        <button class="admin-nav-link" id="adminLogoutBtn" style="width:100%; text-align:left; background:none; border:none; cursor:pointer; font-family:inherit; font-size:inherit;">Log Out</button>
      </div>
    </aside>
    <main class="admin-main" id="adminMain"></main>
  `;

  // Move any existing body content into adminMain
  const existingContent = Array.from(document.body.childNodes);
  document.body.innerHTML = '';
  document.body.appendChild(shell);
  const mainEl = document.getElementById('adminMain');
  existingContent.forEach(node => mainEl.appendChild(node));

  document.getElementById('adminLogoutBtn').addEventListener('click', () => {
    clearToken();
    window.location.href = '/index.html';
  });

  const toggle = document.getElementById('adminNavToggle');
  const sidebar = document.getElementById('adminSidebar');
  toggle.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen);
  });

  // Close the mobile menu after choosing a nav link
  sidebar.querySelectorAll('.admin-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      sidebar.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

document.addEventListener('DOMContentLoaded', renderAdminLayout);
