// account.js

const AIRTABLE_BASE_ID = 'appMIxbqdOZlhjHE1';
const AIRTABLE_TABLE_NAME = 'Users';
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;
const AIRTABLE_API_TOKEN = 'patGJhcWDxT2Ke0Ww.559f5f779d77b6a925c8c6dc0c01c5e1d44a1627a5c0ef4fb15f1bce87d5001a';

async function fetchUserData(email) {
  const filterFormula = `SEARCH("${email}", LOWER({Email Address}))`;
  const url = `${AIRTABLE_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

  try {
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
      throw new Error('User not found in Airtable.');
    }

    return data.records[0].fields;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function displayUserInfo() {
  const loggedIn = localStorage.getItem('loggedIn');
  if (!loggedIn) {
    window.location.href = 'login.html';
    return;
  }

  const email = localStorage.getItem('bundleUserEmail');
  if (!email) {
    window.location.href = 'login.html';
    return;
  }

  const userInfo = await fetchUserData(email);

  if (!userInfo) {
    document.getElementById('user-info').textContent = 'Failed to load user data.';
    return;
  }

  console.log(userInfo); // debug

  document.getElementById('username').textContent = userInfo['Full Name'] || 'N/A';
  document.getElementById('email').textContent = userInfo['Email Address'] || 'N/A';

  // Format purchase date
  if (userInfo['Purchase Date']) {
    const dateObj = new Date(userInfo['Purchase Date']);
    const formattedDate = dateObj.toLocaleDateString('en-CA'); // yyyy-mm-dd format
    document.getElementById('purchase-date').textContent = formattedDate;
  } else {
    document.getElementById('purchase-date').textContent = 'N/A';
  }
}

// Logout function clears localStorage and redirects to login page
function logout() {
  localStorage.clear();

  // Redirect to login
  window.location.href = 'login.html';
}

// Prevent cached pages after logout
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    // Page was loaded from cache, reload it to clear sensitive info
    window.location.reload();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  displayUserInfo();

  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn.addEventListener('click', logout);

  // Back to Tools button if you have it
  const backBtn = document.getElementById('back-to-tools');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = 'tools.html';
    });
  }
});
