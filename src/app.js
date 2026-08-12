import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  activeFocusRecord,
  completeTask,
  createChapter,
  createDefaultState,
  createId,
  createModule,
  createTask,
  dateKey,
  daysBetween,
  deferTaskOneDay,
  durationText,
  findContext,
  findTaskContext,
  finishFocusRecord,
  focusSnapshot,
  getTaskContexts,
  hierarchyProgress,
  localDateTimeValue,
  normalizeState,
  pauseFocusRecord,
  resumeFocusRecord,
  runAutomaticDeferral,
  startFocusRecord,
  statisticsForRange,
  suggestedBreakType,
  todaySections
} from "./domain.js?v=1.1.1";
import {
  clearPersistedState,
  deleteTaskAttachment,
  deleteTaskAttachments,
  downloadBackup,
  loadTaskAttachment,
  loadPersistedState,
  readBackup,
  saveTaskAttachment,
  saveEmergencySnapshot,
  savePersistedState
} from "./storage.js?v=1.1.1";
import {
  BUILTIN_PLAN_VERSION,
  PLAN_PHASES,
  installBuiltinStudyPlan,
  planTasksForDate
} from "./study-plan.js?v=1.1.1";

const APP_VERSION = "1.1.1";

const appElement = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");

const tabs = [
  { id: "today", label: "今日", icon: "calendar-days" },
  { id: "board", label: "看板", icon: "layout-dashboard" },
  { id: "focus", label: "专注", icon: "timer" },
  { id: "statistics", label: "数据", icon: "chart-no-axes-column-increasing" },
  { id: "settings", label: "我的", icon: "user-round" }
];

const sessionTypes = [
  { value: "focus", label: "专注" },
  { value: "shortBreak", label: "短休息" },
  { value: "longBreak", label: "长休息" }
];

const chartColors = ["#1f5d42", "#315a7d", "#8a6a32", "#8a4b4b", "#5d6570", "#2f766d"];

let state = createDefaultState();
let saveTimer = null;
let focusTicker = null;
let deferredInstallPrompt = null;
let draggedTaskId = null;
let touchReorder = null;
let swipeGesture = null;
let dayRefreshPromise = null;

const runtime = {
  tab: "today",
  sessionType: "focus",
  focusTaskId: "",
  statisticsRange: "week",
  showArchived: false,
  modal: null,
  currentDateKey: dateKey(),
  boardPhase: "foundation"
};

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function icon(name, size = 20) {
  return `<i data-lucide="${name}" width="${size}" height="${size}" aria-hidden="true"></i>`;
}

function formatDate(value, options = { month: "short", day: "numeric" }) {
  if (!value) return "未设置";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", options).format(date);
}

function formatTime(value) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function statusLabel(status) {
  return TASK_STATUSES.find(item => item.value === status)?.label ?? "未开始";
}

function priorityLabel(priority) {
  return TASK_PRIORITIES.find(item => item.value === priority)?.label ?? "普通";
}

function sessionLabel(type) {
  return sessionTypes.find(item => item.value === type)?.label ?? "专注";
}

function taskPomodoroCount(taskId) {
  return state.pomodoroRecords.filter(record => (
    record.taskId === taskId
    && record.type === "focus"
    && record.state === "completed"
  )).length;
}

function applyAppearance() {
  const appearance = state.settings.appearance;
  document.documentElement.dataset.theme = appearance;
  const themeColor = appearance === "dark" ? "#14251d" : "#1f5d42";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => savePersistedState(state), 180);
}

async function saveNow() {
  clearTimeout(saveTimer);
  await savePersistedState(state);
}

function showToast(message, tone = "default") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  toastRoot.replaceChildren(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 200);
  }, 2_600);
}

function renderIcons() {
  window.lucide?.createIcons?.({ attrs: { "stroke-width": 1.8 } });
}

function progressBar(value, label = "") {
  const percent = Math.round(Math.min(Math.max(value || 0, 0), 1) * 100);
  return `
    <div class="progress-wrap" aria-label="${escapeHTML(label)} ${percent}%">
      <div class="progress-track"><span style="width:${percent}%"></span></div>
      <span class="progress-value">${percent}%</span>
    </div>`;
}

function emptyState(iconName, text) {
  return `<div class="empty-state">${icon(iconName, 22)}<span>${escapeHTML(text)}</span></div>`;
}

function pageHeader(title, subtitle = "", action = "") {
  return `
    <header class="page-header">
      <div>
        <h1>${escapeHTML(title)}</h1>
        ${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ""}
      </div>
      ${action}
    </header>`;
}

