const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let currentUser = null;

function initAuth() {
  if (!window.netlifyIdentity) {
    // Local dev fallback — mock auth
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      const mockUser = localStorage.getItem("mock_user");
      if (mockUser) {
        currentUser = JSON.parse(mockUser);
        renderProfileFromNetlify(currentUser);
        hideAuthGate();
        refreshAll();
      } else {
        showAuthGate(true); // true = mock mode
      }
      return;
    }
    // On non-Netlify host without widget
    showAuthGate();
    return;
  }

  window.netlifyIdentity.on("init", user => {
    if (user) {
      currentUser = user;
      user.jwt().then(token => {
        localStorage.setItem("nf_token", token);
      });
      renderProfileFromNetlify(user);
      hideAuthGate();
      refreshAll();
    } else {
      showAuthGate();
    }
  });

  window.netlifyIdentity.on("login", () => {
    window.netlifyIdentity.close();
    location.reload();
  });

  window.netlifyIdentity.on("logout", () => {
    currentUser = null;
    localStorage.removeItem("nf_token");
    location.reload();
  });
}

function showAuthGate(mock = false) {
  if ($("#auth-gate")) return;
  const gate = document.createElement("div");
  gate.id = "auth-gate";
  if (mock) {
    gate.innerHTML = `
      <div class="auth-card">
        <div class="auth-deco" aria-hidden="true">✦ ♡ ✧</div>
        <h2 class="serif">sign in to muse <span>♡</span></h2>
        <p class="auth-sub">local dev mode — enter any email</p>
        <input type="email" id="mock-email" placeholder="you@college.edu" class="mock-input" />
        <button class="btn-label" id="mock-login">continue ♡</button>
        <p class="auth-note">mock login for local testing only</p>
      </div>`;
    document.body.append(gate);
    $("#mock-login").addEventListener("click", () => {
      const email = $("#mock-email").value.trim();
      if (!email) return;
      const user = { email, user_metadata: { full_name: email.split("@")[0] } };
      localStorage.setItem("mock_user", JSON.stringify(user));
      location.reload();
    });
  } else {
    gate.innerHTML = `
      <div class="auth-card">
        <div class="auth-deco" aria-hidden="true">✦ ♡ ✧</div>
        <h2 class="serif">sign in to muse <span>♡</span></h2>
        <p class="auth-sub">your little corner waits for you</p>
        <button class="btn-label" id="open-login">continue with email</button>
        <p class="auth-note">no account? the widget will create one ♡</p>
      </div>`;
    document.body.append(gate);
    $("#open-login").addEventListener("click", () => window.netlifyIdentity?.open("login"));
  }
}

function hideAuthGate() {
  const gate = $("#auth-gate");
  if (gate) gate.remove();
}

function renderProfileFromNetlify(user) {
  const email = user.email || "student";
  const name = user.user_metadata?.full_name || email.split("@")[0];
  state.profile.name = name;
  state.profile.email = email;
  state.profile.avatar = user.user_metadata?.avatar_url || "";
  saveAll();
  renderProfile();
}

function logout() {
  if (window.netlifyIdentity) {
    window.netlifyIdentity.logout();
  }
}

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }
};

const now = new Date();
const todayStr = () => fmtKey(now);
const fmtKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const dayShort = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

let state = {
  tasks: store.get("muse_tasks", []),
  reminders: store.get("muse_reminders", []),
  classes: store.get("muse_classes", []),
  mood: store.get("muse_mood", {}),
  journal: store.get("muse_journal", {}),
  notes: store.get("muse_notes", []),
  favs: store.get("muse_favs", []),
  profile: store.get("muse_profile", { name: "", status: "" })
};

const saveAll = () => {
  store.set("muse_tasks", state.tasks);
  store.set("muse_reminders", state.reminders);
  store.set("muse_classes", state.classes);
  store.set("muse_mood", state.mood);
  store.set("muse_journal", state.journal);
  store.set("muse_notes", state.notes);
  store.set("muse_favs", state.favs);
  store.set("muse_profile", state.profile);
};

let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

