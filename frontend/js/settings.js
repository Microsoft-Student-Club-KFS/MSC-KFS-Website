/**
 * Microsoft Campus Club - KFS
 * Email Settings Page JavaScript
 * File: frontend/js/settings.js
 */

requireAuth();

function initials(fullName) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function renderSidebarUser() {
  document.getElementById('sidebar-name').textContent = currentUser.full_name;
  document.getElementById('sidebar-email').textContent = currentUser.email;
  document.getElementById('sidebar-avatar').textContent = initials(currentUser.full_name);
}

// Fetch and load SMTP settings from backend
async function loadSMTPSettings() {
  const errorBox = document.getElementById('settings-error');
  errorBox.textContent = '';
  
  try {
    const config = await apiRequest('/portal/settings/smtp');
    
    document.getElementById('host').value = config.host || '';
    document.getElementById('port').value = config.port || 587;
    document.getElementById('secure').checked = config.secure === true;
    document.getElementById('user').value = config.user || '';
    document.getElementById('fromName').value = config.fromName || '';
    document.getElementById('fromEmail').value = config.fromEmail || '';
    document.getElementById('whatsappGroupLink').value = config.whatsappGroupLink || '';
    document.getElementById('platformUrl').value = config.platformUrl || '';
    
    const passHint = document.getElementById('pass-hint');
    if (config.hasPassword) {
      passHint.style.display = 'block';
      document.getElementById('pass').placeholder = '•••••••• (Enter new to change)';
    } else {
      passHint.style.display = 'none';
      document.getElementById('pass').placeholder = 'Enter SMTP password';
    }
  } catch (err) {
    errorBox.textContent = err.message || 'Failed to load SMTP settings.';
  }
}

// Document initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadIdentity();
    renderSidebarUser();

    // Check if the user is a global admin
    if (!hasGlobalRole()) {
      alert('You are not authorized to view this page.');
      window.location.href = 'dashboard.html';
      return;
    }

    // Sidebar links are static in HTML — no injection needed

    // Load initial settings
    await loadSMTPSettings();

    // Auto-sync secure checkbox and port number to avoid SSL configuration errors
    const secureCheckbox = document.getElementById('secure');
    const portInput = document.getElementById('port');

    secureCheckbox.addEventListener('change', () => {
      if (secureCheckbox.checked) {
        if (portInput.value === '587' || !portInput.value) {
          portInput.value = '465';
        }
      } else {
        if (portInput.value === '465' || !portInput.value) {
          portInput.value = '587';
        }
      }
    });

    portInput.addEventListener('input', () => {
      const port = parseInt(portInput.value, 10);
      if (port === 465) {
        secureCheckbox.checked = true;
      } else if (port === 587) {
        secureCheckbox.checked = false;
      }
    });

    // Save Settings Submit Handler
    const form = document.getElementById('smtp-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const successBox = document.getElementById('settings-success');
      const errorBox = document.getElementById('settings-error');
      const saveBtn = document.getElementById('btn-save');
      
      successBox.classList.remove('visible');
      errorBox.textContent = '';
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      
      const host = document.getElementById('host').value.trim();
      const port = parseInt(document.getElementById('port').value, 10);
      const secure = document.getElementById('secure').checked;
      const user = document.getElementById('user').value.trim();
      let pass = document.getElementById('pass').value;
      const fromName = document.getElementById('fromName').value.trim();
      const fromEmail = document.getElementById('fromEmail').value.trim();
      const whatsappGroupLink = document.getElementById('whatsappGroupLink').value.trim();
      const platformUrl = document.getElementById('platformUrl').value.trim();
      
      // If password field is empty and we had a password, keep it unchanged
      if (!pass) {
        pass = '__UNCHANGED__';
      }
      
      try {
        await apiRequest('/portal/settings/smtp', {
          method: 'POST',
          body: JSON.stringify({
            host, port, secure, user, pass, fromName, fromEmail,
            whatsappGroupLink, platformUrl
          })
        });
        
        successBox.textContent = 'Settings saved successfully!';
        successBox.classList.add('visible');
        document.getElementById('pass').value = ''; // clear field
        await loadSMTPSettings();
      } catch (err) {
        errorBox.textContent = err.message || 'Failed to save settings.';
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Settings';
      }
    });

    // Test Email Button Handler
    const testBtn = document.getElementById('btn-test');
    testBtn.addEventListener('click', async () => {
      const successBox = document.getElementById('settings-success');
      const errorBox = document.getElementById('settings-error');

      const testEmail = prompt(
        'Enter recipient email for the test message (leave blank to send to SMTP email):',
        '2hmed.gamel@gmail.com'
      );
      if (testEmail === null) {
        return; // user cancelled
      }
      
      successBox.classList.remove('visible');
      errorBox.textContent = '';
      testBtn.disabled = true;
      testBtn.textContent = 'Sending Test...';
      
      try {
        const res = await apiRequest('/portal/settings/smtp/test', {
          method: 'POST',
          body: JSON.stringify({ testEmail: testEmail.trim() || undefined })
        });
        successBox.textContent = res.message || 'Test email sent successfully!';
        successBox.classList.add('visible');
      } catch (err) {
        errorBox.textContent = err.message || 'Failed to send test email. Double check SMTP settings and credentials.';
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = 'Send Test Email';
      }
    });

  } catch (err) {
    console.error('Initialization failed', err);
  }
});

document.getElementById('theme-toggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  localStorage.setItem('mscc_theme', isDark ? 'dark' : 'light');
});

document.getElementById('logout-btn').addEventListener('click', () => {
  Session.clear();
  window.location.href = 'login.html';
});
