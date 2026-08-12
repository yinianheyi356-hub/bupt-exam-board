const DATABASE_NAME = "bupt-exam-board";
const DATABASE_VERSION = 2;
const STORE_NAME = "key-value";
const ATTACHMENT_STORE_NAME = "task-attachments";
const STATE_KEY = "current-state";
const LOCAL_STORAGE_KEY = "bupt-exam-board-state";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
      if (!database.objectStoreNames.contains(ATTACHMENT_STORE_NAME)) {
        const attachments = database.createObjectStore(ATTACHMENT_STORE_NAME, { keyPath: "id" });
        attachments.createIndex("taskId", "taskId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开本地数据库"));
  });
}

async function runStoreTransaction(storeName, mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);
      let result;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error ?? new Error("本地数据库操作失败"));
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error ?? new Error("本地数据库事务已取消"));
      transaction.onerror = () => reject(transaction.error ?? new Error("本地数据库事务失败"));
    });
  } finally {
    database.close();
  }
}

async function runTransaction(mode, operation) {
  return runStoreTransaction(STORE_NAME, mode, operation);
}

export async function loadPersistedState() {
  const fallback = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (fallback) {
    try {
      const parsed = JSON.parse(fallback);
      try {
        await runTransaction("readwrite", store => store.put(parsed, STATE_KEY));
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch {
        // IndexedDB 仍不可用时继续使用最新的 localStorage 副本。
      }
      return parsed;
    } catch {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }
  try {
    const stored = await runTransaction("readonly", store => store.get(STATE_KEY));
    return stored ?? null;
  } catch {
    return null;
  }
}

export async function savePersistedState(state) {
  const snapshot = JSON.parse(JSON.stringify(state));
  try {
    await runTransaction("readwrite", store => store.put(snapshot, STATE_KEY));
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot));
  }
}

export async function clearPersistedState() {
  try {
    const database = await openDatabase();
    try {
      await new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME, ATTACHMENT_STORE_NAME], "readwrite");
        transaction.objectStore(STORE_NAME).delete(STATE_KEY);
        transaction.objectStore(ATTACHMENT_STORE_NAME).clear();
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error ?? new Error("本地数据清除失败"));
        transaction.onerror = () => reject(transaction.error ?? new Error("本地数据清除失败"));
      });
    } finally {
      database.close();
    }
  } catch {
    // localStorage 回退仍会在下方清除。
  }
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

export function saveEmergencySnapshot(state) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储空间不足时，保留最近一次已提交到 IndexedDB 的版本。
  }
}

export async function saveTaskAttachment(taskId, file) {
  const id = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const record = {
    id,
    taskId,
    name: file.name || "未命名附件",
    type: file.type || "application/octet-stream",
    size: file.size,
    createdAt: new Date().toISOString(),
    blob: file
  };
  await runStoreTransaction(ATTACHMENT_STORE_NAME, "readwrite", store => store.put(record));
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    size: record.size,
    createdAt: record.createdAt
  };
}

export async function loadTaskAttachment(attachmentId) {
  return runStoreTransaction(
    ATTACHMENT_STORE_NAME,
    "readonly",
    store => store.get(attachmentId)
  );
}

export async function deleteTaskAttachment(attachmentId) {
  return runStoreTransaction(
    ATTACHMENT_STORE_NAME,
    "readwrite",
    store => store.delete(attachmentId)
  );
}

export async function deleteTaskAttachments(attachmentIds = []) {
  if (!attachmentIds.length) return;
  const database = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(ATTACHMENT_STORE_NAME, "readwrite");
      const store = transaction.objectStore(ATTACHMENT_STORE_NAME);
      attachmentIds.forEach(id => store.delete(id));
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error ?? new Error("附件删除失败"));
      transaction.onerror = () => reject(transaction.error ?? new Error("附件删除失败"));
    });
  } finally {
    database.close();
  }
}

export function downloadBackup(state) {
  const content = JSON.stringify({
    format: "BUPTExamBoardPWA",
    version: 1,
    exportedAt: new Date().toISOString(),
    state
  }, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `BUPTExamBoard-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
}

export async function readBackup(file) {
  const parsed = JSON.parse(await file.text());
  if (parsed?.format !== "BUPTExamBoardPWA" || !parsed.state) {
    throw new Error("这不是有效的备考看板备份文件");
  }
  return parsed.state;
}