const catLabel = { study: "study", homework: "homework", life: "life", "self-care": "self-care", chores: "chores" };
const moodGlyph = { dreamy: "♡ dreamy", focused: "✦ focused", sleepy: "☾ sleepy", chaotic: "✧ chaotic", happy: "❋ happy" };

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hr = parseInt(h, 10);
  const am = hr < 12 ? "AM" : "PM";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}:${m} ${am}`;
}

function fmtDateLong(d) {
  return `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`;
}

function parseKey(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function taskCompleDates(t) {
  if (t.repeat && t.repeat.length) return t.doneDates || [];
  if (t.done && t.doneAt) return [fmtKey(new Date(t.doneAt))];
  return [];
}

function tasksForDate(date) {
  const key = fmtKey(date);
  const dow = date.getDay();
  return state.tasks.filter(t => {
    if (t.date === key) return true;
    if (t.repeat && t.repeat.length && t.repeat.includes(dow)) return true;
    return false;
  });
}

function todayTasks() {
  const key = todayStr();
  const dow = now.getDay();
  return state.tasks.filter(t => {
    if (!t.date && !(t.repeat && t.repeat.length)) return true;
    if (t.date === key) return true;
    if (t.repeat && t.repeat.length && t.repeat.includes(dow)) return true;
    return false;
  });
}

function toggleTask(t, ctxKey) {
  const key = ctxKey || todayStr();
  if (t.repeat && t.repeat.length) {
    const set = new Set(t.doneDates || []);
    if (set.has(key)) set.delete(key); else set.add(key);
    t.doneDates = Array.from(set);
  } else {
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
  }
  saveAll();
  renderAllTasks();
  updateStats();
}

function classesOn(dow) {
  return state.classes.filter(c => c.days.includes(dow)).sort((a, b) => a.time.localeCompare(b.time));
}

function initTopbar() {
  $("#topDate").textContent = fmtDateLong(now).replace(",", " ·");
  $("#greetDate").textContent = `${fmtDateLong(now)} · ${now.getFullYear()}`;
  const h = now.getHours();
  const greet = h < 5 ? "good night" : h < 12 ? "good morning" : h < 17 ? "good afternoon" : "good evening";
  $("#greetTitle").innerHTML = `${greet} <span class="heart-accent">♡</span>`;
}

function updateStats() {
  const total = state.tasks.length;
  const left = state.tasks.filter(t => !t.done).length;
  $("#statTasks").textContent = total;
  $("#statTasksSub").textContent = total ? `${left} left to finish` : "nothing planned ♡";

  const todayClasses = classesOn(now.getDay());
  $("#statClasses").textContent = todayClasses.length;
  $("#statClassesSub").textContent = todayClasses.length ? `next one at ${fmtTime(todayClasses[0].time)}` : "none today ♡";

  const doneToday = state.tasks.filter(t => {
    if (t.repeat && t.repeat.length) return (t.doneDates || []).includes(todayStr());
    return t.done && t.doneAt && fmtKey(new Date(t.doneAt)) === todayStr();
  }).length;
  $("#statDone").textContent = doneToday;
  $("#statDoneSub").textContent = doneToday ? "nice, keep going ♡" : "nothing yet ♡";

  const mood = currentMood();
  $("#moodNow").textContent = mood ? moodGlyph[mood] : "—";
  $("#moodSub").textContent = mood ? "logged today ♡" : "no mood logged yet";

  renderWeekChart();
}

function renderWeekChart() {
  const box = $("#weekBars");
  if (!box) return;
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  state.tasks.forEach(t => {
    taskCompleDates(t).forEach(k => {
      const d = parseKey(k);
      const wk = new Date(d);
      wk.setDate(d.getDate() - d.getDay());
      if (fmtKey(wk) !== fmtKey(start)) return;
      counts[d.getDay()]++;
    });
  });
  const max = Math.max(...counts, 1);
  box.innerHTML = "";
  days.forEach((label, i) => {
    const col = document.createElement("div");
    col.className = "bar-col";
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.setProperty("--h", `${Math.round((counts[i] / max) * 100)}%`);
    bar.innerHTML = `<span class="bar-fill"></span>`;
    const bLabel = document.createElement("span");
    bLabel.className = "bar-label";
    bLabel.textContent = label;
    col.append(bar, bLabel);
    box.append(col);
  });
}

function currentMood() {
  const today = state.mood[todayStr()];
  if (today) return today;
  const keys = Object.keys(state.mood);
  return keys.length ? state.mood[keys[keys.length - 1]] : null;
}

function renderNextClass() {
  const today = classesOn(now.getDay());
  if (!today.length) {
    $("#nextClassName").textContent = "nothing scheduled";
    $("#nextClassMeta").textContent = "perfect time for a nap";
    return;
  }
  const next = today.find(c => c.time >= "00:00") || today[0];
  const upcoming = today.filter(c => c.time > "00:00");
  const chosen = upcoming[0] || next;
  $("#nextClassName").textContent = chosen.name;
  $("#nextClassMeta").textContent = `${fmtTime(chosen.time)} · ${chosen.room}`;
}

function renderReminders() {
  const list = $("#reminderList");
  list.innerHTML = "";
  state.reminders.forEach(r => {
    const li = document.createElement("li");
    li.className = r.done ? "done" : "";
    const btn = document.createElement("button");
    btn.className = "rem-check";
    btn.textContent = "✓";
    btn.addEventListener("click", () => {
      r.done = !r.done;
      saveAll();
      renderReminders();
    });
    const span = document.createElement("span");
    span.textContent = r.text;
    li.append(btn, span);
    list.append(li);
  });
}

function taskItemHTML(t, ctxKey) {
  const li = document.createElement("li");
  const key = ctxKey || todayStr();
  const isDone = (t.repeat && t.repeat.length) ? (t.doneDates || []).includes(key) : !!t.done;
  li.className = isDone ? "task done" : "task";
  li.dataset.id = t.id;

  const check = document.createElement("button");
  check.className = "task-check";
  check.textContent = "✓";
  check.setAttribute("aria-label", "toggle task");
  check.addEventListener("click", () => toggleTask(t, key));

  const main = document.createElement("div");
  main.className = "task-main";
  const text = document.createElement("p");
  text.className = "task-text";
  text.textContent = t.text;
  const meta = document.createElement("div");
  meta.className = "task-meta";
  const chip = document.createElement("span");
  chip.className = `chip ${t.cat}`;
  chip.textContent = catLabel[t.cat] || t.cat;
  meta.append(chip);
  if (t.repeat && t.repeat.length) {
    const rep = document.createElement("span");
    rep.className = "chip repeat-chip";
    rep.textContent = "weekly";
    meta.append(rep);
  }
  if (t.time) {
    const time = document.createElement("span");
    time.className = "task-time";
    time.textContent = fmtTime(t.time);
    meta.append(time);
  }
  if (t.date) {
    const when = document.createElement("span");
    when.className = "task-time";
    when.textContent = t.date;
    meta.append(when);
  }
  if (t.prio > 0) {
    const prio = document.createElement("span");
    prio.className = `prio p${t.prio}`;
    prio.title = ["", "low", "medium", "high"][t.prio];
    meta.append(prio);
  }
  main.append(text, meta);

  const edit = document.createElement("button");
  edit.className = "task-edit";
  edit.textContent = "✎";
  edit.setAttribute("aria-label", "edit task");
  edit.addEventListener("click", () => openTaskEdit(t.id));

  const del = document.createElement("button");
  del.className = "task-del";
  del.textContent = "✕";
  del.setAttribute("aria-label", "delete task");
  del.addEventListener("click", () => {
    state.tasks = state.tasks.filter(x => x.id !== t.id);
    saveAll();
    renderAllTasks();
    updateStats();
  });

  li.append(check, main, edit, del);
  return li;
}

function renderDashTasks() {
  const list = $("#dashTaskList");
  list.innerHTML = "";
  const items = todayTasks();
  items.forEach(t => list.append(taskItemHTML(t, todayStr())));
  $("#todoSub").textContent = `${items.length} little thing${items.length === 1 ? "" : "s"} · ${items.filter(t => !(t.repeat && t.repeat.length ? (t.doneDates || []).includes(todayStr()) : t.done)).length} to go`;
}

function renderFullTasks() {
  const list = $("#fullTaskList");
  const filter = $("#taskFilters .filter-chip.active").dataset.filter;
  const q = $("#globalSearch").value.trim().toLowerCase();
  list.innerHTML = "";
  const today = todayTasks();
  const upcoming = state.tasks.filter(t => t.date && t.date > todayStr()).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  let pool = [...today, ...upcoming];
  if (filter === "open") pool = pool.filter(t => !(t.repeat && t.repeat.length ? (t.doneDates || []).includes(todayStr()) : t.done));
  if (filter === "done") pool = pool.filter(t => (t.repeat && t.repeat.length ? (t.doneDates || []).includes(todayStr()) : t.done));
  if (q) pool = pool.filter(t => t.text.toLowerCase().includes(q));
  const shownToday = pool.filter(t => today.includes(t));
  const shownUpcoming = pool.filter(t => upcoming.includes(t));
  $("#tasksSub").textContent = `${shownToday.length + shownUpcoming.length} shown · ${state.tasks.filter(t => !(t.repeat && t.repeat.length ? (t.doneDates || []).includes(todayStr()) : t.done)).length} open today`;

  if (!pool.length) {
    const li = document.createElement("li");
    li.className = "task";
    li.style.border = "none";
    const p = document.createElement("p");
    p.className = "hand";
    p.style.fontSize = "18px";
    p.style.color = "var(--ink-2)";
    p.textContent = q ? "nothing matches that search ♡" : "nothing here yet — add something ♡";
    li.append(p);
    list.append(li);
    return;
  }

  if (shownToday.length) {
    const label = document.createElement("li");
    label.className = "group-label";
    label.textContent = "today ♡";
    list.append(label);
    shownToday.forEach(t => list.append(taskItemHTML(t, todayStr())));
  }
  if (shownUpcoming.length) {
    const label = document.createElement("li");
    label.className = "group-label";
    label.textContent = "upcoming ♡";
    list.append(label);
    shownUpcoming.forEach(t => list.append(taskItemHTML(t, t.date)));
  }
}

function renderAllTasks() {
  renderDashTasks();
  renderFullTasks();
}

function addTask({ text, cat = "study", time = "", prio = 1, date = "", repeat = [] }) {
  state.tasks.unshift({
    id: uid(),
    text,
    cat,
    time,
    prio,
    date: date || null,
    repeat,
    done: false,
    doneAt: null,
    doneDates: []
  });
  saveAll();
  renderAllTasks();
  updateStats();
  toast("added to your little list ♡");
}

function bindDaypicks() {
  $$(".daypick").forEach(b => b.addEventListener("click", () => b.classList.toggle("on")));
}

function pickedDays(rootId) {
  return $$(`#${rootId} .daypick.on`).map(b => parseInt(b.dataset.day, 10));
}

