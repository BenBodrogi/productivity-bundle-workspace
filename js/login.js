if (localStorage.getItem('loggedIn')) {
  window.location.href = 'tools.html';
}

const loginForm = document.getElementById('loginForm');
const formMessage = document.getElementById('formMessage');

const AIRTABLE_BASE_ID = 'appMIxbqdOZlhjHE1';
const AIRTABLE_TABLE_NAME = 'Users';
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;
const AIRTABLE_API_TOKEN = 'patGJhcWDxT2Ke0Ww.559f5f779d77b6a925c8c6dc0c01c5e1d44a1627a5c0ef4fb15f1bce87d5001a';

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formMessage.textContent = '';

  const emailInput = loginForm.email.value.trim().toLowerCase();
  if (!emailInput) {
    formMessage.textContent = 'Please enter your email address.';
    return;
  }

  try {
    const filterFormula = `SEARCH("${emailInput}", LOWER({Email Address}))`;
    const url = `${AIRTABLE_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user data from Airtable.');
    }

    const data = await response.json();

    if (data.records.length === 0) {
      formMessage.textContent = "Email not found. Please check your email or purchase the bundle.";
      return;
    }

    const userRecord = data.records[0];
    const userFields = userRecord.fields;

    // Check if password is set
    if (!userFields.Password || userFields.Password.trim() === '') {
      window.location.href = `set-password.html?email=${encodeURIComponent(emailInput)}`;
    } else {
      window.location.href = `login-password.html?email=${encodeURIComponent(emailInput)}`;
    }

  } catch (error) {
    console.error('Login error:', error);
    formMessage.textContent = 'An unexpected error occurred. Please try again later.';
  }
});