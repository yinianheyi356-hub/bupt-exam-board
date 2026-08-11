export const TASK_STATUSES = [
  { value: "notStarted", label: "未开始" },
  { value: "inProgress", label: "进行中" },
  { value: "needsReview", label: "待复习" },
  { value: "completed", label: "已完成" }
];

export const TASK_PRIORITIES = [
  { value: "low", label: "低" },
  { value: "normal", label: "普通" },
  { value: "high", label: "高" },
  { value: "urgent", label: "紧急" }
];

export const REVIEW_DAY_OFFSETS = [1, 2, 4, 7, 15];

export function createId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateTimeValue(date) {
  if (!date) return "";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "";
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isSameDay(value, comparison = new Date()) {
  if (!value) return false;
  return dateKey(new Date(value)) === dateKey(comparison);
}

export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / 86_400_000);
}

function nextExamDate() {
  const now = new Date();
  let result = new Date(now.getFullYear(), 11, 20);
  if (result < startOfDay(now)) result = new Date(now.getFullYear() + 1, 11, 20);
  return dateKey(result);
}

function seedSubject(name, color, sortOrder) {
  return {
    id: createId(),
    name,
    notes: "",
    color,
    weight: 1,
    targetStudyMinutes: 0,
    sortOrder,
    archived: false,
    modules: []
  };
}

export function createDefaultState() {
  return {
    schemaVersion: 1,
    settings: {
      examName: "北京邮电大学新闻与传播考研",
      targetSchool: "北京邮电大学",
      targetMajor: "新闻与传播",
      preparationStartDate: dateKey(),
      examDate: nextExamDate(),
      dailyGoalMinutes: 480,
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreak: false,
      autoStartFocus: false,
      automaticReview: true,
      automaticDeferral: true,
      notificationsEnabled: false,
      appearance: "system"
    },
    dailyNotes: {},
    subjects: [
      seedSubject("思想政治理论", "#8a4b4b", 0),
      seedSubject("英语二", "#315a7d", 1),
      seedSubject("334 新闻与传播专业综合能力", "#1f5d42", 2),
      seedSubject("440 新闻与传播专业基础", "#8a6a32", 3)
    ],
    tags: [],
    pomodoroRecords: [],
    ui: {
      selectedTab: "today",
      boardExpanded: {}
    }
  };
}

export function normalizeState(candidate) {
  const defaults = createDefaultState();
  if (!candidate || typeof candidate !== "object") return defaults;

  const state = {
    ...defaults,
    ...candidate,
    settings: { ...defaults.settings, ...(candidate.settings ?? {}) },
    dailyNotes: candidate.dailyNotes && typeof candidate.dailyNotes === "object"
      ? candidate.dailyNotes
      : {},
    subjects: Array.isArray(candidate.subjects) ? candidate.subjects : defaults.subjects,
    tags: Array.isArray(candidate.tags) ? candidate.tags : [],
    pomodoroRecords: Array.isArray(candidate.pomodoroRecords)
      ? candidate.pomodoroRecords
      : [],
    ui: { ...defaults.ui, ...(candidate.ui ?? {}) }
  };

  state.subjects.forEach((subject, subjectIndex) => {
    subject.modules = Array.isArray(subject.modules) ? subject.modules : [];
    subject.sortOrder ??= subjectIndex;
    subject.modules.forEach((module, moduleIndex) => {
      module.chapters = Array.isArray(module.chapters) ? module.chapters : [];
      module.sortOrder ??= moduleIndex;
      module.chapters.forEach((chapter, chapterIndex) => {
        chapter.tasks = Array.isArray(chapter.tasks) ? chapter.tasks : [];
        chapter.sortOrder ??= chapterIndex;
        chapter.tasks.forEach((task, taskIndex) => {
          task.sortOrder ??= taskIndex;
          task.dailySortOrder ??= taskIndex;
          task.tags = Array.isArray(task.tags) ? task.tags : [];
          task.accumulatedFocusSeconds ??= 0;
          task.automaticReview ??= true;
          task.isReview ??= false;
          task.reviewStage ??= 0;
        });
      });
    });
  });
  return state;
}

