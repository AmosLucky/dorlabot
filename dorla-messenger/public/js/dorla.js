/* Dorla platform shared JS: sidebar, toasts, confirm dialogs, theme, preview */

document.addEventListener('DOMContentLoaded', () => {
  // Sidebar (mobile)
  const sidebar = document.getElementById('appSidebar');
  const toggle = document.getElementById('sidebarToggle');
  if (sidebar && toggle) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      let backdrop = document.querySelector('.sidebar-backdrop');
      if (sidebar.classList.contains('open')) {
        if (!backdrop) {
          backdrop = document.createElement('div');
          backdrop.className = 'sidebar-backdrop';
          backdrop.addEventListener('click', () => {
            sidebar.classList.remove('open');
            backdrop.remove();
          });
          document.body.appendChild(backdrop);
        }
      } else if (backdrop) {
        backdrop.remove();
      }
    });
  }

  // Toasts: convert flash messages into toasts
  const stack = document.getElementById('toastStack');
  document.querySelectorAll('[data-flash]').forEach((el) => {
    const type = el.dataset.flash;
    const icons = {
      success: 'bi-check-circle-fill text-success',
      error: 'bi-x-circle-fill text-danger',
      warning: 'bi-exclamation-triangle-fill text-warning',
      info: 'bi-info-circle-fill text-primary',
    };
    const toast = document.createElement('div');
    toast.className = 'dorla-toast mb-2';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `<i class="bi ${icons[type] || icons.info} fs-5"></i>
      <div class="small fw-semibold flex-grow-1">${el.textContent}</div>
      <button type="button" class="btn-close btn-close-sm ms-1" aria-label="Dismiss"></button>`;
    toast.querySelector('.btn-close').addEventListener('click', () => toast.remove());
    stack.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .4s'; setTimeout(() => toast.remove(), 400); }, 6000);
  });

  // Confirmation dialogs for destructive forms
  document.querySelectorAll('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      const message = form.dataset.confirm || 'Are you sure?';
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  });

  // Light/dark theme toggle
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    const stored = localStorage.getItem('dorla-theme');
    if (stored) document.documentElement.setAttribute('data-bs-theme', stored);
    themeBtn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-bs-theme', next);
      localStorage.setItem('dorla-theme', next);
    });
  }

  // Messenger preview live rendering (automation editors & broadcast composer)
  const previewInput = document.querySelector('[data-preview-target]');
  if (previewInput) {
    const bubble = document.querySelector(previewInput.dataset.previewTarget);
    const counter = document.querySelector('[data-char-counter]');
    const update = () => {
      if (bubble) bubble.textContent = previewInput.value.replace(/\{\{\s*first_name\s*\}\}/g, 'Alex').replace(/\{\{\s*full_name\s*\}\}/g, 'Alex Morgan').replace(/\{\{\s*page_name\s*\}\}/g, previewInput.dataset.pageName || 'Your Page').replace(/\{\{\s*business_name\s*\}\}/g, previewInput.dataset.businessName || 'Your Business').replace(/\{\{\s*custom_field:[a-zA-Z0-9_\-]+\s*\}\}/g, '…') || 'Your message preview appears here…';
      if (counter) counter.textContent = `${previewInput.value.length} / 2000`;
    };
    previewInput.addEventListener('input', update);
    update();
  }

  // Variable insertion chips
  document.querySelectorAll('[data-insert-variable]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const target = document.getElementById(chip.dataset.insertVariable) || previewInput;
      if (!target) return;
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      target.value = target.value.slice(0, start) + chip.dataset.variable + target.value.slice(end);
      target.dispatchEvent(new Event('input'));
      target.focus();
    });
  });
});