function renderShell() {
  const online = navigator.onLine;
  appElement.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <button class="brand" data-tab="today" aria-label="返回今日">
          <span class="brand-mark">${icon("notebook-tabs", 22)}</span>
          <span>
            <strong>北邮新传备考</strong>
            <small>${escapeHTML(state.settings.targetMajor)}</small>
          </span>
        </button>
        <div class="topbar-actions">
          <span class="connection-status ${online ? "is-online" : "is-offline"}">
            <span></span>${online ? "本地已保存" : "离线可用"}
          </span>
          <button class="icon-button desktop-only" data-action="open-install" title="安装到设备" aria-label="安装到设备">
            ${icon("download", 19)}
          </button>
        </div>
      </header>
      <main class="main-content" id="main-content">${renderActivePage()}</main>
      <nav class="tabbar" aria-label="主导航">
        ${tabs.map(tab => `
          <button class="tab-button ${runtime.tab === tab.id ? "is-active" : ""}" data-tab="${tab.id}" aria-current="${runtime.tab === tab.id ? "page" : "false"}">
            ${icon(tab.icon, 21)}<span>${tab.label}</span>
          </button>`).join("")}
      </nav>
    </div>`;
  renderIcons();
  updateFocusDisplay();
}

function renderActivePage() {
  switch (runtime.tab) {
  case "board": return renderBoardPage();
  case "focus": return renderFocusPage();
  case "statistics": return renderStatisticsPage();
  case "settings": return renderSettingsPage();
  default: return renderTodayPage();
  }
}

function renderCountdown() {
  const examDate = new Date(`${state.settings.examDate}T00:00:00`);
  const remaining = daysBetween(new Date(), examDate);
  const dayText = remaining >= 0 ? remaining : Math.abs(remaining);
  const suffix = remaining >= 0 ? "天" : "天前已结束";
  return `
    <section class="countdown-band">
      <div class="countdown-copy">
        <span class="eyebrow">${escapeHTML(state.settings.targetSchool)}</span>
        <h2>${escapeHTML(state.settings.examName)}</h2>
        <p>${formatDate(examDate, { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</p>
      </div>
      <div class="countdown-number" aria-label="距离考试 ${dayText} ${suffix}">
        <strong>${dayText}</strong><span>${suffix}</span>
      </div>
    </section>`;
}

function renderTaskContextRow(context, style = "todo") {
  const { task, subject, chapter } = context;
  const dueText = task.dueAt ? formatTime(task.dueAt) : "";
  const completedPomodoros = taskPomodoroCount(task.id);
  const pomodoroText = task.planKey ? ` · ${completedPomodoros}/${task.pomodoroTarget ?? 4} 番茄` : "";
  const dateText = style === "backlog" && task.planDate ? ` · ${formatDate(task.planDate)}` : "";
  return `
    <article class="task-row" draggable="${style === "todo"}" data-task-id="${task.id}">
      ${style === "todo" ? `<button type="button" class="drag-handle" title="拖动排序" aria-label="拖动 ${escapeHTML(task.title)} 调整顺序">${icon("grip-vertical", 18)}</button>` : ""}
      ${style === "timeline" ? `<time class="timeline-time">${formatTime(task.scheduledAt)}</time>` : ""}
      <div class="task-main">
        <div class="task-title-line">
          <strong>${escapeHTML(task.title || "未命名任务")}</strong>
          <span class="priority priority-${task.priority}">${priorityLabel(task.priority)}</span>
        </div>
        <p>${escapeHTML(subject.name)} · ${escapeHTML(chapter.name)}${dueText && !["timeline", "backlog"].includes(style) ? ` · ${dueText}` : ""}${dateText}${pomodoroText}</p>
      </div>
      <div class="row-actions">
        <button class="icon-button" data-action="open-materials" data-task-id="${task.id}" title="资料与笔记" aria-label="打开 ${escapeHTML(task.title)} 的资料与笔记">
          ${icon("paperclip", 17)}
        </button>
        <button class="icon-button success" data-action="complete-task" data-task-id="${task.id}" title="完成" aria-label="完成 ${escapeHTML(task.title)}">
          ${icon("check", 18)}
        </button>
        ${style === "todo" ? `
          <button class="icon-button" data-action="move-task-up" data-task-id="${task.id}" title="上移" aria-label="上移 ${escapeHTML(task.title)}">${icon("arrow-up", 17)}</button>
          <button class="icon-button" data-action="move-task-down" data-task-id="${task.id}" title="下移" aria-label="下移 ${escapeHTML(task.title)}">${icon("arrow-down", 17)}</button>
          <button class="icon-button warning" data-action="defer-task" data-task-id="${task.id}" title="延后一天" aria-label="延后 ${escapeHTML(task.title)}">${icon("calendar-plus", 18)}</button>` : ""}
      </div>
    </article>`;
}

function renderTodayPage() {
  const now = new Date();
  const key = dateKey(now);
  const note = state.dailyNotes[key] ?? { goal: "", content: "", reflection: "" };
  const sections = todaySections(state, now);
  const plannedTasks = planTasksForDate(state, now);
  const completedPlannedTasks = plannedTasks.filter(({ task }) => task.status === "completed").length;
  const completedPomodoros = plannedTasks.reduce((sum, { task }) => sum + Math.min(taskPomodoroCount(task.id), task.pomodoroTarget ?? 4), 0);
  const todayFocusSeconds = state.pomodoroRecords
    .filter(record => record.type === "focus"
      && ["completed", "endedEarly"].includes(record.state)
      && dateKey(new Date(record.endedAt ?? record.startedAt)) === key)
    .reduce((sum, record) => sum + record.focusedSeconds, 0);
  const targetSeconds = Math.max(state.settings.dailyGoalMinutes, 1) * 60;

  return `
    <div class="page today-page">
      ${pageHeader("今日", formatDate(now, { month: "long", day: "numeric", weekday: "long" }))}
      ${renderCountdown()}

      <section class="daily-plan-band">
        <div>
          <span>今日固定计划</span>
          <strong>8 小时 · 四科各 2 小时</strong>
        </div>
        <div class="daily-plan-metrics">
          <span><strong>${completedPlannedTasks}/4</strong> 学习块</span>
          <span><strong>${completedPomodoros}/16</strong> 番茄</span>
        </div>
      </section>

      <section class="section-block goal-section">
        <div class="section-heading">
          <div><span class="section-icon">${icon("target", 19)}</span><h2>今日目标</h2></div>
          <span>${durationText(todayFocusSeconds)} / ${state.settings.dailyGoalMinutes} 分钟有效专注</span>
        </div>
        <textarea id="daily-goal" class="goal-input" rows="2" maxlength="180" placeholder="写下今天最重要的学习目标">${escapeHTML(note.goal)}</textarea>
        ${progressBar(todayFocusSeconds / targetSeconds, "今日学习目标")}
      </section>

      <section class="section-block">
        <div class="section-heading"><div><span class="section-icon">${icon("clock-3", 19)}</span><h2>时间轴</h2></div><span>${sections.timeline.length} 项</span></div>
        <div class="task-list">
          ${sections.timeline.length ? sections.timeline.map(item => renderTaskContextRow(item, "timeline")).join("") : emptyState("calendar", "今天没有已安排的日程")}
        </div>
      </section>

      <section class="section-block">
        <div class="section-heading"><div><span class="section-icon">${icon("list-checks", 19)}</span><h2>待办清单</h2></div><span>${sections.todo.length} 项</span></div>
        <div class="task-list" id="today-todo-list">
          ${sections.todo.length ? sections.todo.map(item => renderTaskContextRow(item, "todo")).join("") : emptyState("check-check", "今天没有到期待办")}
        </div>
      </section>

      <section class="section-block review-section">
        <div class="section-heading"><div><span class="section-icon amber">${icon("book-open-check", 19)}</span><h2>复习任务</h2></div><span>${sections.reviews.length} 项</span></div>
        <div class="task-list">
          ${sections.reviews.length ? sections.reviews.map(item => renderTaskContextRow(item, "review")).join("") : emptyState("book-open", "今天没有待复习任务")}
        </div>
      </section>

      ${sections.backlog.length ? `
        <section class="section-block backlog-section">
          <div class="section-heading"><div><span class="section-icon red">${icon("history", 19)}</span><h2>计划积压</h2></div><span>${sections.backlog.length} 项</span></div>
          <div class="task-list">
            ${sections.backlog.slice(0, 12).map(item => renderTaskContextRow(item, "backlog")).join("")}
          </div>
          ${sections.backlog.length > 12 ? `<p class="backlog-more">另有 ${sections.backlog.length - 12} 项，请在看板按阶段处理。</p>` : ""}
        </section>` : ""}

      <button class="primary-command quick-focus" data-action="quick-focus">
        ${icon("play", 19)}<span>开始专注</span>
      </button>
    </div>`;
}

function renderBoardTask(context) {
  const { task, subject, module, chapter } = context;
  const materialCount = (task.attachments?.length ?? 0) + (task.resourceLinks?.length ?? 0);
  return `
    <article class="board-task ${task.status === "completed" ? "is-completed" : ""}">
      <button class="task-check" data-action="toggle-task-complete" data-task-id="${task.id}" title="${task.status === "completed" ? "重新打开" : "完成"}" aria-label="${task.status === "completed" ? "重新打开" : "完成"} ${escapeHTML(task.title)}">
        ${icon(task.status === "completed" ? "circle-check-big" : "circle", 20)}
      </button>
      <div class="task-main">
        <div class="task-title-line">
          <strong>${escapeHTML(task.title || "未命名任务")}</strong>
          ${task.isReview ? `<span class="review-badge">复习 ${task.reviewStage}/5</span>` : ""}
        </div>
        <p>${statusLabel(task.status)} · ${priorityLabel(task.priority)} · ${task.planKey ? `${taskPomodoroCount(task.id)}/${task.pomodoroTarget ?? 4} 番茄` : `预计 ${task.estimatedMinutes} 分钟`}${task.dueAt ? ` · ${formatDate(task.dueAt)}` : ""}</p>
        ${task.tags?.length ? `<div class="tag-line">${task.tags.map(tagId => {
          const tag = state.tags.find(item => item.id === tagId);
          return tag ? `<span style="--tag-color:${escapeHTML(tag.color)}">${escapeHTML(tag.name)}</span>` : "";
        }).join("")}</div>` : ""}
      </div>
      <div class="row-actions">
        <button class="icon-button" data-action="open-materials" data-task-id="${task.id}" title="资料与笔记" aria-label="打开 ${escapeHTML(task.title)} 的资料与笔记">${icon(materialCount ? "folder-open" : "paperclip", 17)}</button>
        <button class="icon-button" data-action="edit-task" data-subject-id="${subject.id}" data-module-id="${module.id}" data-chapter-id="${chapter.id}" data-task-id="${task.id}" title="编辑任务" aria-label="编辑 ${escapeHTML(task.title)}">${icon("pencil", 17)}</button>
        <button class="icon-button danger" data-action="delete-task" data-subject-id="${subject.id}" data-module-id="${module.id}" data-chapter-id="${chapter.id}" data-task-id="${task.id}" title="删除任务" aria-label="删除 ${escapeHTML(task.title)}">${icon("trash-2", 17)}</button>
      </div>
    </article>`;
}

function renderChapter(subject, module, chapter) {
  const visibleTasks = (chapter.tasks ?? [])
    .filter(task => runtime.showArchived || !task.archived)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const progress = hierarchyProgress(chapter);
  return `
    <details class="hierarchy chapter-level" ${chapter.planKey ? "" : "open"}>
      <summary>
        <div class="summary-main">
          <span class="disclosure">${icon("chevron-right", 17)}</span>
          <span><strong>${escapeHTML(chapter.name)}</strong><small>${progress.completed}/${progress.total} 项</small></span>
        </div>
        <div class="summary-actions" onclick="event.preventDefault()">
          <button class="icon-button" data-action="add-task" data-subject-id="${subject.id}" data-module-id="${module.id}" data-chapter-id="${chapter.id}" title="新增任务" aria-label="在 ${escapeHTML(chapter.name)} 新增任务">${icon("plus", 17)}</button>
          <button class="icon-button" data-action="edit-chapter" data-subject-id="${subject.id}" data-module-id="${module.id}" data-chapter-id="${chapter.id}" title="编辑章节" aria-label="编辑 ${escapeHTML(chapter.name)}">${icon("pencil", 16)}</button>
          <button class="icon-button danger" data-action="delete-chapter" data-subject-id="${subject.id}" data-module-id="${module.id}" data-chapter-id="${chapter.id}" title="删除章节" aria-label="删除 ${escapeHTML(chapter.name)}">${icon("trash-2", 16)}</button>
        </div>
      </summary>
      <div class="hierarchy-children task-children">
        ${visibleTasks.length
          ? visibleTasks.map(task => renderBoardTask({ subject, module, chapter, task })).join("")
          : emptyState("file-check-2", "本章节还没有任务")}
      </div>
    </details>`;
}

function renderModule(subject, module) {
  const visibleChapters = (module.chapters ?? [])
    .filter(chapter => runtime.showArchived || !chapter.archived)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const progress = hierarchyProgress(module);
  return `
    <details class="hierarchy module-level" ${module.planKey ? "" : "open"}>
      <summary>
        <div class="summary-main">
          <span class="disclosure">${icon("chevron-right", 18)}</span>
          <span><strong>${escapeHTML(module.name)}</strong><small>${Math.round(progress.value * 100)}% · ${progress.total} 项任务</small></span>
        </div>
        <div class="summary-actions" onclick="event.preventDefault()">
          <button class="icon-button" data-action="add-chapter" data-subject-id="${subject.id}" data-module-id="${module.id}" title="新增章节" aria-label="在 ${escapeHTML(module.name)} 新增章节">${icon("plus", 17)}</button>
          <button class="icon-button" data-action="edit-module" data-subject-id="${subject.id}" data-module-id="${module.id}" title="编辑模块" aria-label="编辑 ${escapeHTML(module.name)}">${icon("pencil", 16)}</button>
          <button class="icon-button danger" data-action="delete-module" data-subject-id="${subject.id}" data-module-id="${module.id}" title="删除模块" aria-label="删除 ${escapeHTML(module.name)}">${icon("trash-2", 16)}</button>
        </div>
      </summary>
      <div class="hierarchy-children">
        ${visibleChapters.length
          ? visibleChapters.map(chapter => renderChapter(subject, module, chapter)).join("")
          : emptyState("book-copy", "本模块还没有章节")}
      </div>
    </details>`;
}

function renderSubject(subject) {
  const visibleModules = (subject.modules ?? [])
    .filter(module => (runtime.showArchived || !module.archived)
      && (runtime.boardPhase === "all" || !module.planKey || module.planKey.endsWith(`:${runtime.boardPhase}`)))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const progress = hierarchyProgress(subject);
  return `
    <section class="subject-section" style="--subject-color:${escapeHTML(subject.color)}">
      <header class="subject-header">
        <div class="subject-identity">
          <span class="subject-swatch"></span>
          <div><h2>${escapeHTML(subject.name)}</h2><p>${progress.completed}/${progress.total} 项完成</p></div>
        </div>
        <div class="subject-controls">
          <div class="subject-progress">${progressBar(progress.value, subject.name)}</div>
          <button class="icon-button" data-action="add-module" data-subject-id="${subject.id}" title="新增模块" aria-label="在 ${escapeHTML(subject.name)} 新增模块">${icon("folder-plus", 17)}</button>
          <button class="icon-button" data-action="edit-subject" data-subject-id="${subject.id}" title="编辑科目" aria-label="编辑 ${escapeHTML(subject.name)}">${icon("pencil", 17)}</button>
          <button class="icon-button danger" data-action="delete-subject" data-subject-id="${subject.id}" title="删除科目" aria-label="删除 ${escapeHTML(subject.name)}">${icon("trash-2", 17)}</button>
        </div>
      </header>
      <div class="subject-content">
        ${visibleModules.length
          ? visibleModules.map(module => renderModule(subject, module)).join("")
          : emptyState("folders", "这个科目还没有模块")}
      </div>
    </section>`;
}

function renderBoardPage() {
  const visibleSubjects = state.subjects
    .filter(subject => runtime.showArchived || !subject.archived)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const overall = hierarchyProgress({ modules: state.subjects });
  const currentPhase = state.planning?.phaseSchedule?.find(phase => (
    dateKey() >= phase.startDate && dateKey() <= phase.endDate
  ));
  return `
    <div class="page board-page">
      ${pageHeader("看板", `${overall.completed}/${overall.total} 项任务完成`, `
        <div class="header-actions">
          <button class="secondary-command" data-action="manage-tags">${icon("tags", 17)}<span>标签</span></button>
          <button class="primary-command compact" data-action="add-subject">${icon("plus", 18)}<span>科目</span></button>
        </div>`)}
      <section class="board-overview">
        <div><span>总进度</span><strong>${Math.round(overall.value * 100)}%</strong></div>
        <div class="overview-progress">${progressBar(overall.value, "备考总进度")}</div>
        <label class="inline-toggle"><input type="checkbox" id="show-archived" ${runtime.showArchived ? "checked" : ""}><span>显示归档</span></label>
      </section>
      ${currentPhase ? `
        <section class="plan-overview-strip">
          <div><span>当前阶段</span><strong>${escapeHTML(currentPhase.name)}</strong></div>
          <p>${escapeHTML(currentPhase.objective)}</p>
          <span>${formatDate(currentPhase.startDate)} - ${formatDate(currentPhase.endDate)}</span>
        </section>` : ""}
      <div class="segmented-control phase-filter" role="tablist" aria-label="规划阶段">
        <button data-action="board-phase" data-phase="all" class="${runtime.boardPhase === "all" ? "is-selected" : ""}">全部</button>
        ${PLAN_PHASES.map(phase => `<button data-action="board-phase" data-phase="${phase.key}" class="${runtime.boardPhase === phase.key ? "is-selected" : ""}">${phase.name.replace(/阶段[一二三四五]·/, "")}</button>`).join("")}
      </div>
      <div class="subject-list">
        ${visibleSubjects.length ? visibleSubjects.map(renderSubject).join("") : emptyState("layout-list", "还没有科目")}
      </div>
    </div>`;
}

function renderFocusPage() {
  const record = activeFocusRecord(state);
  const snapshot = record ? focusSnapshot(record) : null;
  const type = record?.type ?? runtime.sessionType;
  const today = dateKey();
  const durations = {
    focus: state.settings.focusMinutes * 60,
    shortBreak: state.settings.shortBreakMinutes * 60,
    longBreak: state.settings.longBreakMinutes * 60
  };
  const remaining = snapshot?.remainingSeconds ?? durations[type];
  const progress = snapshot?.progress ?? 0;
  const availableTasks = getTaskContexts(state)
    .filter(({ task }) => task.status !== "completed" && (!task.planDate || task.planDate <= today))
    .sort((a, b) => {
      const dateComparison = String(b.task.planDate ?? today).localeCompare(String(a.task.planDate ?? today));
      return dateComparison || new Date(a.task.scheduledAt ?? a.task.dueAt ?? 0) - new Date(b.task.scheduledAt ?? b.task.dueAt ?? 0);
    });
  const selectedTaskId = availableTasks.some(({ task }) => task.id === runtime.focusTaskId)
    ? runtime.focusTaskId
    : availableTasks.find(({ task }) => task.planDate === today)?.task.id ?? availableTasks[0]?.task.id ?? "";
  runtime.focusTaskId = selectedTaskId;
  const todayRecords = state.pomodoroRecords.filter(item =>
    item.type === "focus"
      && ["completed", "endedEarly"].includes(item.state)
      && dateKey(new Date(item.endedAt ?? item.startedAt)) === today
  );
  const todaySeconds = todayRecords.reduce((sum, item) => sum + item.focusedSeconds, 0);
  const completedCount = todayRecords.filter(item => item.state === "completed").length;
  const cycleCount = state.pomodoroRecords
    .slice().reverse()
    .findIndex(item => item.type === "longBreak" && item.state === "completed");
  const recentRecords = state.pomodoroRecords.slice().reverse();
  const recordsSinceLongBreak = cycleCount < 0 ? recentRecords : recentRecords.slice(0, cycleCount);
  const cycleFocus = recordsSinceLongBreak.filter(item => item.type === "focus" && item.state === "completed").length;

  return `
    <div class="page focus-page">
      ${pageHeader("专注", record ? "计时记录会自动保存在本机" : "选择任务后开始", `
        <button class="icon-button" data-action="focus-settings" title="番茄设置" aria-label="番茄设置">${icon("sliders-horizontal", 19)}</button>`)}
      <div class="segmented-control" role="tablist" aria-label="计时类型">
        ${sessionTypes.map(item => `
          <button data-action="select-session" data-session-type="${item.value}" class="${type === item.value ? "is-selected" : ""}" ${record ? "disabled" : ""}>${item.label}</button>`).join("")}
      </div>
      <section class="timer-workspace">
        <div class="timer-ring" id="timer-ring" style="--timer-progress:${Math.round(progress * 360)}deg">
          <div>
            <span id="timer-session-label">${sessionLabel(type)}</span>
            <strong id="timer-value">${formatTimer(remaining)}</strong>
            <small id="timer-state">${record ? (record.pausedAt ? "已暂停" : "进行中") : "准备开始"}</small>
          </div>
        </div>
        ${record?.taskTitle ? `<p class="active-task-name">${icon("link", 16)}${escapeHTML(record.taskTitle)}</p>` : ""}
        ${!record && type === "focus" ? `
          <label class="field focus-task-field">
            <span>关联任务</span>
            <select id="focus-task-select">
              <option value="">自由专注</option>
              ${availableTasks.map(({ task, subject }) => `<option value="${task.id}" ${selectedTaskId === task.id ? "selected" : ""}>${escapeHTML(subject.name)} · ${escapeHTML(task.title)}</option>`).join("")}
            </select>
          </label>` : ""}
        <div class="timer-controls">
          ${renderTimerControls(record)}
        </div>
      </section>
      <section class="focus-metrics" aria-label="今日专注数据">
        <div><span>今日专注</span><strong>${durationText(todaySeconds)}</strong></div>
        <div><span>完成番茄</span><strong>${completedCount}</strong></div>
        <div><span>本轮进度</span><strong>${Math.min(cycleFocus, state.settings.sessionsBeforeLongBreak)}/${state.settings.sessionsBeforeLongBreak}</strong></div>
      </section>
    </div>`;
}

function renderTimerControls(record) {
  if (!record) {
    return `<button class="timer-main-button" data-action="start-focus" title="开始" aria-label="开始${sessionLabel(runtime.sessionType)}">${icon("play", 25)}</button>`;
  }
  if (record.pausedAt) {
    return `
      <button class="timer-secondary-button" data-action="end-focus" title="结束" aria-label="结束本次计时">${icon("square", 21)}</button>
      <button class="timer-main-button" data-action="resume-focus" title="继续" aria-label="继续计时">${icon("play", 25)}</button>`;
  }
  return `
    <button class="timer-secondary-button" data-action="end-focus" title="结束" aria-label="结束本次计时">${icon("square", 21)}</button>
    <button class="timer-main-button" data-action="pause-focus" title="暂停" aria-label="暂停计时">${icon("pause", 25)}</button>`;
}

function formatTimer(seconds) {
  const safe = Math.max(Math.floor(seconds || 0), 0);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function renderStatisticsPage() {
  const stats = statisticsForRange(state, runtime.statisticsRange);
  const maxSeconds = Math.max(...stats.buckets.map(item => item.seconds), 1);
  const totalShare = Math.max(stats.subjectShares.reduce((sum, item) => sum + item.seconds, 0), 1);
  let angle = 0;
  const segments = stats.subjectShares.map((item, index) => {
    const start = angle;
    angle += item.seconds / totalShare * 360;
    return `${chartColors[index % chartColors.length]} ${start}deg ${angle}deg`;
  }).join(", ");
  return `
    <div class="page statistics-page">
      ${pageHeader("数据", "学习记录与任务进度")}
      <div class="segmented-control range-control" role="tablist" aria-label="统计范围">
        ${[{ value: "day", label: "今日" }, { value: "week", label: "近 7 天" }, { value: "month", label: "近 30 天" }]
          .map(item => `<button data-action="statistics-range" data-range="${item.value}" class="${runtime.statisticsRange === item.value ? "is-selected" : ""}">${item.label}</button>`).join("")}
      </div>
      <section class="metric-grid">
        <div><span>有效专注</span><strong>${durationText(stats.totalSeconds)}</strong></div>
        <div><span>连续学习</span><strong>${stats.streak} 天</strong></div>
        <div><span>任务完成</span><strong>${stats.completedTaskCount}/${stats.relevantTaskCount}</strong></div>
        <div><span>完成率</span><strong>${Math.round(stats.completionRate * 100)}%</strong></div>
      </section>
      <section class="section-block chart-section">
        <div class="section-heading"><div><span class="section-icon">${icon("chart-no-axes-column-increasing", 19)}</span><h2>学习趋势</h2></div><span>分钟</span></div>
        <div class="bar-chart ${stats.buckets.length > 10 ? "is-scrollable" : ""}" style="--bar-count:${stats.buckets.length}" role="img" aria-label="学习时长趋势图">
          ${stats.buckets.map(item => `
            <div class="bar-column" title="${item.label} ${Math.round(item.seconds / 60)} 分钟">
              <span class="bar-value">${item.seconds ? Math.round(item.seconds / 60) : ""}</span>
              <div class="bar-track"><span style="height:${Math.max(item.seconds / maxSeconds * 100, item.seconds ? 4 : 0)}%"></span></div>
              <small>${item.label}</small>
            </div>`).join("")}
        </div>
      </section>
      <section class="section-block share-section">
        <div class="section-heading"><div><span class="section-icon blue">${icon("chart-pie", 19)}</span><h2>科目占比</h2></div></div>
        ${stats.subjectShares.length ? `
          <div class="share-layout">
            <div class="donut-chart" style="background:conic-gradient(${segments})"><span>${durationText(stats.totalSeconds)}</span></div>
            <div class="share-legend">
              ${stats.subjectShares.map((item, index) => `
                <div><span class="legend-color" style="background:${chartColors[index % chartColors.length]}"></span><strong>${escapeHTML(item.name)}</strong><span>${durationText(item.seconds)}</span></div>`).join("")}
            </div>
          </div>` : emptyState("chart-pie", "当前范围暂无专注记录")}
      </section>
      <section class="section-block">
        <div class="section-heading"><div><span class="section-icon amber">${icon("activity", 19)}</span><h2>薄弱任务</h2></div></div>
        <div class="weak-list">
          ${stats.weakTasks.length ? stats.weakTasks.map(({ task, subject, progress }) => `
            <article class="weak-row">
              <div><strong>${escapeHTML(task.title)}</strong><p>${escapeHTML(subject.name)} · 已专注 ${durationText(task.accumulatedFocusSeconds)}</p></div>
              ${progressBar(progress, task.title)}
            </article>`).join("") : emptyState("check-circle-2", "暂无未完成任务")}
        </div>
      </section>
    </div>`;
}

function renderSettingsPage() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const planning = state.planning;
  const builtinTaskCount = getTaskContexts(state, { includeArchived: true })
    .filter(({ task }) => task.planKey?.startsWith(`${BUILTIN_PLAN_VERSION}:`)).length;
  return `
    <div class="page settings-page">
      ${pageHeader("我的", "考试配置与本地数据")}
      <form id="settings-form" class="settings-form">
        <section class="form-section">
          <h2>考研配置</h2>
          <div class="form-grid two-columns">
            ${textField("examName", "考试名称", state.settings.examName, true)}
            ${textField("targetSchool", "目标院校", state.settings.targetSchool, true)}
            ${textField("targetMajor", "目标专业", state.settings.targetMajor, true)}
            ${dateField("preparationStartDate", "备考开始", state.settings.preparationStartDate)}
            ${dateField("examDate", "考试日期", state.settings.examDate)}
            ${numberField("dailyGoalMinutes", "每日有效专注（分钟）", state.settings.dailyGoalMinutes, 30, 1440, 30)}
          </div>
        </section>
        <section class="form-section">
          <h2>学习自动化</h2>
          ${toggleField("automaticReview", "完成后自动安排复习", state.settings.automaticReview)}
          ${toggleField("automaticDeferral", "逾期任务自动顺延", state.settings.automaticDeferral)}
          ${toggleField("notificationsEnabled", "计时结束通知", state.settings.notificationsEnabled)}
        </section>
        <section class="form-section">
          <h2>外观</h2>
          <label class="field"><span>显示模式</span><select name="appearance">
            <option value="system" ${state.settings.appearance === "system" ? "selected" : ""}>跟随系统</option>
            <option value="light" ${state.settings.appearance === "light" ? "selected" : ""}>浅色</option>
            <option value="dark" ${state.settings.appearance === "dark" ? "selected" : ""}>深色</option>
          </select></label>
        </section>
        <button class="primary-command save-settings" type="submit">${icon("save", 18)}<span>保存设置</span></button>
      </form>
      ${planning ? `
        <section class="form-section plan-settings-section">
          <div class="plan-settings-heading">
            <div><h2>内置复习规划</h2><p>${formatDate(planning.startDate)} - ${formatDate(planning.endDate)}</p></div>
            <span class="status-pill">${builtinTaskCount} 项</span>
          </div>
          <div class="plan-quota-grid">
            <span><strong>${planning.dailyStudyMinutes}</strong><small>每日排期分钟</small></span>
            <span><strong>${planning.dailyFocusMinutes}</strong><small>有效专注分钟</small></span>
            <span><strong>${planning.subjectPomodoroTarget}</strong><small>每科番茄</small></span>
            <span><strong>${planning.dailyPomodoroTarget}</strong><small>每日番茄</small></span>
          </div>
          <div class="phase-schedule-list">
            ${planning.phaseSchedule.map(phase => `
              <div><span>${escapeHTML(phase.name)}</span><small>${formatDate(phase.startDate)} - ${formatDate(phase.endDate)}</small></div>
            `).join("")}
          </div>
          <details class="plan-source-details">
            <summary>规划依据</summary>
            <div class="plan-source-list">
              ${planning.sources.map(source => source.url
                ? `<a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer"><span>${escapeHTML(source.title)}</span><small>${escapeHTML(source.type)}</small>${icon("external-link", 15)}</a>`
                : `<div><span>${escapeHTML(source.title)}</span><small>${escapeHTML(source.type)}</small></div>`
              ).join("")}
            </div>
          </details>
          <button class="secondary-command" data-action="rebuild-plan">${icon("refresh-cw", 17)}<span>恢复缺失规划</span></button>
        </section>` : ""}
      <section class="form-section data-section">
        <h2>数据与安装</h2>
        <div class="data-row"><div>${icon("database", 19)}<span><strong>本地数据库</strong><small>任务与附件仅保存在当前浏览器；JSON 备份不包含附件文件</small></span></div><span class="status-pill">正常</span></div>
        <div class="data-actions">
          <button class="secondary-command" data-action="export-backup">${icon("download", 18)}<span>导出备份</span></button>
          <button class="secondary-command" data-action="import-backup">${icon("upload", 18)}<span>导入备份</span></button>
          <input type="file" id="backup-file" accept="application/json" hidden>
          <button class="secondary-command" data-action="open-install">${icon(isStandalone ? "badge-check" : "smartphone", 18)}<span>${isStandalone ? "已安装" : "添加到主屏幕"}</span></button>
        </div>
        <button class="text-danger-button" data-action="reset-data">清除全部本地数据</button>
      </section>
      <section class="about-section"><span>北邮新传备考看板</span><span>Web App ${APP_VERSION}</span></section>
    </div>`;
}

function textField(name, label, value, required = false) {
  return `<label class="field"><span>${label}</span><input name="${name}" type="text" value="${escapeHTML(value)}" ${required ? "required" : ""} maxlength="100"></label>`;
}

function dateField(name, label, value) {
  return `<label class="field"><span>${label}</span><input name="${name}" type="date" value="${escapeHTML(value)}" required></label>`;
}

function numberField(name, label, value, min, max, step = 1) {
  return `<label class="field"><span>${label}</span><input name="${name}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" required></label>`;
}

function toggleField(name, label, checked) {
  return `<label class="toggle-field"><span>${label}</span><input name="${name}" type="checkbox" ${checked ? "checked" : ""}><span class="toggle-ui"></span></label>`;
}

function openModal(content, options = {}) {
  runtime.modal = options.kind ?? "generic";
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <section class="modal-panel ${options.wide ? "is-wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header class="modal-header"><h2 id="modal-title">${escapeHTML(options.title ?? "编辑")}</h2><button class="icon-button" data-action="close-modal" title="关闭" aria-label="关闭">${icon("x", 20)}</button></header>
        <div class="modal-content">${content}</div>
      </section>
    </div>`;
  document.body.classList.add("modal-open");
  renderIcons();
  modalRoot.querySelector("input, select, textarea, button")?.focus();
}

function closeModal() {
  runtime.modal = null;
  modalRoot.innerHTML = "";
  document.body.classList.remove("modal-open");
}

function entityForm(type, context = {}, entity = null) {
  const titles = {
    subject: entity ? "编辑科目" : "新增科目",
    module: entity ? "编辑模块" : "新增模块",
    chapter: entity ? "编辑章节" : "新增章节",
    task: entity ? "编辑任务" : "新增任务"
  };
  const commonHidden = Object.entries(context)
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHTML(value)}">`)
    .join("");
  let fields = "";
  if (type === "subject") {
    fields = `
      ${textField("name", "科目名称", entity?.name ?? "", true)}
      <div class="form-grid two-columns">
        <label class="field"><span>颜色</span><input name="color" type="color" value="${escapeHTML(entity?.color ?? "#1f5d42")}"></label>
        ${numberField("weight", "权重", entity?.weight ?? 1, 0.1, 100, 0.1)}
        ${numberField("targetStudyMinutes", "目标时长（分钟）", entity?.targetStudyMinutes ?? 0, 0, 100000, 30)}
      </div>
      <label class="field"><span>备注</span><textarea name="notes" rows="3" maxlength="500">${escapeHTML(entity?.notes ?? "")}</textarea></label>
      ${toggleField("archived", "归档科目", entity?.archived ?? false)}`;
  } else if (type === "module" || type === "chapter") {
    fields = `
      ${textField("name", type === "module" ? "模块名称" : "章节名称", entity?.name ?? "", true)}
      ${numberField("weight", "权重", entity?.weight ?? 1, 0.1, 100, 0.1)}
      <label class="field"><span>备注</span><textarea name="notes" rows="3" maxlength="500">${escapeHTML(entity?.notes ?? "")}</textarea></label>
      ${toggleField("archived", "归档", entity?.archived ?? false)}`;
  } else {
    fields = taskFormFields(entity);
  }
  openModal(`
    <form id="entity-form" data-entity-type="${type}" class="modal-form">
      ${commonHidden}${entity ? `<input type="hidden" name="entityId" value="${entity.id}">` : ""}
      ${fields}
      <div class="modal-actions"><button type="button" class="secondary-command" data-action="close-modal">取消</button><button type="submit" class="primary-command">${icon("check", 17)}<span>保存</span></button></div>
    </form>`, { title: titles[type], kind: "entity", wide: type === "task" });
}

function taskFormFields(task = null) {
  return `
    ${textField("title", "任务名称", task?.title ?? "", true)}
    <label class="field"><span>任务说明</span><textarea name="details" rows="3" maxlength="800">${escapeHTML(task?.details ?? "")}</textarea></label>
    <div class="form-grid two-columns">
      <label class="field"><span>状态</span><select name="status">${TASK_STATUSES.map(item => `<option value="${item.value}" ${task?.status === item.value ? "selected" : ""}>${item.label}</option>`).join("")}</select></label>
      <label class="field"><span>优先级</span><select name="priority">${TASK_PRIORITIES.map(item => `<option value="${item.value}" ${task?.priority === item.value ? "selected" : ""}>${item.label}</option>`).join("")}</select></label>
      ${numberField("estimatedMinutes", "预计时长（分钟）", task?.estimatedMinutes ?? 25, 1, 1440, 1)}
      ${numberField("weight", "任务权重", task?.weight ?? 1, 0.1, 100, 0.1)}
      <label class="field"><span>计划开始</span><input name="scheduledAt" type="datetime-local" value="${localDateTimeValue(task?.scheduledAt)}"></label>
      <label class="field"><span>截止时间</span><input name="dueAt" type="datetime-local" value="${localDateTimeValue(task?.dueAt)}"></label>
    </div>
    ${toggleField("automaticReview", "完成后自动生成复习", task?.automaticReview ?? true)}
    ${state.tags.length ? `<fieldset class="tag-picker"><legend>标签</legend>${state.tags.map(tag => `<label><input type="checkbox" name="tags" value="${tag.id}" ${task?.tags?.includes(tag.id) ? "checked" : ""}><span style="--tag-color:${escapeHTML(tag.color)}">${escapeHTML(tag.name)}</span></label>`).join("")}</fieldset>` : ""}`;
}

function openEntityEditor(type, dataset) {
  const context = {
    subjectId: dataset.subjectId ?? "",
    moduleId: dataset.moduleId ?? "",
    chapterId: dataset.chapterId ?? ""
  };
  const found = findContext(state, {
    subjectId: context.subjectId,
    moduleId: context.moduleId,
    chapterId: context.chapterId,
    taskId: dataset.taskId
  });
  const entity = type === "subject" ? found.subject
    : type === "module" ? found.module
      : type === "chapter" ? found.chapter
        : found.task;
  entityForm(type, context, entity ?? null);
}

function openTagManager() {
  openModal(`
    <form id="tag-form" class="inline-add-form">
      <input name="name" type="text" maxlength="30" required placeholder="标签名称">
      <input name="color" type="color" value="#1f5d42" aria-label="标签颜色">
      <button class="primary-command compact" type="submit">${icon("plus", 17)}<span>添加</span></button>
    </form>
    <div class="tag-manager-list">
      ${state.tags.length ? state.tags.map(tag => `
        <div><span class="tag-chip" style="--tag-color:${escapeHTML(tag.color)}">${escapeHTML(tag.name)}</span><button class="icon-button danger" data-action="delete-tag" data-tag-id="${tag.id}" title="删除标签" aria-label="删除 ${escapeHTML(tag.name)}">${icon("trash-2", 16)}</button></div>`).join("") : emptyState("tags", "还没有标签")}
    </div>`, { title: "标签管理", kind: "tags" });
}

function formatFileSize(bytes) {
  const size = Math.max(Number(bytes) || 0, 0);
  if (size < 1_024) return `${size} B`;
  if (size < 1_048_576) return `${Math.round(size / 1_024)} KB`;
  return `${(size / 1_048_576).toFixed(1)} MB`;
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function openMaterials(taskId, draft = {}) {
  const context = findTaskContext(state, taskId);
  if (!context) return;
  const { task, subject, chapter } = context;
  openModal(`
    <div class="material-context">
      <span>${escapeHTML(subject.name)} · ${escapeHTML(chapter.name)}</span>
      <strong>${escapeHTML(task.title)}</strong>
      ${task.details ? `<p>${escapeHTML(task.details).replaceAll("\n", "<br>")}</p>` : ""}
    </div>
    <form id="materials-form" data-task-id="${task.id}" class="modal-form materials-form">
      <label class="field"><span>学习笔记</span><textarea name="studyNotes" rows="7" maxlength="12000" placeholder="整理概念框架、案例、错因和答题表达">${escapeHTML(draft.studyNotes ?? task.studyNotes ?? "")}</textarea></label>
      <section class="material-section">
        <div class="material-section-heading"><div><strong>资料链接</strong><small>网页、云盘、在线文档</small></div></div>
        <div class="resource-list">
          ${(task.resourceLinks ?? []).length ? task.resourceLinks.map(link => `
            <div class="resource-row">
              <a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${icon("link", 16)}<span>${escapeHTML(link.title || link.url)}</span></a>
              <button type="button" class="icon-button danger" data-action="delete-resource-link" data-task-id="${task.id}" data-link-id="${link.id}" title="删除链接" aria-label="删除链接">${icon("trash-2", 16)}</button>
            </div>`).join("") : `<p class="material-empty">还没有资料链接</p>`}
        </div>
        <div class="inline-add-form material-link-form">
          <input name="linkTitle" type="text" maxlength="100" value="${escapeHTML(draft.linkTitle ?? "")}" placeholder="资料名称">
          <input name="linkUrl" type="url" inputmode="url" value="${escapeHTML(draft.linkUrl ?? "")}" placeholder="https://...">
        </div>
      </section>
      <section class="material-section">
        <div class="material-section-heading"><div><strong>本机附件</strong><small>单个不超过 25 MB，只保存在当前设备</small></div></div>
        <div class="attachment-list">
          ${(task.attachments ?? []).length ? task.attachments.map(file => `
            <div class="resource-row">
              <button type="button" class="attachment-open" data-action="open-attachment" data-attachment-id="${file.id}">${icon("file", 17)}<span><strong>${escapeHTML(file.name)}</strong><small>${formatFileSize(file.size)}</small></span></button>
              <button type="button" class="icon-button danger" data-action="delete-attachment" data-task-id="${task.id}" data-attachment-id="${file.id}" title="删除附件" aria-label="删除 ${escapeHTML(file.name)}">${icon("trash-2", 16)}</button>
            </div>`).join("") : `<p class="material-empty">还没有附件</p>`}
        </div>
        <label class="file-picker"><input type="file" id="task-attachment-file" data-task-id="${task.id}" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.zip"><span>${icon("paperclip", 17)}选择文件</span></label>
      </section>
      <div class="modal-actions"><button type="button" class="secondary-command" data-action="close-modal">关闭</button><button type="submit" class="primary-command">${icon("save", 17)}<span>保存笔记与链接</span></button></div>
    </form>`, { title: "资料与笔记", kind: "materials", wide: true });
}

async function openStoredAttachment(attachmentId) {
  try {
    const record = await loadTaskAttachment(attachmentId);
    if (!record?.blob) throw new Error("附件不存在，可能来自其他设备的备份");
    const url = URL.createObjectURL(record.blob);
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.download = record.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    showToast(error.message || "无法打开附件", "error");
  }
}

function openFocusSettings() {
  openModal(`
    <form id="focus-settings-form" class="modal-form">
      <div class="form-grid two-columns">
        ${numberField("focusMinutes", "专注时长（分钟）", state.settings.focusMinutes, 1, 180, 1)}
        ${numberField("shortBreakMinutes", "短休息（分钟）", state.settings.shortBreakMinutes, 1, 60, 1)}
        ${numberField("longBreakMinutes", "长休息（分钟）", state.settings.longBreakMinutes, 1, 120, 1)}
        ${numberField("sessionsBeforeLongBreak", "长休息间隔（番茄）", state.settings.sessionsBeforeLongBreak, 1, 12, 1)}
      </div>
      ${toggleField("autoStartBreak", "自动开始休息", state.settings.autoStartBreak)}
      ${toggleField("autoStartFocus", "休息后自动开始专注", state.settings.autoStartFocus)}
      <div class="modal-actions"><button type="button" class="secondary-command" data-action="close-modal">取消</button><button type="submit" class="primary-command">${icon("check", 17)}<span>保存</span></button></div>
    </form>`, { title: "番茄设置", kind: "focus-settings" });
}

function openPauseDialog() {
  openModal(`
    <form id="pause-form" class="modal-form">
      <label class="field"><span>中断原因</span><select name="reason">
        <option>临时暂停</option><option>手机干扰</option><option>环境干扰</option><option>疲劳</option><option>其他</option>
      </select></label>
      <label class="field"><span>补充说明</span><textarea name="note" rows="3" maxlength="200"></textarea></label>
      <div class="modal-actions"><button type="button" class="secondary-command" data-action="close-modal">继续计时</button><button type="submit" class="primary-command">${icon("pause", 17)}<span>暂停</span></button></div>
    </form>`, { title: "暂停计时", kind: "pause" });
}

function openEndDialog() {
  openModal(`
    <div class="choice-list">
      <button data-action="finish-early"><span class="choice-icon">${icon("save", 20)}</span><span><strong>提前结束并记录</strong><small>保留已经产生的有效专注时长</small></span>${icon("chevron-right", 18)}</button>
      <button data-action="cancel-focus" class="danger-choice"><span class="choice-icon">${icon("x", 20)}</span><span><strong>取消本次</strong><small>不计入学习时长</small></span>${icon("chevron-right", 18)}</button>
    </div>`, { title: "结束本次计时？", kind: "end-focus" });
}

function openInstallDialog() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) {
    showToast("备考看板已经以 App 模式运行");
    return;
  }
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.finally(() => { deferredInstallPrompt = null; });
    return;
  }
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  openModal(`
    <div class="install-sheet">
      <div class="install-icon"><img src="./assets/icon.svg" alt=""></div>
      <p>${isIOS ? "在 Safari 底部点按分享按钮，然后选择“添加到主屏幕”。" : "请使用浏览器菜单中的“安装应用”或“创建快捷方式”。"}</p>
      <div class="install-steps">
        <span>${icon("share", 18)}分享</span>${icon("chevron-right", 16)}<span>${icon("square-plus", 18)}添加到主屏幕</span>
      </div>
    </div>`, { title: "安装备考看板", kind: "install" });
}

