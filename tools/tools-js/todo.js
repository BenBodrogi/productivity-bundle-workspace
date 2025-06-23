import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Initialize Firebase
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

const uiContainer = document.getElementById('ui-container');
const themeSlider = document.getElementById('theme-toggle');
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const prioritySelect = document.getElementById('priority-select');
const dueDateInput = document.getElementById('due-date-input');
const todoList = document.getElementById('todo-list');
const filters = document.querySelectorAll('.filter-btn');

// === Authentication Check ===
(function checkLogin() {
  const loggedIn = localStorage.getItem('loggedIn');
  if (!loggedIn) {
    window.location.href = '../login.html';
  }
})();

const userEmail = localStorage.getItem('bundleUserEmail') || 'guest@example.com';
let todos = [];
let filter = 'all'; // 'all', 'active', 'completed', 'sort-date', 'recycle-bin'
let recycled = [];

// === Load & Save with Firestore ===
async function loadTodos() {
  try {
    const docRef = doc(db, 'todos', userEmail);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      todos = docSnap.data().list || [];
    } else {
      todos = [];
    }
    recycled = [];
    renderTodos();
  } catch (error) {
    console.error('Failed to load todos:', error);
  }
}

async function saveTodos() {
  try {
    await setDoc(doc(db, 'todos', userEmail), {
      list: todos
    });
  } catch (error) {
    console.error('Failed to save todos:', error);
  }
}

// === Utility ===
function isOverdue(dueDate) {
  if (!dueDate) return false;
  const today = new Date();
  const due = new Date(dueDate + 'T23:59:59');
  return due < today;
}

function priorityValue(priority) {
  return { high: 1, medium: 2, low: 3 }[priority] || 4;
}

// === Drag and Drop ===
function addDragAndDropHandlers() {
  let draggedEl = null;

  todoList.querySelectorAll('li').forEach(li => {
    li.setAttribute('draggable', true);
    li.style.cursor = 'grab';

    li.addEventListener('dragstart', (e) => {
      draggedEl = li;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setDragImage(new Image(), 0, 0);

      trashCan.classList.add('active');
    });

    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      draggedEl = null;
      trashCan.classList.remove('active');
    });

    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!draggedEl) return;
      if (draggedEl === li) return;

      const bounding = li.getBoundingClientRect();
      const offset = e.clientY - bounding.top;
      const insertBefore = offset < bounding.height / 2;

      if (insertBefore) {
        todoList.insertBefore(draggedEl, li);
      } else {
        todoList.insertBefore(draggedEl, li.nextSibling);
      }
    });
  });

  todoList.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!draggedEl) return;

    const after = getDragAfterElement(todoList, e.clientY);
    if (!after) {
      todoList.appendChild(draggedEl);
    } else {
      todoList.insertBefore(draggedEl, after);
    }
  });

  todoList.addEventListener('drop', async () => {
    if (!draggedEl) return;

    // Update todos order based on DOM
    const newOrder = Array.from(todoList.children).map(li => {
      const text = li.querySelector('.task-content span:nth-child(2)').textContent;
      return todos.find(t => t.text === text);
    }).filter(Boolean);
    todos = newOrder;
    await saveTodos();
    renderTodos();
  });

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
}

// === Trash Can Setup ===
const trashCan = document.createElement('div');
trashCan.id = 'trash-can';
trashCan.setAttribute('aria-label', 'Recycle Bin');
trashCan.setAttribute('role', 'button');
trashCan.setAttribute('tabindex', '0');
trashCan.title = 'Drag tasks here to recycle them';

document.body.appendChild(trashCan);

trashCan.addEventListener('dragover', e => {
  e.preventDefault();
  trashCan.classList.add('dragover');
});

trashCan.addEventListener('dragleave', () => {
  trashCan.classList.remove('dragover');
});

trashCan.addEventListener('drop', async e => {
  e.preventDefault();
  trashCan.classList.remove('dragover');

  const draggedLi = todoList.querySelector('.dragging');
  if (!draggedLi) return;

  const text = draggedLi.querySelector('.task-content span:nth-child(2)').textContent;
  const todoIndex = todos.findIndex(t => t.text === text);
  if (todoIndex === -1) return;

  recycled.push(todos[todoIndex]);
  todos.splice(todoIndex, 1);

  await saveTodos();
  renderTodos();
});

trashCan.addEventListener('click', () => {
  openRecycleBinView();
});

trashCan.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openRecycleBinView();
  }
});