function renderMiniCal() {
  const title = $("#miniCalTitle");
  title.innerHTML = `${monthNames[now.getMonth()]} <span>♡</span>`;
  const grid = $("#miniCalGrid");
  grid.innerHTML = "";
  const y = now.getFullYear(), m = now.getMonth();
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cell = (day, cls, label) => {
    const b = document.createElement("button");
    b.className = `cal-day ${cls}`.trim();
    b.textContent = label != null ? label : day;
    if (cls.includes("other")) b.setAttribute("tabindex", "-1");
    else {
      const date = new Date(y, m, day);
      if (classesOn(date.getDay()).length) b.classList.add("has-event");
      if (day === now.getDate()) {
        b.classList.add("today");
        b.addEventListener("click", () => selectCalDay(date));
      } else {
        b.addEventListener("click", () => selectCalDay(date));
      }
    }
    grid.append(b);
  };
  for (let i = 0; i < startDow; i++) cell(null, "other", "");
  for (let d = 1; d <= daysInMonth; d++) cell(d, "");
  $("#miniCalDate").textContent = fmtDateLong(now).replace(",", " ·");
}

function selectCalDay(date) {
  const key = fmtKey(date);
  const events = classesOn(date.getDay());
  $("#miniCalDate").textContent = `${date.getDate()} ${monthNames[date.getMonth()]} · ${events.length ? events.map(e => e.name).join(", ") : "nothing planned ♡"}`;
}