function formBoolean(formData, name) {
  return formData.get(name) === "on";
}

function formNumber(formData, name, fallback = 0) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? value : fallback;
}

async function handleEntitySubmit(form) {
  const formData = new FormData(form);
  const type = form.dataset.entityType;
  const identifiers = {
    subjectId: formData.get("subjectId"),
    moduleId: formData.get("moduleId"),
    chapterId: formData.get("chapterId")
  };
  const existingId = formData.get("entityId");
  const context = findContext(state, identifiers);
  const name = String(formData.get(type === "task" ? "title" : "name") ?? "").trim();
  if (!name) {
    showToast("名称不能为空", "error");
    return;
  }

  if (type === "subject") {
    const subject = existingId ? state.subjects.find(item => item.id === existingId) : null;
    const target = subject ?? {
      id: createId(), modules: [], sortOrder: state.subjects.length
    };
    Object.assign(target, {
      name,
      color: formData.get("color"),
      weight: formNumber(formData, "weight", 1),
      targetStudyMinutes: formNumber(formData, "targetStudyMinutes", 0),
      notes: String(formData.get("notes") ?? "").trim(),
      archived: formBoolean(formData, "archived")
    });
    if (!subject) state.subjects.push(target);
  } else if (type === "module") {
    const module = existingId ? context.subject?.modules.find(item => item.id === existingId) : null;
    const target = module ?? createModule(name, context.subject?.modules.length ?? 0);
    Object.assign(target, { name, weight: formNumber(formData, "weight", 1), notes: String(formData.get("notes") ?? "").trim(), archived: formBoolean(formData, "archived") });
    if (!module) context.subject?.modules.push(target);
  } else if (type === "chapter") {
    const chapter = existingId ? context.module?.chapters.find(item => item.id === existingId) : null;
    const target = chapter ?? createChapter(name, context.module?.chapters.length ?? 0);
    Object.assign(target, { name, weight: formNumber(formData, "weight", 1), notes: String(formData.get("notes") ?? "").trim(), archived: formBoolean(formData, "archived") });
    if (!chapter) context.module?.chapters.push(target);
  } else {
    const task = existingId ? context.chapter?.tasks.find(item => item.id === existingId) : null;
    const previousStatus = task?.status;
    const values = {
      title: name,
      details: String(formData.get("details") ?? "").trim(),
      status: formData.get("status"),
      priority: formData.get("priority"),
      estimatedMinutes: formNumber(formData, "estimatedMinutes", 25),
      weight: formNumber(formData, "weight", 1),
      scheduledAt: formData.get("scheduledAt") ? new Date(formData.get("scheduledAt")).toISOString() : null,
      dueAt: formData.get("dueAt") ? new Date(formData.get("dueAt")).toISOString() : null,
      automaticReview: formBoolean(formData, "automaticReview"),
      tags: formData.getAll("tags")
    };
    if (values.scheduledAt && values.dueAt && new Date(values.dueAt) < new Date(values.scheduledAt)) {
      showToast("截止时间不能早于计划开始", "error");
      return;
    }
    const target = task ?? createTask(values, context.chapter?.tasks.length ?? 0);
    Object.assign(target, values, { updatedAt: new Date().toISOString() });
    if (!task) context.chapter?.tasks.push(target);
    if (values.status === "completed" && previousStatus !== "completed") {
      target.status = previousStatus ?? "notStarted";
      completeTask(state, target.id);
    } else if (values.status !== "completed") {
      target.completedAt = null;
    }
  }

  await saveNow();
  closeModal();
  renderShell();
  showToast("已保存");
}

