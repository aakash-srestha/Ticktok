
/* ---- Utilities ---- */
const pad2 = n => (n < 10 ? "0" : "") + n;
const pad3 = n => String(n).padStart(3, "0");

/* ---- Age Count-Up ---- */
const ageYearsEl = document.getElementById("ageYears");
const ageDaysEl  = document.getElementById("ageDays");
const ageHoursEl = document.getElementById("ageHours");
const ageMinsEl  = document.getElementById("ageMins");
const ageSecsEl  = document.getElementById("ageSecs");
const ageStatus  = document.getElementById("ageStatus");
const dobInput   = document.getElementById("dob");
const startAgeBtn= document.getElementById("startAge");

let dobTs = null;               // ms since epoch
let rafId = null;
let nextBoundary = 0;           // perf.now() when next second updates

function updateAge(now){
  if(!dobTs){ cancelAnimationFrame(rafId); return; }
  if(now >= nextBoundary){
    const elapsedMs = Date.now() - dobTs;
    const totalSec  = Math.floor(elapsedMs / 1000);

    // Years: approximate as actual calendar years using date arithmetic
    const dobDate = new Date(dobTs);
    const nowDate = new Date();
    let years = nowDate.getFullYear() - dobDate.getFullYear();
    const anniversary = new Date(dobDate);
    anniversary.setFullYear(dobDate.getFullYear() + years);
    if (nowDate < anniversary) years -= 1;

    // Days, hours, minutes, seconds from the remainder
    const yearStart = new Date(dobDate);
    yearStart.setFullYear(dobDate.getFullYear() + years);
    const remainderMs = Date.now() - yearStart.getTime();
    const remSec = Math.floor(remainderMs / 1000);
    const days  = Math.floor(remSec / 86400);
    const hours = Math.floor((remSec % 86400) / 3600);
    const mins  = Math.floor((remSec % 3600) / 60);
    const secs  = remSec % 60;

    ageYearsEl.textContent = pad2(years);
    ageDaysEl.textContent  = pad3(days);
    ageHoursEl.textContent = pad2(hours);
    ageMinsEl.textContent  = pad2(mins);
    ageSecsEl.textContent  = pad2(secs);

    // align next update precisely at the next second
    const msPast = remainderMs % 1000;
    nextBoundary = now + (msPast || 1000);
    ageStatus.textContent = "Counting your age…";
  }
  rafId = requestAnimationFrame(updateAge);
}

function startAgeCounter(ts){
  dobTs = ts;
  nextBoundary = 0;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(updateAge);
}

startAgeBtn.addEventListener("click", () => {
  const val = dobInput.value; // "YYYY-MM-DD"
  if(!val){ alert("Please pick your date of birth."); return; }
  const ts = new Date(val + "T00:00:00").getTime(); // local midnight
  if(isNaN(ts)){ alert("Invalid DOB."); return; }
  localStorage.setItem("ticktok.dob", String(ts));
  startAgeCounter(ts);
});

// Restore DOB from storage
(function restoreDOB(){
  const saved = Number(localStorage.getItem("ticktok.dob"));
  if(saved && !isNaN(saved)){
    dobInput.valueAsDate = new Date(saved); // populates the date input
    startAgeCounter(saved);
    ageStatus.textContent = "DOB restored from storage.";
  }
})();

// Re-sync when tab becomes visible
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && dobTs){
    nextBoundary = 0;
  }
});

/* ---- Tasks ---- */
const taskTitleEl    = document.getElementById("taskTitle");
const taskDateEl     = document.getElementById("taskDate");
const taskPriorityEl = document.getElementById("taskPriority");
const addTaskBtn     = document.getElementById("addTask");
const taskListEl     = document.getElementById("taskList");

let tasks = []; // [{id,title,ts,priority,done}]

function saveTasks(){
  localStorage.setItem("ticktok.tasks", JSON.stringify(tasks));
}

function loadTasks(){
  try {
    const raw = localStorage.getItem("ticktok.tasks");
    tasks = raw ? JSON.parse(raw) : [];
  } catch {
    tasks = [];
  }
}

function formatDue(ts){
  if(!ts) return "No date";
  const d = new Date(ts);
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function renderTasks(){
  taskListEl.innerHTML = "";
  const sorted = [...tasks].sort((a,b) => {
    // High priority first, then by soonest date
    const prio = (b.priority === "high") - (a.priority === "high");
    if(prio !== 0) return prio;
    return (a.ts || 0) - (b.ts || 0);
  });

  if(sorted.length === 0){
    taskListEl.innerHTML = `<p class="muted">No tasks yet.</p>`;
    return;
  }

  for(const t of sorted){
    const el = document.createElement("div");
    el.className = "task";
    el.innerHTML = `
      <div>
        <div class="task-title">${escapeHtml(t.title)}</div>
        <div class="task-info">
          Due: ${formatDue(t.ts)}
          ${t.done ? " • Completed" : ""}
        </div>
      </div>
      <span class="badge ${t.priority === "high" ? "high" : ""}">
        ${t.priority === "high" ? "High" : "Normal"}
      </span>
      <div class="task-actions">
        <button class="btn-small" data-act="toggle" data-id="${t.id}">
          ${t.done ? "Undo" : "Done"}
        </button>
        <button class="btn-small" data-act="delete" data-id="${t.id}">Delete</button>
      </div>
    `;
    taskListEl.appendChild(el);
  }
}

// minimal escape to avoid injecting HTML via task title
function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;"
  }[c]));
}

addTaskBtn.addEventListener("click", () => {
  const title = taskTitleEl.value.trim();
  const dtVal = taskDateEl.value;     // "YYYY-MM-DDTHH:mm"
  const priority = taskPriorityEl.value || "normal";
  if(!title){ alert("Task title required."); return; }

  const ts = dtVal ? new Date(dtVal).getTime() : null;
  if(dtVal && isNaN(ts)){ alert("Invalid date/time."); return; }

  const id = cryptoRandomId();
  tasks.push({ id, title, ts, priority, done:false });
  saveTasks();
  renderTasks();

  // Clear inputs
  taskTitleEl.value = "";
  taskDateEl.value = "";
  taskPriorityEl.value = "normal";
});

taskListEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if(!btn) return;
  const act = btn.getAttribute("data-act");
  const id  = btn.getAttribute("data-id");
  const idx = tasks.findIndex(t => t.id === id);
  if(idx === -1) return;

  if(act === "toggle"){
    tasks[idx].done = !tasks[idx].done;
  } else if(act === "delete"){
    tasks.splice(idx, 1);
  }
  saveTasks();
  renderTasks();
});

function cryptoRandomId(){
  // Prefer crypto if available, else fallback
  if (window.crypto && crypto.getRandomValues) {
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    return [...buf].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return String(Date.now()) + Math.random().toString(16).slice(2);
}

// boot
loadTasks();
renderTasks();
``