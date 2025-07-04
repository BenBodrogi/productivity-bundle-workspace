import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// === Firebase Initialization ===
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

// === Authentication Check ===
(function checkLogin() {
  const loggedIn = localStorage.getItem('loggedIn');
  if (!loggedIn) {
    window.location.href = '../login.html';
  }
})();

const userEmail = localStorage.getItem('bundleUserEmail') || 'guest@example.com';

// === Variables ===
let projects = [];
let logs = [];

let timer = null;
let timerStart = null;
let timerPausedAt = null;
let elapsedMs = 0;
let timerRunning = false;

// DOM elements
const sidebarLinks = document.querySelectorAll('.tracker-sidebar ul li a');
const sections = document.querySelectorAll('.tracker-section');

const projectSelect = document.getElementById('projectSelect');
const newProjectInput = document.getElementById('newProjectInput');
const descriptionInput = document.getElementById('descriptionInput');
const toggleTimerBtn = document.getElementById('toggleTimerBtn');
const pauseTimerBtn = document.getElementById('pauseTimerBtn');
const elapsedTimeDisplay = document.getElementById('elapsedTime');
const logsContainer = document.getElementById('logs');
const clearLogsBtn = document.getElementById('clearLogsBtn');

const todayTotalElem = document.getElementById('todayTotal');
const weekTotalElem = document.getElementById('weekTotal');
const activeProjectsCountElem = document.getElementById('activeProjectsCount');

const startNewTimerBtn = document.getElementById('startNewTimerBtn');
const goToProjectsBtn = document.getElementById('goToProjectsBtn');
const viewReportsBtn = document.getElementById('viewReportsBtn');

// === Firestore Helpers ===

async function loadData() {
  // Load projects
  try {
    const docRef = doc(db, 'timetracker-projects', userEmail);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      projects = docSnap.data().list || [];
    } else {
      projects = [];
    }
  } catch (e) {
    console.error("Failed to load projects:", e);
    projects = [];
  }

  // Load logs
  try {
    const docRef = doc(db, 'timetracker-logs', userEmail);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      logs = docSnap.data().list || [];
    } else {
      logs = [];
    }
  } catch (e) {
    console.error("Failed to load logs:", e);
    logs = [];
  }
}

async function saveProjects() {
  try {
    await setDoc(doc(db, 'timetracker-projects', userEmail), { list: projects });
  } catch (e) {
    console.error("Failed to save projects:", e);
  }
}

async function saveLogs() {
  try {
    await setDoc(doc(db, 'timetracker-logs', userEmail), { list: logs });
  } catch (e) {
    console.error("Failed to save logs:", e);
  }
}

// === UI Helpers ===

function switchSection(sectionName) {
  sections.forEach(section => {
    if (section.id === sectionName + 'Section') {
      section.classList.add('active');
    } else {
      section.classList.remove('active');
    }
  });

  sidebarLinks.forEach(link => {
    if (link.dataset.section === sectionName) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m
    .toString()
    .padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function renderProjects() {
  projectSelect.innerHTML = '<option value="" disabled selected>Select a project</option>';
  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    projectSelect.appendChild(opt);
  });

  // Enable toggle timer if projects exist and project selected
  toggleTimerBtn.disabled = projectSelect.value === "" || timerRunning;
}

function renderLogs() {
  logsContainer.innerHTML = '';

  if (logs.length === 0) {
    logsContainer.textContent = "No time logs yet.";
    clearLogsBtn.disabled = true;
    return;
  }

  clearLogsBtn.disabled = false;

  logs.forEach((log, index) => {
    const div = document.createElement('div');
    div.className = 'log-entry';

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'log-details';

    const projectName = document.createElement('strong');
    projectName.textContent = log.project;
    detailsDiv.appendChild(projectName);

    if (log.description) {
      const desc = document.createElement('em');
      desc.textContent = log.description;
      detailsDiv.appendChild(desc);
    }

    const timeSpan = document.createElement('div');
    timeSpan.className = 'log-time';
    const startTime = new Date(log.start);
    timeSpan.textContent = `Start: ${startTime.toLocaleString()}`;
    detailsDiv.appendChild(timeSpan);

    const durationSpan = document.createElement('div');
    durationSpan.className = 'log-duration';
    durationSpan.textContent = `Duration: ${formatDuration(log.duration)}`;
    detailsDiv.appendChild(durationSpan);

    div.appendChild(detailsDiv);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'log-actions';

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.title = 'Delete log';
    delBtn.onclick = () => {
      logs.splice(index, 1);
      saveLogs();
      renderLogs();
      updateDashboardStats();
    };

    actionsDiv.appendChild(delBtn);
    div.appendChild(actionsDiv);

    logsContainer.appendChild(div);
  });
}

function updateElapsedTimeDisplay() {
  let displayMs = elapsedMs;
  if (timerRunning) {
    displayMs += Date.now() - timerStart;
  }
  elapsedTimeDisplay.textContent = formatDuration(displayMs);
}

function updateDashboardStats() {
  // Calculate today and week totals
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfWeek = new Date(startOfToday.getTime() - (now.getDay() || 7 - 1) * dayMs); // Mon start

  let todayMs = 0;
  let weekMs = 0;
  const activeProjectsSet = new Set();

  logs.forEach(log => {
    const start = new Date(log.start);
    if (start >= startOfToday) {
      todayMs += log.duration;
    }
    if (start >= startOfWeek) {
      weekMs += log.duration;
    }
    activeProjectsSet.add(log.project);
  });

  todayTotalElem.textContent = `${Math.floor(todayMs / 3600000)}h ${Math.floor((todayMs % 3600000) / 60000)}m`;
  weekTotalElem.textContent = `${Math.floor(weekMs / 3600000)}h ${Math.floor((weekMs % 3600000) / 60000)}m`;
  activeProjectsCountElem.textContent = activeProjectsSet.size;
}

function resetTimerUI() {
  elapsedMs = 0;
  timerStart = null;
  timerPausedAt = null;
  timerRunning = false;
  elapsedTimeDisplay.textContent = "00:00:00";
  toggleTimerBtn.textContent = "▶ Start Timer";
  toggleTimerBtn.disabled = projectSelect.value === "";
  pauseTimerBtn.style.display = "none";
  pauseTimerBtn.disabled = true;
  descriptionInput.value = "";
}

// === Event Handlers ===

// Sidebar navigation
sidebarLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const targetSection = link.dataset.section;
    switchSection(targetSection);
  });
});