function deleteEntity(action, dataset) {
  const context = findContext(state, {
    subjectId: dataset.subjectId,
    moduleId: dataset.moduleId,
    chapterId: dataset.chapterId,
    taskId: dataset.taskId
  });
  const labels = {
    "delete-subject": context.subject?.name,
    "delete-module": context.module?.name,
    "delete-chapter": context.chapter?.name,
    "delete-task": context.task?.title
  };
  if (!confirm(`确定删除“${labels[action] ?? "此项目"}”吗？下级内容也会一并删除。`)) return;
  const attachmentIds = action === "delete-task"
    ? (context.task?.attachments ?? []).map(file => file.id)
    : action === "delete-chapter"
      ? (context.chapter?.tasks ?? []).flatMap(task => (task.attachments ?? []).map(file => file.id))
      : action === "delete-module"
        ? (context.module?.chapters ?? []).flatMap(chapter => (chapter.tasks ?? []).flatMap(task => (task.attachments ?? []).map(file => file.id)))
        : action === "delete-subject"
          ? (context.subject?.modules ?? []).flatMap(module => (module.chapters ?? []).flatMap(chapter => (chapter.tasks ?? []).flatMap(task => (task.attachments ?? []).map(file => file.id))))
          : [];
  deleteTaskAttachments(attachmentIds).catch(error => console.warn("Attachment cleanup failed", error));
  if (action === "delete-subject") state.subjects = state.subjects.filter(item => item.id !== dataset.subjectId);
  if (action === "delete-module") context.subject.modules = context.subject.modules.filter(item => item.id !== dataset.moduleId);
  if (action === "delete-chapter") context.module.chapters = context.module.chapters.filter(item => item.id !== dataset.chapterId);
  if (action === "delete-task") {
    if (!context.task?.isReview) removeGeneratedReviews(dataset.taskId);
    context.chapter.tasks = context.chapter.tasks.filter(item => item.id !== dataset.taskId);
  }
  scheduleSave();
  renderShell();
  showToast("已删除");
}