function renderFullCal() {
  let calY = fullCalYear, calM = fullCalMonth;
  $("#calMonthTitle").textContent = `${monthNames[calM]} ${calY}`;
  const grid = $("#fullCalGrid");
  grid.innerHTML = "";
  const first = new Date(calY, calM, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(calY, calM + 1, 0).getDate();
  const build = (day, cls, label) => {
    const b = document.createElement("button");
    b.className = `cal-day ${cls}`.trim();
    b.textContent = label != null ? label : day;
    b.addEventListener("click", () => {
      $$(".cal-day.selected").forEach(el => el.classList.remove("selected"));
      b.classList.add("selected");
      showDayEvents(new Date(calY, calM, day));
    });
    grid.append(b);
  };
  for (let i = 0; i < startDow; i++) build(null, "other", "");
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(calY, calM, d);
    const cls = [];
    if (classesOn(date.getDay()).length) cls.push("has-event");
    if (fmtKey(date) === todayStr()) cls.push("today");
    build(d, cls.join(" "), d);
  }
}

function showDayEvents(date) {
  const box = $("#dayEvents");
  const key = fmtKey(date);
  const classes = classesOn(date.getDay());
  const tsks = tasksForDate(date);
  if (!classes.length && !tsks.length) {
    box.innerHTML = `<p class="de-title serif">${date.getDate()} ${monthNames[date.getMonth()]} <span>♡</span></p><p class="de-empty">nothing planned — a beautiful blank page.</p>`;
    return;
  }
  const cHtml = classes.map(c => `<div class="de-item"><span>✦ ${c.name}</span><span>${fmtTime(c.time)} · ${c.room}</span></div>`).join("");
  const tItems = tsks.map(t => {
    const li = document.createElement("div");
    li.className = "de-item";
    const check = document.createElement("button");
    check.className = "rem-check";
    check.textContent = "✓";
    const isDone = (t.repeat && t.repeat.length) ? (t.doneDates || []).includes(key) : !!t.done;
    if (isDone) li.classList.add("done");
    check.addEventListener("click", () => {
      toggleTask(t, key);
      showDayEvents(date);
    });
    const name = document.createElement("span");
    name.textContent = `✎ ${t.text}`;
    const time = document.createElement("span");
    time.textContent = t.time ? fmtTime(t.time) : "";
    li.append(check, name, time);
    return li;
  });
  const tEls = document.createElement("div");
  tItems.forEach(x => tEls.append(x));
  box.innerHTML = `<p class="de-title serif">${date.getDate()} ${monthNames[date.getMonth()]} <span>♡</span></p>${cHtml}`;
  box.append(tEls);
}

let fullCalYear = now.getFullYear();
let fullCalMonth = now.getMonth();

function renderClasses() {
  const grid = $("#classesGrid");
  grid.innerHTML = "";
  if (!state.classes.length) {
    grid.innerHTML = `<p class="hand" style="font-size:18px;color:var(--ink-2)">no classes yet — add one ♡</p>`;
    return;
  }
  state.classes.forEach(c => {
    const card = document.createElement("div");
    card.className = "card class-card";
    card.style.setProperty("--cl", `var(--${c.color || "blush"})`);
    const name = document.createElement("h2");
    name.className = "class-name serif";
    name.textContent = c.name;
    const meta = document.createElement("p");
    meta.className = "class-meta";
    meta.textContent = `${fmtTime(c.time)} · ${c.room || "somewhere"}`;
    const days = document.createElement("div");
    days.className = "class-days";
    dayShort.forEach((dn, i) => {
      const s = document.createElement("span");
      s.className = c.days.includes(i) ? "class-day on" : "class-day";
      s.textContent = dn;
      days.append(s);
    });
    const edit = document.createElement("button");
    edit.className = "class-del class-edit";
    edit.textContent = "✎";
    edit.setAttribute("aria-label", "edit class");
    edit.addEventListener("click", () => openClassEdit(c.id));
    const del = document.createElement("button");
    del.className = "class-del";
    del.textContent = "✕";
    del.setAttribute("aria-label", "delete class");
    del.addEventListener("click", () => {
      state.classes = state.classes.filter(x => x.id !== c.id);
      saveAll();
      renderClasses();
      renderMiniCal();
      renderFullCal();
      renderNextClass();
      updateStats();
    });
    card.append(del, edit, name, meta, days);
    grid.append(card);
  });
}

