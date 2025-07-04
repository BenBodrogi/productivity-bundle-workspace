// === Authentication Check ===
(function checkLogin() {
  const loggedIn = localStorage.getItem('loggedIn');
  if (!loggedIn) {
    window.location.href = '../login.html';
  }
})();

const userEmail = localStorage.getItem('bundleUserEmail') || 'guest@example.com';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase config and initialization
const firebaseConfig = {
  apiKey: "AIzaSyCL1TaCMcWz6nLsfQ0awCy8UEP2naSUoJ0",
  authDomain: "userinput-f3cab.firebaseapp.com",
  projectId: "userinput-f3cab",
  storageBucket: "userinput-f3cab.appspot.com",
  messagingSenderId: "1077529028817",
  appId: "1:1077529028817:web:e2cbf11a8c4c0d5fb7fdf0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let timeLogs = [];
let activeTimer = null;

// DOM elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const projectInput = document.getElementById('projectInput');
const descriptionInput = document.getElementById('descriptionInput');
const logsContainer = document.getElementById('logs');

// Ensure Firestore document exists or create it
async function ensureTimeTrackerDoc() {
  if (!userEmail) return;

  const docRef = doc(db, 'timetracker', userEmail);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    await setDoc(docRef, { logs: [] });
    timeLogs = [];
    console.log("Created new timetracker doc for", userEmail);
  } else {
    timeLogs = docSnap.data().logs || [];
    console.log("Loaded timetracker doc for", userEmail);
  }

  renderTimeLogs();
}

// Save logs to Firestore
async function saveTimeLogs() {
  if (!userEmail) return;

  try {
    const docRef = doc(db, 'timetracker', userEmail);
    await setDoc(docRef, { logs: timeLogs });
  } catch (error) {
    console.error("Failed to save time logs:", error);
  }
}

// Render logs to UI
function renderTimeLogs() {
  logsContainer.innerHTML = '';
  if (!timeLogs.length) {
    logsContainer.textContent = 'No time logs yet.';
    return;
  }

  timeLogs.forEach(log => {
    const div = document.createElement('div');
    div.className = 'log-entry';

    const start = new Date(log.startTime);
    const end = log.endTime ? new Date(log.endTime) : null;

    const durationMs = log.duration || (end ? end - start : 0);
    const durationStr = durationMs ? formatDuration(durationMs) : 'Running';

    div.innerHTML = `
      <strong>${escapeHtml(log.project)}</strong><br />
      ${log.description ? `<em>${escapeHtml(log.description)}</em><br />` : ''}
      ${start.toLocaleString()} - ${end ? end.toLocaleString() : '...'}<br />
      Duration: ${durationStr}
    `;

    logsContainer.appendChild(div);
  });
}

// Utility: format milliseconds to h m s
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  return [
    h ? h + 'h' : null,
    m ? m + 'm' : null,
    s ? s + 's' : null,
  ].filter(Boolean).join(' ');
}

// Escape HTML to prevent injection (good practice)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start timer handler
function startTimer() {
  if (activeTimer) {
    alert('Timer is already running.');
    return;
  }
  if (!projectInput.value.trim()) {
    alert('Please enter a project name.');
    return;
  }

  activeTimer = {
    project: projectInput.value.trim(),
    description: descriptionInput.value.trim(),
    startTime: new Date().toISOString(),
    endTime: null,
    duration: null,
  };

  // Disable inputs and start button, enable stop button
  projectInput.disabled = true;
  descriptionInput.disabled = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;

  renderTimeLogs();
}

// Stop timer handler
function stopTimer() {
  if (!activeTimer) {
    alert('No active timer to stop!');
    return;
  }

  activeTimer.endTime = new Date().toISOString();
  activeTimer.duration = new Date(activeTimer.endTime) - new Date(activeTimer.startTime);

  timeLogs.push(activeTimer);
  activeTimer = null;

  // Re-enable inputs and buttons accordingly
  projectInput.disabled = false;
  descriptionInput.disabled = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;

  saveTimeLogs();
  renderTimeLogs();
}

// Event listeners
startBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click', stopTimer);

// Initial load
ensureTimeTrackerDoc();