function removeGeneratedReviews(sourceTaskId) {
  let removedCount = 0;
  for (const subject of state.subjects) {
    for (const module of subject.modules ?? []) {
      for (const chapter of module.chapters ?? []) {
        const previousCount = chapter.tasks?.length ?? 0;
        chapter.tasks = (chapter.tasks ?? []).filter(task => task.sourceTaskId !== sourceTaskId);
        removedCount += previousCount - chapter.tasks.length;
      }
    }
  }
  return removedCount;
}

function reorderTodayTask(taskId, direction) {
  const list = todaySections(state).todo;
  const index = list.findIndex(item => item.task.id === taskId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= list.length) return;
  const [moved] = list.splice(index, 1);
  list.splice(targetIndex, 0, moved);
  list.forEach((item, order) => { item.task.dailySortOrder = order; });
  scheduleSave();
  renderShell();
}

function handleTaskCompletion(taskId) {
  const context = findTaskContext(state, taskId);
  if (!context) return;
  if (context.task.status === "completed") {
    const removedReviews = context.task.isReview ? 0 : removeGeneratedReviews(context.task.id);
    context.task.status = "inProgress";
    context.task.completedAt = null;
    context.task.updatedAt = new Date().toISOString();
    showToast(removedReviews ? "任务已重新打开，原复习计划已清除" : "任务已重新打开");
  } else {
    const beforeCount = getTaskContexts(state, { includeArchived: true }).length;
    completeTask(state, taskId);
    const generated = getTaskContexts(state, { includeArchived: true }).length - beforeCount;
    showToast(generated ? `已完成，并生成 ${generated} 次复习` : "任务已完成");
  }
  scheduleSave();
  renderShell();
}