function renderNotes() {
  const grid = $("#notesGrid");
  const q = $("#globalSearch").value.trim().toLowerCase();
  grid.innerHTML = "";
  const items = q ? state.notes.filter(n => (n.title + " " + n.text).toLowerCase().includes(q)) : state.notes;
  if (!items.length) {
    grid.innerHTML = `<p class="hand" style="font-size:18px;color:var(--ink-2)">no notes here yet ♡</p>`;
    return;
  }
  items.forEach(n => {
    const card = document.createElement("div");
    card.className = "card note-card";
    const edit = document.createElement("button");
    edit.className = "note-del note-edit";
    edit.textContent = "✎";
    edit.setAttribute("aria-label", "edit note");
    edit.addEventListener("click", () => openNoteEdit(n.id));
    const del = document.createElement("button");
    del.className = "note-del";
    del.textContent = "✕";
    del.setAttribute("aria-label", "delete note");
    del.addEventListener("click", () => {
      state.notes = state.notes.filter(x => x.id !== n.id);
      saveAll();
      renderNotes();
    });
    const title = document.createElement("h2");
    title.className = "card-title serif";
    title.textContent = n.title;
    const date = document.createElement("p");
    date.className = "note-date";
    date.textContent = n.date;
    const text = document.createElement("p");
    text.className = "note-text";
    text.textContent = n.text;
    card.append(del, edit, title, date, text);
    grid.append(card);
  });
}

function renderJournal() {
  const list = $("#journalList");
  list.innerHTML = "";
  const keys = Object.keys(state.journal).sort().reverse();
  if (!keys.length) {
    list.innerHTML = `<p class="hand" style="font-size:18px;color:var(--ink-2)">no entries yet — today could be the first ♡</p>`;
    return;
  }
  keys.forEach(k => {
    const card = document.createElement("div");
    card.className = "card journal-entry";
    const title = document.createElement("h2");
    title.className = "card-title serif";
    title.textContent = k;
    const text = document.createElement("p");
    text.className = "note-text";
    text.textContent = state.journal[k];
    card.append(title, text);
    list.append(card);
  });
}

function saveJournalEntry() {
  const ta = $("#journalEntry");
  const text = ta.value.trim();
  if (!text) { toast("nothing written yet ♡"); return; }
  state.journal[todayStr()] = text;
  saveAll();
  renderJournal();
  ta.value = "";
  toast("entry saved ♡");
}

function renderMood() {
  $$(".mood-chip").forEach(b => {
    b.classList.toggle("active", currentMood() === b.dataset.mood);
  });
  const hist = $("#moodHistory");
  hist.innerHTML = "";
  const keys = Object.keys(state.mood).sort().reverse();
  if (!keys.length) {
    hist.innerHTML = `<li class="hand" style="font-size:17px;color:var(--ink-2);border:none">no moods tracked yet ♡</li>`;
    return;
  }
  keys.forEach(k => {
    const li = document.createElement("li");
    const d = document.createElement("span");
    d.textContent = k;
    const b = document.createElement("span");
    b.className = "mood-badge";
    b.textContent = moodGlyph[state.mood[k]] || state.mood[k];
    li.append(d, b);
    hist.append(li);
  });
}

function setMood(mood) {
  state.mood[todayStr()] = mood;
  saveAll();
  renderMood();
  updateStats();
  toast(`${moodGlyph[mood]} — noted ♡`);
}

function renderFavs() {
  const list = $("#favList");
  list.innerHTML = "";
  if (!state.favs.length) {
    list.innerHTML = `<p class="hand" style="font-size:18px;color:var(--ink-2)">no favorites yet — keep the pretty things ♡</p>`;
    return;
  }
  state.favs.forEach(f => {
    const li = document.createElement("li");
    const g = document.createElement("span");
    g.className = "fav-glyph";
    g.textContent = "❋";
    const t = document.createElement("span");
    t.className = "fav-text";
    t.textContent = f.text;
    const d = document.createElement("span");
    d.className = "fav-date";
    d.textContent = f.date;
    const del = document.createElement("button");
    del.className = "task-del";
    del.textContent = "✕";
    del.setAttribute("aria-label", "delete favorite");
    del.addEventListener("click", () => {
      state.favs = state.favs.filter(x => x.id !== f.id);
      saveAll();
      renderFavs();
    });
    li.append(g, t, d, del);
    list.append(li);
  });
}

function renderDayTimeline() {
  const box = $("#dayTimeline");
  box.innerHTML = "";
  $("#daySub").textContent = `${fmtDateLong(now)} · your whole day at a glance`;
  const todayClasses = classesOn(now.getDay());
  const todayTasksArr = todayTasks().filter(t => !(t.repeat && t.repeat.length ? (t.doneDates || []).includes(todayStr()) : t.done));
  const entries = [];
  todayClasses.forEach(c => entries.push({ time: c.time, glyph: "✦", title: c.name, meta: `${fmtTime(c.time)} · ${c.room || ""}` }));
  todayTasksArr.forEach(t => entries.push({ time: t.time || "12:00", glyph: "✎", title: t.text, meta: t.time ? fmtTime(t.time) : "sometime today" }));
  entries.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  if (!entries.length) {
    box.innerHTML = `<p class="hand" style="font-size:18px;color:var(--ink-2)">a perfectly empty day. enjoy it ♡</p>`;
    return;
  }
  entries.forEach(e => {
    const item = document.createElement("div");
    item.className = "tl-item";
    const dot = document.createElement("span");
    dot.className = "tl-dot";
    dot.textContent = e.glyph;
    const time = document.createElement("span");
    time.className = "tl-time";
    time.textContent = e.time ? fmtTime(e.time) : "—";
    const body = document.createElement("div");
    body.className = "tl-body";
    const title = document.createElement("p");
    title.className = "tl-title";
    title.textContent = e.title;
    const meta = document.createElement("p");
    meta.className = "tl-meta";
    meta.textContent = e.meta;
    body.append(title, meta);
    item.append(dot, time, body);
    box.append(item);
  });
}

