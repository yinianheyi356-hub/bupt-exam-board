const DATABASE_NAME = "bupt-exam-board";
const DATABASE_VERSION = 1;
const STORE_NAME = "key-value";
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
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开本地数据库"));
  });
}

async function runTransaction(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
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
    await runTransaction("readwrite", store => store.delete(STATE_KEY));
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