async function notifyFocusCompleted(record) {
  if (!state.settings.notificationsEnabled || !("Notification" in window)) return;
  try {
    if (Notification.permission === "granted") {
      const registration = await navigator.serviceWorker?.getRegistration?.();
      const options = { body: record.taskTitle ? `“${record.taskTitle}”的专注已经完成。` : "本次专注已经完成。", icon: "./assets/icon-192.png" };
      if (registration?.showNotification) await registration.showNotification("专注结束", options);
      else new Notification("专注结束", options);
    }
  } catch (error) {
    console.warn("Focus notification failed", error);
  }
}

async function finishActiveRecord(finalState) {
  const record = activeFocusRecord(state);
  if (!record) return;
  finishFocusRecord(state, record, finalState);
  let completedPlanBlock = false;
  if (finalState === "completed" && record.type === "focus" && record.taskId) {
    const context = findTaskContext(state, record.taskId);
    if (context?.task.planKey
      && context.task.status !== "completed"
      && taskPomodoroCount(record.taskId) >= (context.task.pomodoroTarget ?? 4)) {
      completeTask(state, record.taskId);
      completedPlanBlock = true;
    }
  }
  await saveNow();
  closeModal();
  if (finalState === "completed") {
    await notifyFocusCompleted(record);
    const next = record.type === "focus" ? suggestedBreakType(state) : "focus";
    const shouldAutoStart = record.type === "focus"
      ? state.settings.autoStartBreak
      : state.settings.autoStartFocus;
    runtime.sessionType = next;
    if (shouldAutoStart) {
      const taskId = next === "focus" ? runtime.focusTaskId || null : null;
      startFocusRecord(state, next, taskId);
      await saveNow();
      showToast(`${sessionLabel(record.type)}已完成，${sessionLabel(next)}已开始`);
    } else {
      showToast(completedPlanBlock ? "4 个番茄完成，本科目学习块已打卡" : `${sessionLabel(record.type)}已完成`);
    }
  } else if (finalState === "endedEarly") {
    showToast("已记录本次有效时长");
  } else {
    showToast("本次计时已取消");
  }
  renderShell();
}