// Project selection change enables timer start button
projectSelect.addEventListener('change', () => {
  toggleTimerBtn.disabled = projectSelect.value === "" || timerRunning;
});

// Add new project on Enter key in input
newProjectInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const newProj = newProjectInput.value.trim();
    if (newProj && !projects.includes(newProj)) {
      projects.push(newProj);
      saveProjects();
      renderProjects();
      projectSelect.value = newProj;
      toggleTimerBtn.disabled = false;
      newProjectInput.value = "";
    }
  }
});

// Toggle Timer button start/stop
toggleTimerBtn.addEventListener('click', () => {
  if (!timerRunning) {
    // Start timer
    timerStart = Date.now();
    timerRunning = true;
    toggleTimerBtn.textContent = "■ Stop Timer";
    pauseTimerBtn.style.display = "inline-block";
    pauseTimerBtn.disabled = false;
    toggleTimerBtn.disabled = false;
    newProjectInput.disabled = true;
    projectSelect.disabled = true;
    descriptionInput.disabled = false;

    timer = setInterval(updateElapsedTimeDisplay, 1000);
  } else {
    // Stop timer
    timerRunning = false;
    clearInterval(timer);

    const project = projectSelect.value;
    const description = descriptionInput.value.trim();
    const endTime = Date.now();
    const duration = endTime - timerStart + elapsedMs;

    // Save log
    logs.push({
      project,
      description,
      start: timerStart,
      duration
    });
    saveLogs();
    renderLogs();
    updateDashboardStats();

    // Reset timer UI for new session
    resetTimerUI();

    newProjectInput.disabled = false;
    projectSelect.disabled = false;
  }
});

// Pause Timer button
pauseTimerBtn.addEventListener('click', () => {
  if (timerRunning) {
    // Pause timer
    clearInterval(timer);
    timerRunning = false;
    timerPausedAt = Date.now();
    elapsedMs += timerPausedAt - timerStart;

    toggleTimerBtn.textContent = "▶ Resume Timer";
    pauseTimerBtn.textContent = "▶ Resume";
  } else {
    // Resume timer
    timerStart = Date.now();
    timerRunning = true;
    timer = setInterval(updateElapsedTimeDisplay, 1000);

    toggleTimerBtn.textContent = "■ Stop Timer";
    pauseTimerBtn.textContent = "❚❚ Pause";
  }
});

// Clear all logs button
clearLogsBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all logs?')) {
    logs = [];
    saveLogs();
    renderLogs();
    updateDashboardStats();
  }
});

// Home page quick actions
startNewTimerBtn.addEventListener('click', () => {
  switchSection('timer');
  // Reset timer UI to fresh start
  resetTimerUI();
});

goToProjectsBtn.addEventListener('click', () => {
  switchSection('projects');
});

viewReportsBtn.addEventListener('click', () => {
  switchSection('reports');
});

// === Initialization ===

async function init() {
  await loadData();
  renderProjects();
  renderLogs();
  updateDashboardStats();
  resetTimerUI();
  switchSection('home');

  // Enable toggleTimerBtn only if project selected
  toggleTimerBtn.disabled = true;
}

init();