function switchView(name) {
  $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${name}`));
  $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === name));
  $$(".mnav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  if (name === "dashboard") {
    renderMiniCal();
    renderNextClass();
    updateStats();
  }
  if (name === "day") renderDayTimeline();
  if (name === "tasks") renderFullTasks();
  if (name === "calendar") {
    const hasToday = new Date(fullCalYear, fullCalMonth + 1, 0).getDate() >= now.getDate();
    const d = new Date(fullCalYear, fullCalMonth, hasToday ? now.getDate() : 1);
    renderFullCal();
    showDayEvents(d);
  }
  if (name === "classes") renderClasses();
  if (name === "notes") renderNotes();
  if (name === "journal") { $("#journalDate").textContent = fmtDateLong(now).replace(",", " ·"); renderJournal(); }
  if (name === "mood") renderMood();
  if (name === "favorites") renderFavs();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openModal(tab) {
  const modal = $("#modal");
  modal.classList.add("open");
  $$(".mtab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".modal-fields").forEach(f => f.hidden = f.dataset.fields !== tab);
}

function closeModal() {
  $("#modal").classList.remove("open");
  $("#modalForm").reset();
  $$("#mTaskRepeat .daypick").forEach(b => b.classList.remove("on"));
}

function renderProfile() {
  const { name = "", status = "" } = state.profile;
  $("#profileName").textContent = name;
  $("#profileStatus").textContent = status;
  $("#topAvatar").title = name;
  const initials = name.trim().split(/\s+/).filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const label = initials || "♡";
  $("#profileAvatar").textContent = label;
  $("#topAvatar").textContent = label;
}

function bindProfile() {
  $("#profileName").addEventListener("click", () => {
    const val = prompt("what's your name?", state.profile.name || "");
    if (val === null) return;
    state.profile.name = val.trim();
    saveAll();
    renderProfile();
  });
  $("#profileStatus").addEventListener("click", () => {
    const val = prompt("set a little status:", state.profile.status || "");
    if (val === null) return;
    state.profile.status = val.trim();
    saveAll();
    renderProfile();
  });
  $("#logoutBtn")?.addEventListener("click", logout);
}

let editingTaskId = null;
let editingClassId = null;
let editingNoteId = null;

function closeAllModals() {
  $("#modal").classList.remove("open");
  $("#clearModal").classList.remove("open");
  $("#editTaskModal").classList.remove("open");
  $("#editClassModal").classList.remove("open");
  $("#editNoteModal").classList.remove("open");
}

function openTaskEdit(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  editingTaskId = id;
  $("#eTaskText").value = t.text;
  $("#eTaskCat").value = t.cat || "study";
  $("#eTaskTime").value = t.time || "";
  $("#eTaskPrio").value = String(t.prio != null ? t.prio : 1);
  $("#eTaskDate").value = t.date || "";
  const rep = t.repeat || [];
  $$("#eTaskRepeat .daypick").forEach(b => b.classList.toggle("on", rep.includes(parseInt(b.dataset.day, 10))));
  $("#editTaskModal").classList.add("open");
  $("#eTaskText").focus();
}

function saveTaskEdit() {
  const t = state.tasks.find(x => x.id === editingTaskId);
  if (!t) return;
  const text = $("#eTaskText").value.trim();
  if (!text) { toast("write something first ♡"); return; }
  t.text = text;
  t.cat = $("#eTaskCat").value;
  t.time = $("#eTaskTime").value;
  t.prio = parseInt($("#eTaskPrio").value, 10);
  t.date = $("#eTaskDate").value || null;
  t.repeat = pickedDays("eTaskRepeat");
  saveAll();
  renderAllTasks();
  updateStats();
  closeAllModals();
  toast("task updated ♡");
}

function openClassEdit(id) {
  const c = state.classes.find(x => x.id === id);
  if (!c) return;
  editingClassId = id;
  $("#eClassName").value = c.name;
  $("#eClassTime").value = c.time || "";
  $("#eClassRoom").value = c.room || "";
  $$("#eClassDays .daypick").forEach(b => b.classList.toggle("on", (c.days || []).includes(parseInt(b.dataset.day, 10))));
  $("#editClassModal").classList.add("open");
  $("#eClassName").focus();
}

function saveClassEdit() {
  const c = state.classes.find(x => x.id === editingClassId);
  if (!c) return;
  const name = $("#eClassName").value.trim();
  if (!name) { toast("write something first ♡"); return; }
  const days = pickedDays("eClassDays");
  if (!days.length) { toast("pick at least one day ♡"); return; }
  c.name = name;
  c.time = $("#eClassTime").value || "10:00";
  c.room = $("#eClassRoom").value.trim() || "somewhere";
  c.days = days;
  saveAll();
  renderClasses();
  renderMiniCal();
  renderFullCal();
  renderNextClass();
  updateStats();
  closeAllModals();
  toast("class updated ♡");
}

function openNoteEdit(id) {
  const n = state.notes.find(x => x.id === id);
  if (!n) return;
  editingNoteId = id;
  $("#eNoteTitle").value = n.title;
  $("#eNoteText").value = n.text;
  $("#editNoteModal").classList.add("open");
  $("#eNoteTitle").focus();
}

function saveNoteEdit() {
  const n = state.notes.find(x => x.id === editingNoteId);
  if (!n) return;
  const text = $("#eNoteText").value.trim();
  if (!text) { toast("write something first ♡"); return; }
  n.title = $("#eNoteTitle").value.trim() || "untitled note";
  n.text = text;
  saveAll();
  renderNotes();
  closeAllModals();
  toast("note updated ♡");
}

const sectorDefaults = {
  tasks: [],
  reminders: [],
  classes: [],
  notes: [],
  favs: [],
  journal: {},
  mood: {},
  profile: { name: "", status: "" }
};

const sectorLabels = {
  tasks: "tasks",
  reminders: "reminders",
  classes: "classes",
  notes: "notes",
  journal: "journal",
  mood: "mood",
  favs: "favorites",
  profile: "profile"
};

function sectorCount(key) {
  const v = state[key];
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === "object") return Object.keys(v).length;
  return 0;
}

function renderClearSectors() {
  const box = $("#clearSectors");
  box.innerHTML = "";
  Object.keys(sectorDefaults).forEach(key => {
    const row = document.createElement("div");
    row.className = "clear-row";
    const label = document.createElement("span");
    label.className = "clear-row-label";
    label.textContent = sectorLabels[key];
    const count = document.createElement("span");
    count.className = "clear-row-count";
    count.textContent = sectorCount(key);
    label.append(count);
    const btn = document.createElement("button");
    btn.className = "clear-row-btn";
    btn.textContent = "clear";
    btn.addEventListener("click", () => {
      const n = sectorCount(key);
      const msg = n ? `clear all ${sectorLabels[key]} (${n})?` : "nothing here yet — clear anyway?";
      if (!confirm(msg)) return;
      state[key] = JSON.parse(JSON.stringify(sectorDefaults[key]));
      saveAll();
      refreshAll();
      $("#clearModal").classList.remove("open");
      toast(`cleared ${sectorLabels[key]} ♡`);
    });
    row.append(label, btn);
    box.append(row);
  });
}

function clearEverything() {
  const total = Object.keys(sectorDefaults).reduce((sum, k) => sum + sectorCount(k), 0);
  if (!confirm(`clear absolutely everything (${total} items)? this can't be undone.`)) return;
  Object.keys(sectorDefaults).forEach(key => {
    state[key] = JSON.parse(JSON.stringify(sectorDefaults[key]));
  });
  saveAll();
  refreshAll();
  $("#clearModal").classList.remove("open");
  toast("all cleared, fresh start ♡");
}