async function refreshCurrentDay() {
  if (dayRefreshPromise) return dayRefreshPromise;
  dayRefreshPromise = (async () => {
    const previousDateKey = runtime.currentDateKey;
    const currentDateKey = dateKey();
    const deferredCount = runAutomaticDeferral(state);
    runtime.currentDateKey = currentDateKey;
    if (deferredCount) await saveNow();
    if (previousDateKey !== currentDateKey || deferredCount) {
      renderShell();
      if (deferredCount) showToast(`已自动顺延 ${deferredCount} 项逾期任务`);
    } else {
      updateFocusDisplay();
    }
  })().finally(() => { dayRefreshPromise = null; });
  return dayRefreshPromise;
}

function updateFocusDisplay() {
  if (runtime.currentDateKey !== dateKey()) refreshCurrentDay();
  const record = activeFocusRecord(state);
  if (!record) return;
  const snapshot = focusSnapshot(record);
  const value = document.querySelector("#timer-value");
  const ring = document.querySelector("#timer-ring");
  const stateLabel = document.querySelector("#timer-state");
  if (value) value.textContent = formatTimer(snapshot.remainingSeconds);
  if (ring) ring.style.setProperty("--timer-progress", `${Math.round(snapshot.progress * 360)}deg`);
  if (stateLabel) stateLabel.textContent = record.pausedAt ? "已暂停" : "进行中";
  if (!record.pausedAt && snapshot.remainingSeconds <= 0) finishActiveRecord("completed");
}

function startFocusTicker() {
  clearInterval(focusTicker);
  focusTicker = setInterval(updateFocusDisplay, 1_000);
}

async function handleClick(event) {
  if (event.target.classList?.contains("modal-backdrop")) {
    closeModal();
    return;
  }
  const tabButton = event.target.closest("[data-tab]");
  if (tabButton) {
    runtime.tab = tabButton.dataset.tab;
    state.ui.selectedTab = runtime.tab;
    scheduleSave();
    renderShell();
    window.scrollTo({ top: 0, behavior: "instant" });
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action } = button.dataset;

  if (action === "close-modal") return closeModal();
  if (action === "open-install") return openInstallDialog();
  if (action === "quick-focus") {
    runtime.tab = "focus";
    runtime.sessionType = "focus";
    state.ui.selectedTab = "focus";
    scheduleSave();
    renderShell();
    return;
  }
  if (action === "complete-task" || action === "toggle-task-complete") return handleTaskCompletion(button.dataset.taskId);
  if (action === "defer-task") {
    deferTaskOneDay(state, button.dataset.taskId);
    scheduleSave();
    renderShell();
    showToast("任务已延后一天");
    return;
  }
  if (action === "move-task-up") return reorderTodayTask(button.dataset.taskId, -1);
  if (action === "move-task-down") return reorderTodayTask(button.dataset.taskId, 1);
  if (action === "open-materials") return openMaterials(button.dataset.taskId);
  if (action === "open-attachment") return openStoredAttachment(button.dataset.attachmentId);
  if (action === "delete-attachment") {
    if (!confirm("确定删除这个附件吗？")) return;
    const context = findTaskContext(state, button.dataset.taskId);
    await deleteTaskAttachment(button.dataset.attachmentId);
    if (context) context.task.attachments = context.task.attachments.filter(file => file.id !== button.dataset.attachmentId);
    await saveNow();
    openMaterials(button.dataset.taskId);
    showToast("附件已删除");
    return;
  }
  if (action === "delete-resource-link") {
    const context = findTaskContext(state, button.dataset.taskId);
    if (context) context.task.resourceLinks = context.task.resourceLinks.filter(link => link.id !== button.dataset.linkId);
    await saveNow();
    openMaterials(button.dataset.taskId);
    return;
  }
  if (action === "board-phase") {
    runtime.boardPhase = button.dataset.phase;
    renderShell();
    return;
  }
  if (action === "add-subject") return entityForm("subject");
  if (action === "add-module") return entityForm("module", { subjectId: button.dataset.subjectId });
  if (action === "add-chapter") return entityForm("chapter", { subjectId: button.dataset.subjectId, moduleId: button.dataset.moduleId });
  if (action === "add-task") return entityForm("task", { subjectId: button.dataset.subjectId, moduleId: button.dataset.moduleId, chapterId: button.dataset.chapterId });
  if (action === "edit-subject") return openEntityEditor("subject", button.dataset);
  if (action === "edit-module") return openEntityEditor("module", button.dataset);
  if (action === "edit-chapter") return openEntityEditor("chapter", button.dataset);
  if (action === "edit-task") return openEntityEditor("task", button.dataset);
  if (action.startsWith("delete-") && action !== "delete-tag") return deleteEntity(action, button.dataset);
  if (action === "manage-tags") return openTagManager();
  if (action === "delete-tag") {
    if (!confirm("确定删除这个标签吗？")) return;
    state.tags = state.tags.filter(tag => tag.id !== button.dataset.tagId);
    getTaskContexts(state, { includeArchived: true }).forEach(({ task }) => {
      task.tags = task.tags.filter(id => id !== button.dataset.tagId);
    });
    scheduleSave();
    openTagManager();
    return;
  }
  if (action === "select-session") {
    runtime.sessionType = button.dataset.sessionType;
    renderShell();
    return;
  }
  if (action === "focus-settings") return openFocusSettings();
  if (action === "start-focus") {
    const taskId = runtime.sessionType === "focus" ? runtime.focusTaskId || null : null;
    startFocusRecord(state, runtime.sessionType, taskId);
    await saveNow();
    renderShell();
    return;
  }
  if (action === "pause-focus") return openPauseDialog();
  if (action === "resume-focus") {
    resumeFocusRecord(activeFocusRecord(state));
    await saveNow();
    renderShell();
    return;
  }
  if (action === "end-focus") return openEndDialog();
  if (action === "finish-early") return finishActiveRecord("endedEarly");
  if (action === "cancel-focus") return finishActiveRecord("cancelled");
  if (action === "statistics-range") {
    runtime.statisticsRange = button.dataset.range;
    renderShell();
    return;
  }
  if (action === "export-backup") return downloadBackup(state);
  if (action === "import-backup") return document.querySelector("#backup-file")?.click();
  if (action === "rebuild-plan") {
    const result = installBuiltinStudyPlan(state, new Date(), { repair: true });
    await saveNow();
    renderShell();
    showToast(result.taskCount ? `已恢复 ${result.taskCount} 项缺失规划` : "内置规划完整，无需恢复");
    return;
  }
  if (action === "reset-data") {
    if (!confirm("确定清除全部本地数据吗？此操作不能撤销。")) return;
    await clearPersistedState();
    state = createDefaultState();
    installBuiltinStudyPlan(state);
    runtime.tab = "today";
    runtime.currentDateKey = dateKey();
    await saveNow();
    applyAppearance();
    renderShell();
    showToast("本地数据已清除");
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  if (form.id === "entity-form") return handleEntitySubmit(form);
  if (form.id === "materials-form") {
    const context = findTaskContext(state, form.dataset.taskId);
    if (!context) return;
    const data = new FormData(form);
    context.task.studyNotes = String(data.get("studyNotes") ?? "").trim();
    const linkUrl = safeExternalUrl(String(data.get("linkUrl") ?? "").trim());
    const rawLinkUrl = String(data.get("linkUrl") ?? "").trim();
    if (rawLinkUrl && !linkUrl) {
      showToast("资料链接必须以 http:// 或 https:// 开头", "error");
      return;
    }
    if (linkUrl) {
      context.task.resourceLinks.push({
        id: createId(),
        title: String(data.get("linkTitle") ?? "").trim() || new URL(linkUrl).hostname,
        url: linkUrl,
        createdAt: new Date().toISOString()
      });
    }
    context.task.updatedAt = new Date().toISOString();
    await saveNow();
    openMaterials(context.task.id);
    showToast("资料与笔记已保存");
    return;
  }
  if (form.id === "tag-form") {
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    if (!name) return;
    if (state.tags.some(tag => tag.name.toLowerCase() === name.toLowerCase())) {
      showToast("已经存在同名标签", "error");
      return;
    }
    state.tags.push({ id: createId(), name, color: data.get("color") ?? "#1f5d42" });
    await saveNow();
    openTagManager();
    return;
  }
  if (form.id === "focus-settings-form") {
    const data = new FormData(form);
    ["focusMinutes", "shortBreakMinutes", "longBreakMinutes", "sessionsBeforeLongBreak"].forEach(name => {
      state.settings[name] = formNumber(data, name, state.settings[name]);
    });
    state.settings.autoStartBreak = formBoolean(data, "autoStartBreak");
    state.settings.autoStartFocus = formBoolean(data, "autoStartFocus");
    await saveNow();
    closeModal();
    renderShell();
    showToast("番茄设置已保存");
    return;
  }
  if (form.id === "pause-form") {
    const data = new FormData(form);
    pauseFocusRecord(activeFocusRecord(state), data.get("reason"), String(data.get("note") ?? "").trim());
    await saveNow();
    closeModal();
    renderShell();
    return;
  }
  if (form.id === "settings-form") {
    const data = new FormData(form);
    const examDate = new Date(`${data.get("examDate")}T00:00:00`);
    const startDate = new Date(`${data.get("preparationStartDate")}T00:00:00`);
    if (examDate < startDate) {
      showToast("考试日期不能早于备考开始日期", "error");
      return;
    }
    Object.assign(state.settings, {
      examName: String(data.get("examName") ?? "").trim(),
      targetSchool: String(data.get("targetSchool") ?? "").trim(),
      targetMajor: String(data.get("targetMajor") ?? "").trim(),
      preparationStartDate: data.get("preparationStartDate"),
      examDate: data.get("examDate"),
      dailyGoalMinutes: formNumber(data, "dailyGoalMinutes", 400),
      automaticReview: formBoolean(data, "automaticReview"),
      automaticDeferral: formBoolean(data, "automaticDeferral"),
      notificationsEnabled: formBoolean(data, "notificationsEnabled"),
      appearance: data.get("appearance")
    });
    if (state.settings.notificationsEnabled && "Notification" in window && Notification.permission === "default") {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") state.settings.notificationsEnabled = false;
      } catch {
        state.settings.notificationsEnabled = false;
      }
    }
    const deferredCount = runAutomaticDeferral(state);
    applyAppearance();
    await saveNow();
    renderShell();
    showToast(deferredCount ? `设置已保存，并顺延 ${deferredCount} 项任务` : "设置已保存");
  }
}

