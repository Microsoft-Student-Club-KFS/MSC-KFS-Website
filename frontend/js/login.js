const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');
const submitBtn = document.getElementById('login-submit');

if (Session.isAuthenticated()) {
  window.location.href = 'dashboard.html';
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.add('visible');
}

function hideError() {
  errorBox.classList.remove('visible');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideError();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showError('Enter your username and password.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';

  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    Session.setSession(data.token, data.user);
    window.location.href = 'dashboard.html';
  } catch (err) {
    showError(err.message || 'Could not sign in. Try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign in';
  }
});