function refreshAll() {
  renderProfile();
  initTopbar();
  renderReminders();
  renderNextClass();
  renderAllTasks();
  renderMiniCal();
  renderFullCal();
  renderClasses();
  renderNotes();
  renderJournal();
  renderMood();
  renderFavs();
  renderDayTimeline();
  updateStats();
}

function bindUI() {
  $$(".nav-item").forEach(n => n.addEventListener("click", e => { e.preventDefault(); switchView(n.dataset.view); }));
  $$(".mnav-btn").forEach(b => b.addEventListener("click", () => switchView(b.dataset.view)));

  $("#globalSearch").addEventListener("input", () => {
    renderDashTasks();
    renderFullTasks();
    renderNotes();
  });

  $("#addSomethingBtn").addEventListener("click", () => openModal("task"));
  $("#notifBtn").addEventListener("click", () => toast("no new notifications, lucky you ♡"));
  $(".heart-btn").addEventListener("click", () => switchView("favorites"));
  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });

  $$(".mtab").forEach(b => b.addEventListener("click", () => {
    $$(".mtab").forEach(x => x.classList.toggle("active", x === b));
    $$(".modal-fields").forEach(f => f.hidden = f.dataset.fields !== b.dataset.tab);
  }));

  $("#modalForm").addEventListener("submit", e => {
    e.preventDefault();
    const active = $(".mtab.active").dataset.tab;
    if (active === "task") {
      const text = $("#mTaskText").value.trim();
      if (!text) return;
      addTask({
        text,
        cat: $("#mTaskCat").value,
        time: $("#mTaskTime").value,
        prio: parseInt($("#mTaskPrio").value, 10),
        date: $("#mTaskDate").value,
        repeat: pickedDays("mTaskRepeat")
      });
    } else if (active === "note") {
      const title = $("#mNoteTitle").value.trim() || "untitled note";
      const text = $("#mNoteText").value.trim();
      if (!text) { toast("write something first ♡"); return; }
      state.notes.unshift({ id: uid(), title, text, date: todayStr() });
      saveAll();
      renderNotes();
      toast("note saved ♡");
    } else {
      const text = $("#mReminderText").value.trim();
      if (!text) return;
      state.reminders.push({ id: uid(), text, done: false });
      saveAll();
      renderReminders();
      toast("reminder added ♡");
    }
    closeModal();
  });

  $("#quickAddTask").addEventListener("click", () => openModal("task"));
  $("#openTaskForm").addEventListener("click", () => $("#taskForm").classList.toggle("hidden"));
  $("#submitTask").addEventListener("click", () => {
    const text = $("#taskText").value.trim();
    if (!text) return;
    addTask({
      text,
      cat: $("#taskCat").value,
      time: $("#taskTime").value,
      prio: parseInt($("#taskPrio").value, 10),
      date: $("#taskDate").value,
      repeat: pickedDays("taskRepeat")
    });
    $("#taskText").value = "";
    $("#taskDate").value = "";
    $$("#taskRepeat .daypick").forEach(b => b.classList.remove("on"));
  });

  $$(".filter-chip").forEach(c => c.addEventListener("click", () => {
    $$(".filter-chip").forEach(x => x.classList.toggle("active", x === c));
    renderFullTasks();
  }));

  $("#calPrev").addEventListener("click", () => {
    fullCalMonth--;
    if (fullCalMonth < 0) { fullCalMonth = 11; fullCalYear--; }
    renderFullCal();
  });
  $("#calNext").addEventListener("click", () => {
    fullCalMonth++;
    if (fullCalMonth > 11) { fullCalMonth = 0; fullCalYear++; }
    renderFullCal();
  });

  $("#openClassForm").addEventListener("click", () => $("#classForm").classList.toggle("hidden"));
  $("#submitClass").addEventListener("click", () => {
    const name = $("#className").value.trim();
    if (!name) return;
    const days = Array.from($("#classDays").selectedOptions).map(o => parseInt(o.value, 10));
    if (!days.length) { toast("pick at least one day ♡"); return; }
    state.classes.push({ id: uid(), name, days, time: $("#classTime").value || "10:00", room: $("#classRoom").value.trim() || "somewhere", color: ["rose", "gold", "sage", "plum"][state.classes.length % 4] });
    saveAll();
    renderClasses();
    renderMiniCal();
    renderFullCal();
    renderNextClass();
    updateStats();
    toast("class added ♡");
    $("#className").value = "";
    $("#classRoom").value = "";
  });

  $("#openNoteForm").addEventListener("click", () => $("#noteForm").classList.toggle("hidden"));
  $("#submitNote").addEventListener("click", () => {
    const title = $("#noteTitle").value.trim() || "untitled note";
    const text = $("#noteText").value.trim();
    if (!text) { toast("write something first ♡"); return; }
    state.notes.unshift({ id: uid(), title, text, date: todayStr() });
    saveAll();
    renderNotes();
    toast("note saved ♡");
    $("#noteTitle").value = "";
    $("#noteText").value = "";
  });

  $("#saveDashJournal").addEventListener("click", () => {
    const text = $("#dashJournal").value.trim();
    if (!text) { toast("nothing written yet ♡"); return; }
    state.journal[todayStr()] = text;
    saveAll();
    renderJournal();
    toast("saved to your journal ♡");
  });

  $("#saveJournal").addEventListener("click", saveJournalEntry);

  $$("#moodRow .mood-chip").forEach(b => b.addEventListener("click", () => setMood(b.dataset.mood)));
  $$("#moodRowBig .mood-chip").forEach(b => b.addEventListener("click", () => setMood(b.dataset.mood)));

  $("#openFavForm").addEventListener("click", () => $("#favForm").classList.toggle("hidden"));
  $("#submitFav").addEventListener("click", () => {
    const text = $("#favText").value.trim();
    if (!text) return;
    state.favs.unshift({ id: uid(), text, date: todayStr() });
    saveAll();
    renderFavs();
    toast("kept ♡");
    $("#favText").value = "";
  });

  $("#clearDataBtn").addEventListener("click", () => {
    renderClearSectors();
    $("#clearModal").classList.add("open");
  });
  $("#clearModalClose").addEventListener("click", () => $("#clearModal").classList.remove("open"));
  $("#clearModal").addEventListener("click", e => { if (e.target.id === "clearModal") e.target.classList.remove("open"); });
  $("#clearEverything").addEventListener("click", clearEverything);

  $("#editTaskClose").addEventListener("click", closeAllModals);
  $("#editTaskModal").addEventListener("click", e => { if (e.target.id === "editTaskModal") closeAllModals(); });
  $("#eTaskSave").addEventListener("click", saveTaskEdit);
  $("#eTaskText").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); saveTaskEdit(); } });

  $("#editClassClose").addEventListener("click", closeAllModals);
  $("#editClassModal").addEventListener("click", e => { if (e.target.id === "editClassModal") closeAllModals(); });
  $("#eClassSave").addEventListener("click", saveClassEdit);
  $("#eClassName").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); saveClassEdit(); } });

  $("#editNoteClose").addEventListener("click", closeAllModals);
  $("#editNoteModal").addEventListener("click", e => { if (e.target.id === "editNoteModal") closeAllModals(); });
  $("#eNoteSave").addEventListener("click", saveNoteEdit);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeAllModals();
  });

  bindDaypicks();
}

function init() {
  initAuth();
  renderProfile();
  bindProfile();
  initTopbar();
  updateStats();
  renderReminders();
  renderNextClass();
  renderDashTasks();
  renderFullTasks();
  renderMiniCal();
  renderFullCal();
  renderClasses();
  renderNotes();
  renderJournal();
  renderMood();
  renderFavs();
  bindUI();
  $("#journalDate").textContent = fmtDateLong(now).replace(",", " ·");
}

init();