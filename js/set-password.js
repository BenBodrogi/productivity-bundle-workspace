const form = document.getElementById('setPasswordForm');
const formMessage = document.getElementById('formMessage');
const emailInput = form.email;

const AIRTABLE_BASE_ID = 'appMIxbqdOZlhjHE1';
const AIRTABLE_TABLE_NAME = 'Users';
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;
const AIRTABLE_API_TOKEN = 'patGJhcWDxT2Ke0Ww.559f5f779d77b6a925c8c6dc0c01c5e1d44a1627a5c0ef4fb15f1bce87d5001a';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || '';
  emailInput.value = email;
});

async function findUserRecordByEmail(email) {
  const filterFormula = `SEARCH("${email}", LOWER({Email Address}))`;
  const url = `${AIRTABLE_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) throw new Error('Failed to fetch user record.');

  const data = await response.json();
  if (data.records.length === 0) return null;

  return data.records[0];
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formMessage.textContent = '';
  formMessage.style.color = ''; // Reset color

  const email = emailInput.value.trim().toLowerCase();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;

  if (password !== confirmPassword) {
    formMessage.textContent = 'Passwords do not match.';
    formMessage.style.color = '#ef9a9a'; // Error color
    return;
  }

  if (password.length < 6) {
    formMessage.textContent = 'Password must be at least 6 characters.';
    formMessage.style.color = '#ef9a9a'; // Error color
    return;
  }

  try {
    const userRecord = await findUserRecordByEmail(email);
    if (!userRecord) {
      formMessage.textContent = 'User not found. Please check your email.';
      formMessage.style.color = '#ef9a9a';
      return;
    }

    const updateUrl = `${AIRTABLE_API_URL}/${userRecord.id}`;
    const updateData = {
      fields: {
        Password: await hashPassword(password),
      },
    };

    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!updateResponse.ok) {
      throw new Error('Failed to update password.');
    }

    formMessage.style.color = '#9f88f0'; // Success color
    formMessage.textContent = 'Password set successfully! Redirecting to login...';

    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);

  } catch (error) {
    console.error('Error setting password:', error);
    formMessage.style.color = '#ef9a9a'; // Error color
    formMessage.textContent = 'An error occurred. Please try again later.';
  }
});