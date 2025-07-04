// === Authentication Check ===
(function checkLogin() {
  const loggedIn = localStorage.getItem('loggedIn');
  if (!loggedIn) {
    window.location.href = '../login.html';
  }
})();

// User email from localStorage or fallback
const userEmail = localStorage.getItem('bundleUserEmail') || 'guest@example.com';

// Your logs array and active timer state
let timeLogs = [];
let activeTimer = null;

// ==== Firebase & Firestore Setup ====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCL1TaCMcWz6nLsfQ0awCy8UEP2naSUoJ0",
  authDomain: "userinput-f3cab.firebaseapp.com",
  projectId: "userinput-f3cab",
  storageBucket: "userinput-f3cab.appspot.com",
  messagingSenderId: "1077529028817",
  appId: "1:1077529028817:web:e2cbf11a8c4c0d5fb7fdf0"
};

// Initialize Firebase app & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === Firestore Helpers ===

// Ensures the timetracker document exists for the user
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

// Loads time logs (calls ensure if needed)
async function loadTimeLogs() {
  if (!userEmail) return;
  await ensureTimeTrackerDoc();
}

// Saves current logs array to Firestore
async function saveTimeLogs() {
  if (!userEmail) return;

  try {
    const docRef = doc(db, 'timetracker', userEmail);
    await setDoc(docRef, { logs: timeLogs });
  } catch (error) {
    console.error("Failed to save time logs:", error);
  }
}

// === Timer Control ===

// Start a new timer session
function startTimer(project, description) {
  if (activeTimer) {
    alert("Timer already running!");
    return;
  }
  activeTimer = {
    project,
    description,
    startTime: new Date().toISOString(),
    endTime: null,
    duration: null
  };
  console.log("Timer started:", activeTimer);
  // Optionally update UI here
}

// Stop the current timer session
function stopTimer() {
  if (!activeTimer) {
    alert("No active timer to stop!");
    return;
  }
  activeTimer.endTime = new Date().toISOString();
  activeTimer.duration = new Date(activeTimer.endTime) - new Date(activeTimer.startTime);
  timeLogs.push(activeTimer);
  activeTimer = null;
  saveTimeLogs();
  console.log("Timer stopped and saved");
  renderTimeLogs();
}

// Placeholder render function to show logs - you’ll build this next
function renderTimeLogs() {
  console.log("Rendering logs:", timeLogs);
  // TODO: Build UI rendering here
}

// Initialize on load
loadTimeLogs();