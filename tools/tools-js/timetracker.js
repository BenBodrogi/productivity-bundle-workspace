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

// DOM elements
const projectSelect = document.getElementById('projectSelect');
const newProjectInput = document.getElementById('newProjectInput');
const descriptionInput = document.getElementById('descriptionInput');
const toggleTimerBtn = document.getElementById('toggleTimerBtn');
const elapsedTimeDisplay = document.getElementById('elapsedTime');
const logsContainer = document.getElementById('logs');
const clearLogsBtn = document.getElementById('clearLogsBtn');

let projects = [];
let timeLogs = [];
let activeTimer = null;
let timerInterval = null;

// Load Firestore doc for this user (timetracker)
async function loadData() {
  if (!userEmail) return;

  const docRef = doc(db, 'timetracker', userEmail);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    // Create default doc
    await setDoc(docRef, { projects: [], logs: [] });
    projects = [];
    timeLogs = [];
  } else {
    const data = docSnap.data();
    projects = data.projects || [];
    timeLogs = data.logs || [];
  }
  renderProjects();
  renderTimeLogs();
  updateToggleButtonState();
  updateClearLogsButton();
}

// Save Firestore data
async function saveData() {
  if (!userEmail) return;
  try {
    const docRef = doc(db, 'timetracker', userEmail);
    await setDoc(docRef, { projects, logs: timeLogs });
  } catch (e) {
    console.error('Error saving data:', e);
  }
}

// Render project dropdown options
function renderProjects() {
  // Clear options except the placeholder
  projectSelect.innerHTML = '<option value="" disabled selected>Select a project</option>';
  projects.forEach(proj => {
    const option = document.createElement('option');
    option.value = proj;
    option.textContent = proj;
    projectSelect.appendChild(option);
  });
}

// Add new project handler
newProjectInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const newProj = newProjectInput.value.trim();
    if (newProj && !projects.includes(newProj)) {
      projects.push(newProj);
      saveData();
      renderProjects();
      projectSelect.value = newProj;
      newProjectInput.value = '';
      updateToggleButtonState();
    }
  }
});

// Enable start button only if a project is selected and no active timer
function updateToggleButtonState() {
  toggleTimerBtn.disabled = !projectSelect.value || !!activeTimer;
}

// Start or stop timer toggle
toggleTimerBtn.addEventListener('click', () => {
  if (activeTimer) {
    stopTimer();
  } else {
    startTimer();
  }
});

// Start timer function
function startTimer() {
  if (!projectSelect.value) {
    alert('Please select a project.');
    return;
  }

  activeTimer = {
    project: projectSelect.value,
    description: descriptionInput.value.trim(),
    startTime: new Date().toISOString(),
    endTime: null,
    duration: null,
  };

  // Disable inputs while timer running
  projectSelect.disabled = true;
  newProjectInput.disabled = true;
  descriptionInput.disabled = true;
  toggleTimerBtn.textContent = '■ Stop Timer';

  // Start elapsed time display
  updateElapsedTime();
  timerInterval = setInterval(updateElapsedTime, 1000);

  renderTimeLogs();
  updateToggleButtonState();
  updateClearLogsButton();
}

// Stop timer function
function stopTimer() {
  if (!activeTimer) return;

  activeTimer.endTime = new Date().toISOString();
  activeTimer.duration = new Date(activeTimer.endTime) - new Date(activeTimer.startTime);
  timeLogs.push(activeTimer);
  activeTimer = null;

  clearInterval(timerInterval);
  elapsedTimeDisplay.textContent = '00:00:00';

  // Re-enable inputs
  projectSelect.disabled = false;
  newProjectInput.disabled = false;
  descriptionInput.disabled = false;
  toggleTimerBtn.textContent = '▶ Start Timer';

  saveData();
  renderTimeLogs();
  updateToggleButtonState();
  updateClearLogsButton();
}

// Update elapsed time display
function updateElapsedTime() {
  if (!activeTimer) return;
  const now = new Date();
  const start = new Date(activeTimer.startTime);
  const diffMs = now - start;
  elapsedTimeDisplay.textContent = formatDuration(diffMs);
}

// Format ms to HH:MM:SS
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(n => n.toString().padStart(2, '0')).join(':');
}

// Render logs with edit/delete buttons
function renderTimeLogs() {
  logsContainer.innerHTML = '';
  if (timeLogs.length === 0) {
    logsContainer.textContent = 'No time logs yet.';
    return;
  }

  timeLogs.forEach((log, i) => {
    const div = document.createElement('div');
    div.className = 'log-entry';

    const start = new Date(log.startTime);
    const end = log.endTime ? new Date(log.endTime) : null;
    const durationMs = log.duration || (end ? end - start : 0);
    const durationStr = durationMs ? formatDuration(durationMs) : 'Running';

    div.innerHTML = `
      <div class="log-details">
        <strong>${escapeHtml(log.project)}</strong>
        ${log.description ? `<em>${escapeHtml(log.description)}</em>` : ''}
        <div class="log-time">${start.toLocaleString()} - ${end ? end.toLocaleString() : '...'}</div>
        <div class="log-duration">Duration: ${durationStr}</div>
      </div>
      <div class="log-actions">
        <button title="Edit" data-index="${i}" class="edit-log-btn">✏️</button>
        <button title="Delete" data-index="${i}" class="delete-log-btn">🗑️</button>
      </div>
    `;

    logsContainer.appendChild(div);
  });

  // Attach event listeners to edit/delete buttons
  document.querySelectorAll('.edit-log-btn').forEach(btn => {
    btn.onclick = () => editLogEntry(Number(btn.dataset.index));
  });
  document.querySelectorAll('.delete-log-btn').forEach(btn => {
    btn.onclick = () => deleteLogEntry(Number(btn.dataset.index));
  });
}

// Escape HTML utility
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Edit log entry (simple prompt editing)
function editLogEntry(index) {
  const log = timeLogs[index];
  if (!log) return;

  const newProject = prompt('Edit Project Name:', log.project);
  if (newProject === null) return; // Cancelled

  const newDescription = prompt('Edit Description:', log.description || '');
  if (newDescription === null) return;

  if (newProject.trim() === '') {
    alert('Project name cannot be empty.');
    return;
  }

  log.project = newProject.trim();
  log.description = newDescription.trim();

  // Add project to list if new
  if (!projects.includes(log.project)) {
    projects.push(log.project);
  }

  saveData();
  renderProjects();
  renderTimeLogs();
}

// Delete log entry
function deleteLogEntry(index) {
  if (!confirm('Are you sure you want to delete this log?')) return;

  timeLogs.splice(index, 1);
  saveData();
  renderTimeLogs();
  updateClearLogsButton();
}

// Clear all logs button
clearLogsBtn.addEventListener('click', () => {
  if (!confirm('Are you sure you want to clear all logs?')) return;

  timeLogs = [];
  saveData();
  renderTimeLogs();
  updateClearLogsButton();
});

// Enable/disable clear logs button
function updateClearLogsButton() {
  clearLogsBtn.disabled = timeLogs.length === 0;
}

// Enable/disable start button when project changes
projectSelect.addEventListener('change', updateToggleButtonState);

// Initial load
loadData();