export function getTaskContexts(state, options = {}) {
  const includeArchived = options.includeArchived ?? false;
  const contexts = [];
  for (const subject of state.subjects) {
    if (!includeArchived && subject.archived) continue;
    for (const module of subject.modules ?? []) {
      if (!includeArchived && module.archived) continue;
      for (const chapter of module.chapters ?? []) {
        if (!includeArchived && chapter.archived) continue;
        for (const task of chapter.tasks ?? []) {
          contexts.push({ subject, module, chapter, task });
        }
      }
    }
  }
  return contexts;
}

export function findContext(state, identifiers = {}) {
  const subject = state.subjects.find(item => item.id === identifiers.subjectId);
  if (!subject) return {};
  const module = subject.modules?.find(item => item.id === identifiers.moduleId);
  if (!module) return { subject };
  const chapter = module.chapters?.find(item => item.id === identifiers.chapterId);
  if (!chapter) return { subject, module };
  const task = chapter.tasks?.find(item => item.id === identifiers.taskId);
  return { subject, module, chapter, task };
}

export function findTaskContext(state, taskId) {
  return getTaskContexts(state, { includeArchived: true })
    .find(context => context.task.id === taskId) ?? null;
}

export function hierarchyProgress(subjectOrModuleOrChapter) {
  const calculate = node => {
    if (Array.isArray(node.tasks)) {
      const tasks = node.tasks.filter(task => !task.isReview);
      if (!tasks.length) return { value: 0, completed: 0, total: 0 };
      const totalWeight = tasks.reduce((sum, task) => sum + Math.max(Number(task.weight) || 0, 0), 0);
      const completedWeight = tasks
        .filter(task => task.status === "completed")
        .reduce((sum, task) => sum + Math.max(Number(task.weight) || 0, 0), 0);
      const completed = tasks.filter(task => task.status === "completed").length;
      return {
        value: totalWeight > 0 ? completedWeight / totalWeight : completed / tasks.length,
        completed,
        total: tasks.length
      };
    }
    const children = Array.isArray(node.modules) ? node.modules : node.chapters ?? [];
    if (!children.length) return { value: 0, completed: 0, total: 0 };
    const results = children.map(child => ({
      progress: calculate(child),
      weight: Math.max(Number(child.weight) || 0, 0)
    }));
    const totalWeight = results.reduce((sum, item) => sum + item.weight, 0);
    const value = totalWeight > 0
      ? results.reduce((sum, item) => sum + item.progress.value * item.weight, 0) / totalWeight
      : results.reduce((sum, item) => sum + item.progress.value, 0) / results.length;
    return {
      value,
      completed: results.reduce((sum, item) => sum + item.progress.completed, 0),
      total: results.reduce((sum, item) => sum + item.progress.total, 0)
    };
  };
  return calculate(subjectOrModuleOrChapter);
}

export function createModule(name, sortOrder = 0) {
  return {
    id: createId(), name, notes: "", weight: 1, sortOrder, archived: false, chapters: []
  };
}

export function createChapter(name, sortOrder = 0) {
  return {
    id: createId(), name, notes: "", weight: 1, sortOrder, archived: false, tasks: []
  };
}