function handleInput(event) {
  if (event.target.id === "daily-goal") {
    const key = dateKey();
    state.dailyNotes[key] ??= { goal: "", content: "", reflection: "" };
    state.dailyNotes[key].goal = event.target.value;
    state.dailyNotes[key].updatedAt = new Date().toISOString();
    scheduleSave();
  }
}

async function handleChange(event) {
  if (event.target.id === "show-archived") {
    runtime.showArchived = event.target.checked;
    renderShell();
  }
  if (event.target.id === "focus-task-select") runtime.focusTaskId = event.target.value;
  if (event.target.id === "task-attachment-file" && event.target.files?.[0]) {
    const file = event.target.files[0];
    const taskId = event.target.dataset.taskId;
    const context = findTaskContext(state, taskId);
    const form = event.target.closest("form");
    const draft = form ? {
      studyNotes: form.elements.studyNotes?.value ?? "",
      linkTitle: form.elements.linkTitle?.value ?? "",
      linkUrl: form.elements.linkUrl?.value ?? ""
    } : {};
    if (!context) return;
    if (file.size > 25 * 1_048_576) {
      showToast("单个附件不能超过 25 MB", "error");
      event.target.value = "";
      return;
    }
    try {
      const metadata = await saveTaskAttachment(taskId, file);
      context.task.attachments.push(metadata);
      context.task.updatedAt = new Date().toISOString();
      await saveNow();
      openMaterials(taskId, draft);
      showToast("附件已保存到当前设备");
    } catch (error) {
      showToast(error.message || "附件保存失败", "error");
    }
    return;
  }
  if (event.target.id === "backup-file" && event.target.files?.[0]) {
    try {
      const imported = normalizeState(await readBackup(event.target.files[0]));
      if (!confirm("导入会覆盖当前浏览器中的全部数据，确定继续吗？")) return;
      state = imported;
      const planResult = installBuiltinStudyPlan(state);
      runtime.tab = state.ui.selectedTab ?? "today";
      runtime.currentDateKey = dateKey();
      const deferredCount = runAutomaticDeferral(state);
      applyAppearance();
      await saveNow();
      renderShell();
      if (planResult.installed) showToast(`备份已导入，并补充 ${planResult.taskCount} 项内置规划`);
      else showToast(deferredCount ? `备份已导入，并顺延 ${deferredCount} 项任务` : "备份已导入");
    } catch (error) {
      showToast(error.message || "导入失败", "error");
    }
  }
}

function handleDragStart(event) {
  const row = event.target.closest("[data-task-id][draggable='true']");
  if (!row) return;
  draggedTaskId = row.dataset.taskId;
  row.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
}

function handleDragOver(event) {
  if (!draggedTaskId || !event.target.closest("#today-todo-list .task-row")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function handleDrop(event) {
  const target = event.target.closest("#today-todo-list .task-row");
  if (!target || !draggedTaskId || target.dataset.taskId === draggedTaskId) return;
  event.preventDefault();
  const list = todaySections(state).todo;
  const sourceIndex = list.findIndex(item => item.task.id === draggedTaskId);
  const targetIndex = list.findIndex(item => item.task.id === target.dataset.taskId);
  if (sourceIndex >= 0 && targetIndex >= 0) {
    const [moved] = list.splice(sourceIndex, 1);
    list.splice(targetIndex, 0, moved);
    list.forEach((item, index) => { item.task.dailySortOrder = index; });
    scheduleSave();
    renderShell();
  }
  draggedTaskId = null;
}

function handleDragEnd() {
  draggedTaskId = null;
  document.querySelectorAll(".is-dragging").forEach(item => item.classList.remove("is-dragging"));
}

function handlePointerDown(event) {
  if (event.pointerType === "mouse") return;
  const row = event.target.closest("#today-todo-list .task-row");
  if (!row) return;
  const handle = event.target.closest(".drag-handle");
  if (handle) {
    event.preventDefault();
    touchReorder = { pointerId: event.pointerId, row };
    row.classList.add("is-dragging");
    handle.setPointerCapture?.(event.pointerId);
    return;
  }
  if (!event.target.closest("button, input, select, textarea, a")) {
    swipeGesture = {
      pointerId: event.pointerId,
      taskId: row.dataset.taskId,
      startX: event.clientX,
      startY: event.clientY
    };
  }
}

function handlePointerMove(event) {
  if (!touchReorder || touchReorder.pointerId !== event.pointerId) return;
  event.preventDefault();
  const target = document.elementFromPoint(event.clientX, event.clientY)
    ?.closest("#today-todo-list .task-row");
  if (!target || target === touchReorder.row) return;
  const targetBounds = target.getBoundingClientRect();
  if (event.clientY < targetBounds.top + targetBounds.height / 2) {
    target.before(touchReorder.row);
  } else {
    target.after(touchReorder.row);
  }
}

function finishTouchReorder(event, cancelled = false) {
  if (!touchReorder || touchReorder.pointerId !== event.pointerId) return false;
  touchReorder.row.classList.remove("is-dragging");
  if (!cancelled) {
    const orderedIds = [...document.querySelectorAll("#today-todo-list .task-row")]
      .map(row => row.dataset.taskId);
    orderedIds.forEach((taskId, order) => {
      const context = findTaskContext(state, taskId);
      if (context) context.task.dailySortOrder = order;
    });
    scheduleSave();
  }
  touchReorder = null;
  renderShell();
  return true;
}

function handlePointerUp(event) {
  if (finishTouchReorder(event)) return;
  if (!swipeGesture || swipeGesture.pointerId !== event.pointerId) return;
  const horizontalDistance = event.clientX - swipeGesture.startX;
  const verticalDistance = event.clientY - swipeGesture.startY;
  const taskId = swipeGesture.taskId;
  swipeGesture = null;
  if (horizontalDistance < -64 && Math.abs(horizontalDistance) > Math.abs(verticalDistance) * 1.4) {
    deferTaskOneDay(state, taskId);
    scheduleSave();
    renderShell();
    showToast("任务已延后一天");
  }
}

function handlePointerCancel(event) {
  finishTouchReorder(event, true);
  if (swipeGesture?.pointerId === event.pointerId) swipeGesture = null;
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    try {
      const hadController = Boolean(navigator.serviceWorker.controller);
      let isRefreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || isRefreshing) return;
        isRefreshing = true;
        window.location.reload();
      });
      const registration = await navigator.serviceWorker.register(
        `./service-worker.js?v=${APP_VERSION}`,
        { scope: "./", updateViaCache: "none" }
      );
      await registration.update();
    } catch (error) {
      console.warn("Service worker registration failed", error);
    }
  }
}

async function initialize() {
  state = normalizeState(await loadPersistedState());
  const planResult = installBuiltinStudyPlan(state);
  runtime.tab = state.ui.selectedTab ?? "today";
  runtime.currentDateKey = dateKey();
  const deferredCount = runAutomaticDeferral(state);
  if (deferredCount || planResult.installed) await saveNow();
  applyAppearance();
  renderShell();
  startFocusTicker();
  await registerServiceWorker();

  appElement.addEventListener("click", handleClick);
  appElement.addEventListener("submit", handleSubmit);
  appElement.addEventListener("input", handleInput);
  appElement.addEventListener("change", handleChange);
  appElement.addEventListener("dragstart", handleDragStart);
  appElement.addEventListener("dragover", handleDragOver);
  appElement.addEventListener("drop", handleDrop);
  appElement.addEventListener("dragend", handleDragEnd);
  appElement.addEventListener("pointerdown", handlePointerDown);
  appElement.addEventListener("pointermove", handlePointerMove);
  appElement.addEventListener("pointerup", handlePointerUp);
  appElement.addEventListener("pointercancel", handlePointerCancel);
  modalRoot.addEventListener("click", handleClick);
  modalRoot.addEventListener("submit", handleSubmit);
  modalRoot.addEventListener("change", handleChange);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && runtime.modal) closeModal();
  });
  window.addEventListener("online", renderShell);
  window.addEventListener("offline", renderShell);
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveEmergencySnapshot(state);
    else refreshCurrentDay();
  });
  window.addEventListener("focus", refreshCurrentDay);
  window.addEventListener("pagehide", () => saveEmergencySnapshot(state));

  if (planResult.installed) showToast(`已写入 ${planResult.taskCount} 项四科备考计划`);
  else if (deferredCount) showToast(`已自动顺延 ${deferredCount} 项逾期任务`);
}

initialize().catch(error => {
  console.error(error);
  appElement.innerHTML = `<main class="fatal-state"><h1>无法打开备考看板</h1><p>${escapeHTML(error.message)}</p><button onclick="location.reload()">重新加载</button></main>`;
});