// === Render ===
function renderTodos() {
  todoList.innerHTML = '';
  let filtered = todos;

  if (filter === 'active') {
    filtered = todos.filter(todo => !todo.completed);
  } else if (filter === 'completed') {
    filtered = todos.filter(todo => todo.completed);
  } else if (filter === 'sort-date') {
    filtered = [...todos].sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  } else if (filter === 'sort-priority') {
    filtered = [...todos].sort((a, b) =>
      priorityValue((a.priority || '').toLowerCase()) - priorityValue((b.priority || '').toLowerCase())
    );
  } else if (filter === 'recycle-bin') {
    // Do not render todos in main list if recycle bin filter active
    return;
  }

  filtered.forEach(todo => {
    const li = document.createElement('li');
    if (todo.completed) li.classList.add('completed');
    if (isOverdue(todo.dueDate) && !todo.completed) li.classList.add('overdue-task');

    li.setAttribute('role', 'listitem');
    li.setAttribute('tabindex', '0');

    const taskContent = document.createElement('div');
    taskContent.classList.add('task-content');

    const priorityBadge = document.createElement('span');
    priorityBadge.classList.add('priority-badge', todo.priority || 'medium');
    priorityBadge.textContent = (todo.priority || 'Medium').charAt(0).toUpperCase() + (todo.priority || 'medium').slice(1);

    const taskText = document.createElement('span');
    taskText.textContent = todo.text;

    const dueDateSpan = document.createElement('span');
    dueDateSpan.classList.add('due-date');
    if (todo.dueDate) {
      const dueDateObj = new Date(todo.dueDate);
      dueDateSpan.textContent = dueDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (isOverdue(todo.dueDate) && !todo.completed) {
        dueDateSpan.classList.add('overdue');
      }
    }

    taskContent.appendChild(priorityBadge);
    taskContent.appendChild(taskText);
    taskContent.appendChild(dueDateSpan);

    taskContent.addEventListener('click', async () => {
      todo.completed = !todo.completed;
      await saveTodos();
      renderTodos();
    });

    li.appendChild(taskContent);

    // Delete (Recycle) button
    const del = document.createElement('button');
    del.textContent = '×';
    del.setAttribute('aria-label', `Recycle ${todo.text}`);
    del.addEventListener('click', async e => {
      e.stopPropagation();
      recycled.push(todo);
      todos = todos.filter(t => t !== todo);
      await saveTodos();
      renderTodos();
    });
    li.appendChild(del);

    todoList.appendChild(li);
  });
  addDragAndDropHandlers();
}

// === Recycle Bin View ===
function openRecycleBinView() {
  const existing = document.getElementById('recycle-view');
  if (existing) {
    // Start closing animation
    existing.classList.remove('open');
    existing.classList.add('closing');
    // Remove after animation duration (match CSS transition duration)
    setTimeout(() => existing.remove(), 350);
    return;
  }

  const container = document.createElement('div');
  container.id = 'recycle-view';
  container.classList.add('recycle-box');  // initial hidden state (opacity 0, scale 0.9)

  // Header
  const header = document.createElement('div');
  header.classList.add('recycle-header');
  const title = document.createElement('strong');
  title.textContent = 'Recycle Bin';
  header.appendChild(title);
  container.appendChild(header);

  if (recycled.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.textContent = 'Recycle bin is empty.';
    emptyMsg.classList.add('recycle-empty');
    container.appendChild(emptyMsg);
  } else {
    recycled.forEach((todo, idx) => {
      const row = document.createElement('div');
      row.classList.add('recycle-row');

      const label = document.createElement('span');
      label.textContent = todo.text;
      label.classList.add('recycle-text');

      const recover = document.createElement('span');
      recover.textContent = 'Recover';
      recover.classList.add('recover-link');
      recover.addEventListener('click', async () => {
        todos.push(todo);
        recycled.splice(idx, 1);
        await saveTodos();
        // Close recycle bin with animation
        container.classList.remove('open');
        container.classList.add('closing');
        setTimeout(() => {
          container.remove();
          renderTodos();         // <--- Update the main todo list immediately
          openRecycleBinView();  // <--- Reopen recycle bin to update its content
        }, 350);
      });

      row.appendChild(label);
      row.appendChild(recover);
      container.appendChild(row);
    });
  }

  // Footer with Recover All
  const footer = document.createElement('div');
  footer.classList.add('recycle-footer');

  const recoverAll = document.createElement('button');
  recoverAll.textContent = 'Recover All';
  recoverAll.disabled = recycled.length === 0;
  recoverAll.classList.add('recover-all-btn');
  recoverAll.addEventListener('click', async () => {
    todos = todos.concat(recycled);
    recycled = [];
    await saveTodos();
    container.classList.remove('open');
    container.classList.add('closing');
    setTimeout(() => {
      container.remove();
      renderTodos();
    }, 350);
  });

  footer.appendChild(recoverAll);
  container.appendChild(footer);

  // Note
  const note = document.createElement('p');
  note.textContent = 'Recycle bin will empty on next refresh.';
  note.classList.add('recycle-note');
  container.appendChild(note);

  document.body.appendChild(container);

  requestAnimationFrame(() => {
    void container.offsetWidth;
    container.classList.add('open');
  });
}

// === Form Submission ===
todoForm.addEventListener('submit', async e => {
  e.preventDefault();
  const text = todoInput.value.trim();
  const priority = prioritySelect.value;
  const dueDate = dueDateInput.value;

  if (text) {
    todos.push({
      text,
      completed: false,
      priority,
      dueDate
    });
    await saveTodos();
    renderTodos();
    todoInput.value = '';
    prioritySelect.selectedIndex = 0;
    prioritySelect.classList.remove('selected-priority');
    dueDateInput.value = '';
  }
});

// === Filters ===
filters.forEach(btn => {
  btn.addEventListener('click', () => {
    filters.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    filter = btn.dataset.filter;
    renderTodos();
  });
});

// === Theme ===
function toggleTheme(isGamified) {
  document.body.classList.toggle('gamified', isGamified);
  toggleBubbles(isGamified);
  localStorage.setItem('todoTheme', isGamified ? 'gamified' : 'default');
}

const savedTheme = localStorage.getItem('todoTheme');
const isGamified = savedTheme === 'gamified';
themeSlider.checked = isGamified;
toggleTheme(isGamified);

themeSlider.addEventListener('change', e => {
  toggleTheme(e.target.checked);
});

// === Initial Load ===
loadTodos();