if (localStorage.getItem('loggedIn')) {
  window.location.href = 'tools.html';
}

const passwordForm = document.getElementById('passwordForm');
const formMessage = document.getElementById('formMessage');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

const AIRTABLE_BASE_ID = 'appMIxbqdOZlhjHE1';
const AIRTABLE_TABLE_NAME = 'Users';
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;
const AIRTABLE_API_TOKEN = 'patGJhcWDxT2Ke0Ww.559f5f779d77b6a925c8c6dc0c01c5e1d44a1627a5c0ef4fb15f1bce87d5001a';

// Helper: SHA-256 hash function
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// On page load, prefill email from query param
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || '';
  emailInput.value = email;
});

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formMessage.textContent = '';

  const email = emailInput.value.trim().toLowerCase();
  const enteredPassword = passwordInput.value.trim();

  if (!email || !enteredPassword) {
    formMessage.textContent = 'Please enter your password.';
    return;
  }

  try {
    const filterFormula = `SEARCH("${email}", LOWER({Email Address}))`;
    const url = `${AIRTABLE_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user data.');
    }

    const data = await response.json();

    if (data.records.length === 0) {
      formMessage.textContent = 'User not found.';
      return;
    }

    const user = data.records[0];
    const storedPasswordHash = user.fields.Password?.trim();

    // Hash the entered password before comparing
    const enteredPasswordHash = await hashPassword(enteredPassword);

    if (storedPasswordHash === enteredPasswordHash) {
      localStorage.setItem('loggedIn', 'true');
      localStorage.setItem('bundleUserEmail', email);
      window.location.href = 'tools.html';
    } else {
      formMessage.textContent = 'Incorrect password. Please try again.';
    }
  } catch (error) {
    console.error('Password login error:', error);
    formMessage.textContent = 'An unexpected error occurred.';
  }
});