export function createTask(values = {}, sortOrder = 0) {
  return {
    id: createId(),
    title: values.title ?? "",
    details: values.details ?? "",
    status: values.status ?? "notStarted",
    priority: values.priority ?? "normal",
    weight: Number(values.weight) || 1,
    sortOrder,
    dailySortOrder: sortOrder,
    scheduledAt: values.scheduledAt || null,
    dueAt: values.dueAt || null,
    estimatedMinutes: Number(values.estimatedMinutes) || 25,
    accumulatedFocusSeconds: Number(values.accumulatedFocusSeconds) || 0,
    completedAt: values.completedAt || null,
    automaticReview: values.automaticReview ?? true,
    isReview: values.isReview ?? false,
    reviewStage: Number(values.reviewStage) || 0,
    sourceTaskId: values.sourceTaskId || null,
    tags: Array.isArray(values.tags) ? values.tags : [],
    deferCount: Number(values.deferCount) || 0,
    lastDeferredAt: values.lastDeferredAt || null,
    createdAt: values.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function generateReviewTasks(state, sourceContext, completedAt = new Date()) {
  const { task, chapter } = sourceContext;
  if (!state.settings.automaticReview || !task.automaticReview || task.isReview) return 0;
  const existingStages = new Set(
    getTaskContexts(state, { includeArchived: true })
      .filter(item => item.task.isReview && item.task.sourceTaskId === task.id)
      .map(item => item.task.reviewStage)
  );
  let generated = 0;
  const baseDate = startOfDay(completedAt);
  REVIEW_DAY_OFFSETS.forEach((offset, index) => {
    const stage = index + 1;
    if (existingStages.has(stage)) return;
    const reviewDate = addDays(baseDate, offset).toISOString();
    chapter.tasks.push(createTask({
      title: `复习 ${stage}/${REVIEW_DAY_OFFSETS.length}：${task.title || "未命名任务"}`,
      details: `由“${task.title || "未命名任务"}”自动生成的第 ${stage} 次复习。`,
      status: "needsReview",
      priority: task.priority,
      weight: task.weight,
      scheduledAt: reviewDate,
      dueAt: reviewDate,
      estimatedMinutes: task.estimatedMinutes,
      automaticReview: false,
      isReview: true,
      reviewStage: stage,
      sourceTaskId: task.id,
      tags: [...task.tags]
    }, chapter.tasks.length));
    generated += 1;
  });
  return generated;
}

export function completeTask(state, taskId, completedAt = new Date()) {
  const context = findTaskContext(state, taskId);
  if (!context || context.task.status === "completed") return false;
  context.task.status = "completed";
  context.task.completedAt = completedAt.toISOString();
  context.task.updatedAt = completedAt.toISOString();
  generateReviewTasks(state, context, completedAt);
  return true;
}

export function deferTaskOneDay(state, taskId, now = new Date()) {
  const context = findTaskContext(state, taskId);
  if (!context) return false;
  const task = context.task;
  if (task.scheduledAt) task.scheduledAt = addDays(new Date(task.scheduledAt), 1).toISOString();
  if (task.dueAt) task.dueAt = addDays(new Date(task.dueAt), 1).toISOString();
  if (!task.scheduledAt && !task.dueAt) task.dueAt = addDays(now, 1).toISOString();
  task.deferCount = (task.deferCount ?? 0) + 1;
  task.lastDeferredAt = now.toISOString();
  task.updatedAt = now.toISOString();
  return true;
}

export function runAutomaticDeferral(state, now = new Date()) {
  if (!state.settings.automaticDeferral) return 0;
  const today = startOfDay(now);
  let changed = 0;
  for (const { task } of getTaskContexts(state)) {
    if (task.isReview || ["completed", "needsReview"].includes(task.status)) continue;
    const dates = [task.scheduledAt, task.dueAt].filter(Boolean).map(value => new Date(value));
    if (!dates.length) continue;
    const earliest = new Date(Math.min(...dates));
    if (startOfDay(earliest) >= today) continue;
    const offset = daysBetween(earliest, today);
    if (task.scheduledAt) task.scheduledAt = addDays(new Date(task.scheduledAt), offset).toISOString();
    if (task.dueAt) task.dueAt = addDays(new Date(task.dueAt), offset).toISOString();
    task.deferCount = (task.deferCount ?? 0) + 1;
    task.lastDeferredAt = now.toISOString();
    task.updatedAt = now.toISOString();
    changed += 1;
  }
  return changed;
}

export function todaySections(state, now = new Date()) {
  const contexts = getTaskContexts(state);
  const pending = contexts.filter(({ task }) => task.status !== "completed");
  const timeline = pending
    .filter(({ task }) => !task.isReview && task.status !== "needsReview" && isSameDay(task.scheduledAt, now))
    .sort((a, b) => new Date(a.task.scheduledAt) - new Date(b.task.scheduledAt));
  const todo = pending
    .filter(({ task }) => (
      !task.isReview
      && task.status !== "needsReview"
      && isSameDay(task.dueAt, now)
      && !isSameDay(task.scheduledAt, now)
    ))
    .sort((a, b) => (a.task.dailySortOrder ?? 0) - (b.task.dailySortOrder ?? 0));
  const endOfToday = addDays(startOfDay(now), 1);
  const reviews = pending
    .filter(({ task }) => {
      if (!task.isReview && task.status !== "needsReview") return false;
      const date = task.dueAt ?? task.scheduledAt;
      return !date || new Date(date) < endOfToday;
    })
    .sort((a, b) => new Date(a.task.dueAt ?? 0) - new Date(b.task.dueAt ?? 0));
  return { timeline, todo, reviews };
}

export function activeFocusRecord(state) {
  return state.pomodoroRecords.find(record => record.state === "running") ?? null;
}

export function focusSnapshot(record, now = new Date()) {
  if (!record) return { elapsedSeconds: 0, remainingSeconds: 0, progress: 0 };
  const endpoint = record.pausedAt ? new Date(record.pausedAt) : now;
  const wallSeconds = Math.max(0, Math.floor((endpoint - new Date(record.startedAt)) / 1_000));
  const elapsedSeconds = Math.min(
    Math.max(0, wallSeconds - Math.max(record.pausedSeconds ?? 0, 0)),
    record.plannedSeconds
  );
  return {
    elapsedSeconds,
    remainingSeconds: Math.max(record.plannedSeconds - elapsedSeconds, 0),
    progress: record.plannedSeconds > 0 ? elapsedSeconds / record.plannedSeconds : 0
  };
}

export function startFocusRecord(state, type, taskId = null, now = new Date()) {
  if (activeFocusRecord(state)) return null;
  const durations = {
    focus: state.settings.focusMinutes,
    shortBreak: state.settings.shortBreakMinutes,
    longBreak: state.settings.longBreakMinutes
  };
  const context = taskId ? findTaskContext(state, taskId) : null;
  const record = {
    id: createId(),
    type,
    state: "running",
    startedAt: now.toISOString(),
    endedAt: null,
    plannedSeconds: Math.max(Number(durations[type]) || 1, 1) * 60,
    focusedSeconds: 0,
    pausedSeconds: 0,
    pausedAt: null,
    taskId: context?.task.id ?? null,
    taskTitle: context?.task.title ?? "",
    subjectId: context?.subject.id ?? null,
    subjectName: context?.subject.name ?? "自由专注",
    interruptions: []
  };
  state.pomodoroRecords.push(record);
  return record;
}

export function pauseFocusRecord(record, reason = "临时暂停", note = "", now = new Date()) {
  if (!record || record.state !== "running" || record.pausedAt) return false;
  record.pausedAt = now.toISOString();
  record.interruptions.push({
    id: createId(), reason, note, occurredAt: now.toISOString(), endedAt: null, durationSeconds: 0
  });
  return true;
}

export function resumeFocusRecord(record, now = new Date()) {
  if (!record?.pausedAt || record.state !== "running") return false;
  const pauseSeconds = Math.max(0, Math.floor((now - new Date(record.pausedAt)) / 1_000));
  record.pausedSeconds = (record.pausedSeconds ?? 0) + pauseSeconds;
  const interruption = [...record.interruptions].reverse().find(item => !item.endedAt);
  if (interruption) {
    interruption.endedAt = now.toISOString();
    interruption.durationSeconds = pauseSeconds;
  }
  record.pausedAt = null;
  return true;
}

export function finishFocusRecord(state, record, finalState = "completed", now = new Date()) {
  if (!record || record.state !== "running") return false;
  if (record.pausedAt) resumeFocusRecord(record, now);
  const snapshot = focusSnapshot(record, now);
  record.state = finalState;
  record.endedAt = now.toISOString();
  record.focusedSeconds = finalState === "cancelled"
    ? 0
    : finalState === "completed"
      ? record.plannedSeconds
      : snapshot.elapsedSeconds;
  if (record.type === "focus" && finalState !== "cancelled" && record.taskId) {
    const context = findTaskContext(state, record.taskId);
    if (context) {
      context.task.accumulatedFocusSeconds = (context.task.accumulatedFocusSeconds ?? 0)
        + record.focusedSeconds;
      context.task.updatedAt = now.toISOString();
    }
  }
  return true;
}

export function suggestedBreakType(state) {
  let completedFocus = 0;
  const records = [...state.pomodoroRecords].reverse();
  for (const record of records) {
    if (record.type === "longBreak" && record.state === "completed") break;
    if (record.type === "focus" && record.state === "completed") completedFocus += 1;
  }
  return completedFocus > 0
    && completedFocus % Math.max(state.settings.sessionsBeforeLongBreak, 1) === 0
    ? "longBreak"
    : "shortBreak";
}

export function durationText(seconds) {
  const safe = Math.max(Number(seconds) || 0, 0);
  const hours = Math.floor(safe / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  if (hours && minutes) return `${hours} 小时 ${minutes} 分钟`;
  if (hours) return `${hours} 小时`;
  if (minutes) return `${minutes} 分钟`;
  return safe ? "不足 1 分钟" : "0 分钟";
}

export function statisticsForRange(state, range, now = new Date()) {
  const days = range === "day" ? 1 : range === "week" ? 7 : 30;
  const start = addDays(startOfDay(now), -(days - 1));
  const end = addDays(startOfDay(now), 1);
  const records = state.pomodoroRecords.filter(record => {
    const date = new Date(record.endedAt ?? record.startedAt);
    return record.type === "focus"
      && ["completed", "endedEarly"].includes(record.state)
      && record.focusedSeconds > 0
      && date >= start
      && date < end;
  });
  const totalSeconds = records.reduce((sum, record) => sum + record.focusedSeconds, 0);
  const buckets = Array.from({ length: days }, (_, index) => {
    const day = addDays(start, index);
    return {
      key: dateKey(day),
      label: days === 1 ? "今日" : `${day.getMonth() + 1}/${day.getDate()}`,
      seconds: records
        .filter(record => dateKey(new Date(record.endedAt ?? record.startedAt)) === dateKey(day))
        .reduce((sum, record) => sum + record.focusedSeconds, 0)
    };
  });
  const subjectMap = new Map();
  records.forEach(record => {
    const key = record.subjectId || "free-focus";
    const currentSubject = state.subjects.find(subject => subject.id === record.subjectId);
    const item = subjectMap.get(key) ?? {
      name: currentSubject?.name || record.subjectName || "自由专注",
      seconds: 0
    };
    item.seconds += record.focusedSeconds;
    subjectMap.set(key, item);
  });
  const tasks = getTaskContexts(state).filter(({ task }) => !task.isReview);
  const relevantTasks = tasks.filter(({ task }) => {
    const date = new Date(task.dueAt ?? task.scheduledAt ?? task.createdAt);
    return date >= start && date < end;
  });
  const completedTasks = relevantTasks.filter(({ task }) => task.status === "completed").length;
  const studiedDays = new Set(
    state.pomodoroRecords
      .filter(record => (
        record.type === "focus"
        && ["completed", "endedEarly"].includes(record.state)
        && record.focusedSeconds > 0
      ))
      .map(record => dateKey(new Date(record.endedAt ?? record.startedAt)))
  );
  let streak = 0;
  let cursor = startOfDay(now);
  if (!studiedDays.has(dateKey(cursor))) cursor = addDays(cursor, -1);
  while (studiedDays.has(dateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  const weakTasks = tasks
    .filter(({ task }) => task.status !== "completed")
    .map(context => ({
      ...context,
      progress: Math.min(
        (context.task.accumulatedFocusSeconds ?? 0)
          / Math.max((context.task.estimatedMinutes ?? 25) * 60, 1),
        1
      )
    }))
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 5);
  return {
    totalSeconds,
    buckets,
    subjectShares: [...subjectMap.values()]
      .sort((a, b) => b.seconds - a.seconds),
    relevantTaskCount: relevantTasks.length,
    completedTaskCount: completedTasks,
    completionRate: relevantTasks.length ? completedTasks / relevantTasks.length : 0,
    streak,
    weakTasks
  };
}
