import { addDays, createId, dateKey, startOfDay } from "./domain.js";

/**
 * 英语生词的间隔重复配置。stage 表示已经连续记住的阶段，0 表示新词。
 * 间隔全部按用户本地日期计算，避免夏令时或时区切换导致日期漂移。
 */
export const VOCABULARY_INTERVALS = [1, 2, 4, 7, 15, 30, 60, 120];
export const VOCABULARY_STATUSES = ["new", "learning", "reviewing", "mastered", "archived"];
export const REVIEW_RESULTS = ["remembered", "forgotten", "mastered", "undo"];

export const VOCABULARY_PROMPT = `你是一名考研英语生词整理助手。接下来我会提供一张或多张考研英语做题留痕图片。

请严格执行以下规则：

1. 只提取被黄色高亮标记的英文单词或英文短语。
2. 忽略其他颜色的高亮、下划线、圈画、批注和没有黄色高亮的内容。
3. 根据文章上下文还原词条原型：
   - 名词通常还原为单数；
   - 动词还原为原形；
   - 形容词、副词保留基本形式；
   - 固定搭配、习语和短语动词作为完整词条保留。
4. 找到高亮词所在的完整英文原句，并从句首到句末准确抄录。
5. 如果词条来自选择题选项、图片中没有包含它所在的上下文：
   - 先检索可核验的往年考研英语真题原句；找到时必须同时写明真实年份、英语一/英语二和文章位置，并保持原句原有拼写、大小写和标点；
   - 如果无法找到可核验的真题原句，再自行造一个符合考研语境的英文例句；此时必须在原句开头标记“【AI自拟例句】”，不得把自拟句伪装成真题原句，也不要编造年份或文章位置。
6. 真题原句保留原有的拼写、大小写和标点，不翻译、不改写、不补写图片中未显示的内容；AI 自拟例句必须明确带有“【AI自拟例句】”标记。
7. 自动合并因文章排版换行而断开的单词。
8. 输出三列表格：
   - 第一列：单词原型或完整短语；
   - 第二列：词性与中文词义；
   - 第三列：黄色高亮词所在的完整真题原句。
9. 词义要求：
   - 标明词性；
   - 将本句中的语境义放在最前并标记为‘语境义’；
   - 补充考研英语可能出现的常见义和生僻义；
   - 多个词性或词义使用分号分隔；
   - 词义准确、全面、简洁。
10. 同一句中存在多个黄色高亮词时，每个词单独占一行，并分别保留完整原句。
11. 同一个词出现在不同原句中时分别保留，不要删除，以便系统记录多个真题来源。
12. 不要提取没有被黄色高亮的单词。
13. 如果无法确定拼写、原型、真题出处或例句内容，将内容放入待确认项，不要伪造出处。
14. 最后追加一个TSV代码块，表头为：
词条\t词性与词义\t真题原句
三列之间使用一个制表符，不要添加序号。`;

export const VOCABULARY_COMPLETION_PROMPT = `你是一名考研英语真题例句补全助手。下面是一些来自考研英语选择题选项的生词，它们在原图片中没有完整上下文。

请对每个词条按以下顺序处理：
1. 优先检索可核验的历年考研英语真题原句；只有能够确认年份、英语一/英语二、文章位置和原句的，才可以标记为“真题原句”。
2. 找不到可核验真题原句时，写一个自然、准确、符合考研阅读语境的英文例句，并在句首添加“【AI自拟例句】”。不得编造年份、试卷类型、文章位置或虚假的真题出处。
3. 保留词条原型，不要改变词义；输出时每个词条一行。
4. 输出 TSV 代码块，严格使用以下四列表头（制表符分隔）：
词条\t词性与词义\t真题原句\t来源类型
5. 来源类型只能填写“真题原句”或“AI自拟例句”。如果仍无法确定，填写“待确认”，不要猜测。

待补全词条：
{{TERMS}}

导入看板时，前三列仍可直接粘贴到生词导入框；第四列只用于核对来源。`;

function parseSentenceOrigin(sentence) {
  const value = String(sentence ?? "").trim();
  if (!value) return { sentence: "", sentenceOrigin: "missing" };
  const aiMarker = /^(?:【AI自拟例句】|\[AI自拟例句\]|AI自拟例句[:：]\s*)/i;
  if (aiMarker.test(value)) {
    return { sentence: value.replace(aiMarker, "").trim(), sentenceOrigin: "ai-generated" };
  }
  return { sentence: value, sentenceOrigin: "exam" };
}

export function vocabularyCompletionPrompt(rows = [], metadata = {}) {
  const terms = rows
    .filter(row => !row.sentence || row.errors?.includes("原句缺失"))
    .map(row => `- ${row.term || "（待确认词条）"}${row.definition ? `：${row.definition}` : ""}`)
    .join("\n");
  return VOCABULARY_COMPLETION_PROMPT
    .replace("{{TERMS}}", terms || "- （没有待补全词条）")
    .replace("考研英语选择题选项", `${metadata.examType || "考研英语"}${metadata.year ? ` ${metadata.year}` : ""} 选择题选项`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeVocabularyTerm(term) {
  return String(term ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function createVocabularyState(existing = {}) {
  return {
    items: Array.isArray(existing.items) ? existing.items : [],
    sources: Array.isArray(existing.sources) ? existing.sources : [],
    reviewRecords: Array.isArray(existing.reviewRecords) ? existing.reviewRecords : [],
    importBatches: Array.isArray(existing.importBatches) ? existing.importBatches : [],
    session: existing.session && typeof existing.session === "object" ? existing.session : null
  };
}

export function normalizeVocabularyState(state) {
  state.vocabulary = createVocabularyState(state.vocabulary);
  if (!state.vocabulary.session || typeof state.vocabulary.session !== "object") {
    state.vocabulary.session = null;
  } else {
    state.vocabulary.session = {
      dateKey: state.vocabulary.session.dateKey || "",
      deferredIds: Array.isArray(state.vocabulary.session.deferredIds) ? state.vocabulary.session.deferredIds : []
    };
  }
  const now = new Date().toISOString();
  state.vocabulary.items = state.vocabulary.items
    .filter(item => item && typeof item === "object")
    .map(item => ({
      id: item.id || createId(),
      term: String(item.term ?? "").trim(),
      normalizedTerm: normalizeVocabularyTerm(item.term),
      definition: String(item.definition ?? "").trim(),
      status: VOCABULARY_STATUSES.includes(item.status) ? item.status : "new",
      stage: Math.max(0, Number(item.stage) || 0),
      consecutiveRemembered: Math.max(0, Number(item.consecutiveRemembered) || 0),
      consecutiveForgotten: Math.max(0, Number(item.consecutiveForgotten) || 0),
      totalReviews: Math.max(0, Number(item.totalReviews) || 0),
      rememberedCount: Math.max(0, Number(item.rememberedCount) || 0),
      forgottenCount: Math.max(0, Number(item.forgottenCount) || 0),
      lastReviewedAt: item.lastReviewedAt || null,
      nextReviewAt: item.nextReviewAt || null,
      masteredAt: item.masteredAt || null,
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || now,
      note: String(item.note ?? ""),
      archivedAt: item.archivedAt || null,
      todayAgain: Boolean(item.todayAgain),
      lastImportBatchId: item.lastImportBatchId || null
    }));
  state.vocabulary.sources = state.vocabulary.sources
    .filter(source => source && typeof source === "object")
    .map(source => ({
      id: source.id || createId(),
      vocabularyItemId: source.vocabularyItemId || "",
      year: String(source.year ?? "").trim(),
      examType: source.examType === "英语一" ? "英语一" : "英语二",
      section: String(source.section ?? "").trim(),
      originalSentence: String(source.originalSentence ?? "").trim(),
      sentenceOrigin: ["exam", "ai-generated", "missing"].includes(source.sentenceOrigin)
        ? source.sentenceOrigin
        : (String(source.originalSentence ?? "").trim() ? "exam" : "missing"),
      surfaceForm: String(source.surfaceForm ?? "").trim(),
      highlightText: String(source.highlightText ?? "").trim(),
      note: String(source.note ?? ""),
      importedAt: source.importedAt || now,
      taskId: source.taskId || null
    }));
  state.vocabulary.reviewRecords = state.vocabulary.reviewRecords
    .filter(record => record && typeof record === "object")
    .map(record => ({
      id: record.id || createId(),
      vocabularyItemId: record.vocabularyItemId || "",
      result: REVIEW_RESULTS.includes(record.result) ? record.result : "remembered",
      reviewedAt: record.reviewedAt || now,
      previousStage: Number(record.previousStage) || 0,
      nextStage: Number(record.nextStage) || 0,
      previousNextReviewAt: record.previousNextReviewAt || null,
      nextReviewAt: record.nextReviewAt || null,
      sourceId: record.sourceId || null,
      undoneAt: record.undoneAt || null,
      previousState: record.previousState && typeof record.previousState === "object" ? record.previousState : null,
      undoOf: record.undoOf || null
    }));
  state.vocabulary.importBatches = state.vocabulary.importBatches
    .filter(batch => batch && typeof batch === "object")
    .map(batch => ({
      id: batch.id || createId(),
      year: String(batch.year ?? "").trim(),
      examType: batch.examType === "英语一" ? "英语一" : "英语二",
      section: String(batch.section ?? "").trim(),
      originalText: String(batch.originalText ?? ""),
      addedCount: Number(batch.addedCount) || 0,
      mergedCount: Number(batch.mergedCount) || 0,
      skippedCount: Number(batch.skippedCount) || 0,
      failedCount: Number(batch.failedCount) || 0,
      importedAt: batch.importedAt || now
    }));
  return state.vocabulary;
}

function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function splitLines(text) {
  return String(text ?? "")
    .replace(/^```(?:tsv|csv|markdown)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

// 在移动端把长任务拆成多个小批次，给浏览器机会处理触摸、绘制和内存回收。
// 这不会限制导入数量，只是避免一次循环长时间占满主线程。
function yieldToBrowser() {
  return new Promise(resolve => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(resolve, { timeout: 16 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function isSeparatorRow(cells) {
  return cells.length >= 2 && cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function headerIndexes(cells) {
  const normalized = cells.map(cell => cell.replace(/[\s*`]/g, "").toLocaleLowerCase());
  const term = normalized.findIndex(value => /^(词条|单词|term|word)$/.test(value));
  const definition = normalized.findIndex(value => /^(词性与词义|词义|释义|definition|meaning)$/.test(value));
  const sentence = normalized.findIndex(value => /^(真题原句|原句|句子|sentence|originalsentence)$/.test(value));
  return {
    term: term >= 0 ? term : 0,
    definition: definition >= 0 ? definition : 1,
    sentence: sentence >= 0 ? sentence : 2
  };
}

/** 解析 Markdown 三列表格、TSV 或 CSV，永远不在解析阶段写入词库。 */
export function parseVocabularyInput(text) {
  const lines = splitLines(text);
  if (!lines.length) return { rows: [], errors: ["输入内容为空"], format: "unknown" };
  const looksMarkdown = lines.some(line => line.includes("|") && line.split("|").length >= 3);
  const delimiter = looksMarkdown ? "|" : lines.some(line => line.includes("\t")) ? "\t" : ",";
  const format = looksMarkdown ? "markdown" : delimiter === "\t" ? "tsv" : "csv";
  const rows = [];
  let cellsList = lines.map(line => {
    const cells = parseDelimitedLine(line, delimiter);
    return looksMarkdown ? cells.slice(cells[0] === "" ? 1 : 0, cells.at(-1) === "" ? -1 : undefined) : cells;
  });
  if (isSeparatorRow(cellsList[1] ?? [])) cellsList = [cellsList[0], ...cellsList.slice(2)];
  const indexes = headerIndexes(cellsList[0]);
  const hasHeader = cellsList[0].some(cell => /词条|词性|词义|原句|term|definition|sentence/i.test(cell));
  const dataRows = hasHeader ? cellsList.slice(1) : cellsList;
  for (const cells of dataRows) {
    if (cells.every(cell => !cell)) continue;
    if (cells.length < 3) {
      rows.push({ term: cells[0] ?? "", definition: cells[1] ?? "", sentence: cells[2] ?? "", parseError: "列数不足三列" });
      continue;
    }
    rows.push({
      term: cells[indexes.term] ?? "",
      definition: cells[indexes.definition] ?? "",
      sentence: cells[indexes.sentence] ?? ""
    });
  }
  if (!rows.length) return { rows: [], errors: ["未识别到有效的三列表格、TSV 或 CSV"], format };
  return { rows, errors: [], format };
}

/**
 * 异步解析版本。普通小清单仍可使用同步版本；移动端导入较长 AI 输出时，
 * 每批让出主线程，避免 Safari 因长时间无响应而回收页面。
 */
export async function parseVocabularyInputAsync(text, options = {}) {
  const lines = splitLines(text);
  if (!lines.length) return { rows: [], errors: ["输入内容为空"], format: "unknown" };
  const looksMarkdown = lines.some(line => line.includes("|") && line.split("|").length >= 3);
  const delimiter = looksMarkdown ? "|" : lines.some(line => line.includes("\t")) ? "\t" : ",";
  const format = looksMarkdown ? "markdown" : delimiter === "\t" ? "tsv" : "csv";
  const batchSize = Math.max(50, Number(options.batchSize) || 200);
  const cellsList = [];
  for (let start = 0; start < lines.length; start += batchSize) {
    const end = Math.min(start + batchSize, lines.length);
    for (let index = start; index < end; index += 1) {
      const cells = parseDelimitedLine(lines[index], delimiter);
      cellsList.push(looksMarkdown
        ? cells.slice(cells[0] === "" ? 1 : 0, cells.at(-1) === "" ? -1 : undefined)
        : cells);
    }
    options.onProgress?.({ phase: "parse", completed: end, total: lines.length });
    if (end < lines.length) await yieldToBrowser();
  }
  if (isSeparatorRow(cellsList[1] ?? [])) cellsList.splice(1, 1);
  const indexes = headerIndexes(cellsList[0] ?? []);
  const hasHeader = (cellsList[0] ?? []).some(cell => /词条|词性|词义|原句|term|definition|sentence/i.test(cell));
  const dataRows = hasHeader ? cellsList.slice(1) : cellsList;
  const rows = [];
  for (let start = 0; start < dataRows.length; start += batchSize) {
    const end = Math.min(start + batchSize, dataRows.length);
    for (let index = start; index < end; index += 1) {
      const cells = dataRows[index];
      if (cells.every(cell => !cell)) continue;
      if (cells.length < 3) {
        rows.push({ term: cells[0] ?? "", definition: cells[1] ?? "", sentence: cells[2] ?? "", parseError: "列数不足三列" });
        continue;
      }
      rows.push({ term: cells[indexes.term] ?? "", definition: cells[indexes.definition] ?? "", sentence: cells[indexes.sentence] ?? "" });
    }
    options.onProgress?.({ phase: "rows", completed: end, total: dataRows.length });
    if (end < dataRows.length) await yieldToBrowser();
  }
  if (!rows.length) return { rows: [], errors: ["未识别到有效的三列表格、TSV 或 CSV"], format };
  return { rows, errors: [], format };
}

function sourceKey(source) {
  return [source.year, source.examType, source.section, source.originalSentence]
    .map(value => String(value ?? "").trim().toLocaleLowerCase()).join("|");
}

function findVocabularyItem(state, term) {
  const normalizedTerm = normalizeVocabularyTerm(term);
  return state.vocabulary.items.find(item => item.normalizedTerm === normalizedTerm && item.status !== "archived");
}

/** 生成预览结果，重复、缺失字段和解析问题全部显示给用户确认。 */
function buildVocabularyPreviewRow(state, metadata, row, index, seen) {
    const term = String(row.term ?? "").trim();
    const definition = String(row.definition ?? "").trim();
    const sentenceInfo = parseSentenceOrigin(row.sentence);
    const sentence = sentenceInfo.sentence;
    const normalizedTerm = normalizeVocabularyTerm(term);
    const errors = [];
    const warnings = [];
    if (!term) errors.push("词条为空");
    if (!definition) errors.push("词义为空");
    if (!sentence) errors.push("原句缺失");
    if (row.parseError) errors.push(row.parseError);
    if (normalizedTerm && seen.has(normalizedTerm)) warnings.push("本批次重复词条，将合并来源");
    seen.add(normalizedTerm);
    const existing = findVocabularyItem(state, term);
    const sameSource = existing && state.vocabulary.sources.some(source => (
      source.vocabularyItemId === existing.id
      && sourceKey(source) === sourceKey({ ...metadata, originalSentence: sentence })
    ));
    if (sameSource) errors.push("完全相同的来源＋原句已存在");
    return {
      id: createId(),
      index,
      term,
      definition,
      sentence,
      sentenceOrigin: sentenceInfo.sentenceOrigin,
      normalizedTerm,
      existingItemId: existing?.id ?? null,
      existingDefinition: existing?.definition ?? "",
      status: errors.length ? "warning" : existing ? "merge" : "new",
      errors,
      warnings,
      definitionChoice: "merge",
      masteredChoice: existing?.status === "mastered" ? "keep" : null,
      source: {
        year: String(metadata.year ?? "").trim(),
        examType: metadata.examType === "英语一" ? "英语一" : "英语二",
        section: String(metadata.section ?? "").trim(),
        originalSentence: sentence,
        sentenceOrigin: sentenceInfo.sentenceOrigin,
        surfaceForm: String(metadata.surfaceForm ?? "").trim(),
        highlightText: String(metadata.highlightText ?? "").trim(),
        note: String(metadata.note ?? "").trim(),
        taskId: metadata.taskId || null
      }
    };
}

function buildVocabularyImportPreviewFromParsed(state, metadata, parsed) {
  normalizeVocabularyState(state);
  const seen = new Set();
  const rows = parsed.rows.map((row, index) => buildVocabularyPreviewRow(state, metadata, row, index, seen));
  return {
    format: parsed.format,
    parserErrors: parsed.errors,
    rows,
      validCount: rows.filter(row => !row.errors.length || row.errors.every(error => error === "原句缺失")).length,
    invalidCount: rows.filter(row => row.errors.some(error => error !== "原句缺失")).length
  };
}

export function buildVocabularyImportPreview(state, metadata, text) {
  return buildVocabularyImportPreviewFromParsed(state, metadata, parseVocabularyInput(text));
}

/** 移动端导入使用的分批预览构建，不改变同步 API 和数据格式。 */
export async function buildVocabularyImportPreviewAsync(state, metadata, text, options = {}) {
  const parsed = await parseVocabularyInputAsync(text, options);
  normalizeVocabularyState(state);
  const seen = new Set();
  const rows = [];
  const batchSize = Math.max(50, Number(options.batchSize) || 200);
  for (let start = 0; start < parsed.rows.length; start += batchSize) {
    const end = Math.min(start + batchSize, parsed.rows.length);
    for (let index = start; index < end; index += 1) {
      rows.push(buildVocabularyPreviewRow(state, metadata, parsed.rows[index], index, seen));
    }
    options.onProgress?.({ phase: "preview", completed: end, total: parsed.rows.length });
    if (end < parsed.rows.length) await yieldToBrowser();
  }
  const preview = {
    format: parsed.format,
    parserErrors: parsed.errors,
    rows,
    validCount: rows.filter(row => !row.errors.length || row.errors.every(error => error === "原句缺失")).length,
    invalidCount: rows.filter(row => row.errors.some(error => error !== "原句缺失")).length
  };
  options.onProgress?.({ phase: "complete", completed: preview.rows.length, total: preview.rows.length });
  return preview;
}

function mergeDefinition(existing, incoming, choice) {
  if (!existing) return incoming;
  if (choice === "keep") return existing;
  if (choice === "new") return incoming;
  if (existing === incoming) return existing;
  return `${existing}；${incoming}`;
}

/** 将预览中用户确认的行正式写入词库，并返回新增/合并/跳过/失败统计。 */
export function applyVocabularyImport(state, preview, options = {}) {
  normalizeVocabularyState(state);
  const now = new Date().toISOString();
  const batchId = createId();
  const stats = { added: 0, merged: 0, skipped: 0, failed: 0, failures: [] };
  const acceptedMissingSentence = Boolean(options.acceptMissingSentence);
  for (const row of preview?.rows ?? []) {
    const rowErrors = row.errors ?? [];
    const blockingErrors = rowErrors.filter(error => error !== "原句缺失");
    if (blockingErrors.length === 1 && blockingErrors[0] === "完全相同的来源＋原句已存在") {
      stats.skipped += 1;
      continue;
    }
    if (blockingErrors.length || (!row.sentence && !acceptedMissingSentence)) {
      stats.failed += 1;
      stats.failures.push({ row: row.index + 1, reason: blockingErrors.join("、") || "原句缺失" });
      continue;
    }
    if (!row.term || !row.definition) {
      stats.failed += 1;
      stats.failures.push({ row: row.index + 1, reason: !row.term ? "词条为空" : "词义为空" });
      continue;
    }
    let item = findVocabularyItem(state, row.term);
    const isNew = !item;
    if (!item) {
      item = {
        id: createId(), term: row.term.trim(), normalizedTerm: row.normalizedTerm,
        definition: row.definition.trim(), status: "new", stage: 0,
        consecutiveRemembered: 0, consecutiveForgotten: 0, totalReviews: 0,
        rememberedCount: 0, forgottenCount: 0, lastReviewedAt: null, nextReviewAt: null,
        masteredAt: null, createdAt: now, updatedAt: now, note: "", archivedAt: null,
        todayAgain: false, lastImportBatchId: batchId
      };
      state.vocabulary.items.push(item);
      stats.added += 1;
    } else {
      const oldStatus = item.status;
      item.definition = mergeDefinition(item.definition, row.definition.trim(), row.definitionChoice ?? "merge");
      item.updatedAt = now;
      item.lastImportBatchId = batchId;
      if (oldStatus === "mastered" && row.masteredChoice === "restore") {
        item.status = "reviewing";
        item.masteredAt = null;
        item.nextReviewAt = now;
        item.todayAgain = false;
      }
      stats.merged += 1;
    }
    const source = {
      id: createId(), vocabularyItemId: item.id, ...clone(row.source),
      originalSentence: row.sentence.trim(), importedAt: now,
      sentenceOrigin: row.sentenceOrigin || (row.sentence ? "exam" : "missing"),
      surfaceForm: row.source.surfaceForm || row.term.trim(),
      highlightText: row.source.highlightText || row.term.trim()
    };
    const duplicateSource = state.vocabulary.sources.some(existing => (
      existing.vocabularyItemId === item.id && sourceKey(existing) === sourceKey(source)
    ));
    if (!duplicateSource) state.vocabulary.sources.push(source);
    else if (!isNew) stats.skipped += 1;
  }
  const batch = {
    id: batchId, year: String(preview.rows?.[0]?.source?.year ?? ""),
    examType: preview.rows?.[0]?.source?.examType ?? "英语二",
    section: preview.rows?.[0]?.source?.section ?? "",
    originalText: options.originalText ?? "", addedCount: stats.added,
    mergedCount: stats.merged, skippedCount: stats.skipped,
    failedCount: stats.failed, importedAt: now
  };
  state.vocabulary.importBatches.push(batch);
  return { ...stats, batchId };
}

function itemIsDue(item, now) {
  if (item.status === "mastered" || item.status === "archived") return false;
  if (item.todayAgain && item.lastReviewedAt && dateKey(new Date(item.lastReviewedAt)) === dateKey(now)) return true;
  return item.status === "new" || !item.nextReviewAt || new Date(item.nextReviewAt) <= now;
}

export function vocabularyQueueForDate(state, now = new Date(), options = {}) {
  normalizeVocabularyState(state);
  const today = dateKey(now);
  if (!state.vocabulary.session || state.vocabulary.session.dateKey !== today) {
    state.vocabulary.session = { dateKey: today, deferredIds: [] };
  }
  const sourceTaskId = options.sourceTaskId ?? null;
  const items = state.vocabulary.items.filter(item => itemIsDue(item, now));
  return items.sort((a, b) => {
    const overdueA = a.nextReviewAt && new Date(a.nextReviewAt) < startOfDay(now) ? 0 : 1;
    const overdueB = b.nextReviewAt && new Date(b.nextReviewAt) < startOfDay(now) ? 0 : 1;
    if (overdueA !== overdueB) return overdueA - overdueB;
    if (sourceTaskId) {
      const aMatch = state.vocabulary.sources.some(source => source.vocabularyItemId === a.id && source.taskId === sourceTaskId);
      const bMatch = state.vocabulary.sources.some(source => source.vocabularyItemId === b.id && source.taskId === sourceTaskId);
      if (aMatch !== bMatch) return aMatch ? -1 : 1;
    }
    const deferredA = state.vocabulary.session.deferredIds.indexOf(a.id);
    const deferredB = state.vocabulary.session.deferredIds.indexOf(b.id);
    if ((deferredA >= 0) !== (deferredB >= 0)) return deferredA >= 0 ? 1 : -1;
    if (deferredA >= 0 && deferredB >= 0) return deferredA - deferredB;
    return new Date(a.nextReviewAt ?? 0) - new Date(b.nextReviewAt ?? 0) || a.createdAt.localeCompare(b.createdAt);
  });
}

export function vocabularyRemainingCount(state, now = new Date()) {
  return vocabularyQueueForDate(state, now).length;
}

export function reviewVocabularyItem(state, itemId, result, now = new Date(), sourceId = null) {
  normalizeVocabularyState(state);
  if (!state.vocabulary.session || state.vocabulary.session.dateKey !== dateKey(now)) {
    state.vocabulary.session = { dateKey: dateKey(now), deferredIds: [] };
  }
  const item = state.vocabulary.items.find(candidate => candidate.id === itemId);
  if (!item || !["remembered", "forgotten"].includes(result) || item.status === "mastered" || item.status === "archived") return null;
  const previous = {
    stage: item.stage, status: item.status, consecutiveRemembered: item.consecutiveRemembered,
    consecutiveForgotten: item.consecutiveForgotten, totalReviews: item.totalReviews,
    rememberedCount: item.rememberedCount, forgottenCount: item.forgottenCount,
    lastReviewedAt: item.lastReviewedAt, nextReviewAt: item.nextReviewAt, todayAgain: item.todayAgain
  };
  const previousStage = item.stage;
  let nextStage = item.stage;
  let nextReviewAt;
  if (result === "remembered") {
    nextStage = Math.min(item.stage + 1, VOCABULARY_INTERVALS.length);
    item.stage = nextStage;
    item.consecutiveRemembered += 1;
    item.consecutiveForgotten = 0;
    item.rememberedCount += 1;
    item.status = nextStage > 1 ? "reviewing" : "learning";
    nextReviewAt = addDays(startOfDay(now), VOCABULARY_INTERVALS[nextStage - 1] ?? VOCABULARY_INTERVALS.at(-1));
    item.todayAgain = false;
    state.vocabulary.session?.deferredIds && (state.vocabulary.session.deferredIds = state.vocabulary.session.deferredIds.filter(id => id !== item.id));
  } else {
    item.stage = Math.max(0, item.stage - 1);
    item.consecutiveRemembered = 0;
    item.consecutiveForgotten += 1;
    item.forgottenCount += 1;
    item.status = "learning";
    nextReviewAt = now;
    item.todayAgain = true;
    state.vocabulary.session?.deferredIds && !state.vocabulary.session.deferredIds.includes(item.id) && state.vocabulary.session.deferredIds.push(item.id);
  }
  item.totalReviews += 1;
  item.lastReviewedAt = now.toISOString();
  item.nextReviewAt = nextReviewAt.toISOString();
  item.updatedAt = now.toISOString();
  const record = {
    id: createId(), vocabularyItemId: item.id, result, reviewedAt: now.toISOString(),
    previousStage, nextStage: item.stage, previousNextReviewAt: previous.nextReviewAt,
    nextReviewAt: item.nextReviewAt, sourceId, previousState: previous
  };
  state.vocabulary.reviewRecords.push(record);
  return { item, record, previous };
}

export function markVocabularyMastered(state, itemId, now = new Date()) {
  normalizeVocabularyState(state);
  const item = state.vocabulary.items.find(candidate => candidate.id === itemId);
  if (!item || item.status === "archived") return null;
  const previous = { status: item.status, nextReviewAt: item.nextReviewAt, masteredAt: item.masteredAt, todayAgain: item.todayAgain };
  item.status = "mastered";
  item.masteredAt = now.toISOString();
  item.nextReviewAt = null;
  item.todayAgain = false;
  item.updatedAt = now.toISOString();
  const record = {
    id: createId(), vocabularyItemId: item.id, result: "mastered", reviewedAt: now.toISOString(),
    previousStage: item.stage, nextStage: item.stage, previousNextReviewAt: previous.nextReviewAt,
    nextReviewAt: null, previousState: previous
  };
  state.vocabulary.reviewRecords.push(record);
  return { item, record };
}

export function undoVocabularyReview(state, recordId, now = new Date()) {
  normalizeVocabularyState(state);
  const record = state.vocabulary.reviewRecords.find(candidate => candidate.id === recordId && !candidate.undoneAt);
  if (!record) return false;
  const item = state.vocabulary.items.find(candidate => candidate.id === record.vocabularyItemId);
  if (!item) return false;
  const latest = [...state.vocabulary.reviewRecords].reverse().find(candidate => candidate.vocabularyItemId === item.id && !candidate.undoneAt);
  if (latest?.id !== record.id) return false;
  if (record.previousState) Object.assign(item, clone(record.previousState));
  else {
    item.stage = record.previousStage;
    item.nextReviewAt = record.previousNextReviewAt;
  }
  item.updatedAt = now.toISOString();
  state.vocabulary.session ??= { dateKey: dateKey(now), deferredIds: [] };
  state.vocabulary.session.deferredIds = state.vocabulary.session.deferredIds.filter(id => id !== item.id);
  if (item.todayAgain) state.vocabulary.session.deferredIds.push(item.id);
  record.undoneAt = now.toISOString();
  state.vocabulary.reviewRecords.push({
    id: createId(), vocabularyItemId: item.id, result: "undo", reviewedAt: now.toISOString(),
    previousStage: record.nextStage, nextStage: item.stage,
    previousNextReviewAt: record.nextReviewAt, nextReviewAt: item.nextReviewAt,
    sourceId: record.sourceId, undoOf: record.id
  });
  return true;
}

export function restoreVocabularyItem(state, itemId, mode = "continue", now = new Date()) {
  normalizeVocabularyState(state);
  const item = state.vocabulary.items.find(candidate => candidate.id === itemId);
  if (!item || item.status !== "mastered") return false;
  item.status = mode === "new" ? "new" : "reviewing";
  if (mode === "new") item.stage = 0;
  item.masteredAt = null;
  item.nextReviewAt = now.toISOString();
  item.todayAgain = false;
  item.updatedAt = now.toISOString();
  return true;
}

export function archiveVocabularyItem(state, itemId, now = new Date()) {
  normalizeVocabularyState(state);
  const item = state.vocabulary.items.find(candidate => candidate.id === itemId);
  if (!item) return false;
  item.status = "archived";
  item.archivedAt = now.toISOString();
  item.updatedAt = now.toISOString();
  return true;
}

export function unarchiveVocabularyItem(state, itemId, now = new Date()) {
  normalizeVocabularyState(state);
  const item = state.vocabulary.items.find(candidate => candidate.id === itemId);
  if (!item || item.status !== "archived") return false;
  item.status = item.nextReviewAt && new Date(item.nextReviewAt) <= now ? "reviewing" : "learning";
  item.archivedAt = null;
  item.updatedAt = now.toISOString();
  return true;
}

export function sourcesForVocabularyItem(state, itemId, preferredTaskId = null) {
  normalizeVocabularyState(state);
  const sources = state.vocabulary.sources.filter(source => source.vocabularyItemId === itemId);
  return sources.sort((a, b) => {
    if (preferredTaskId && (a.taskId === preferredTaskId) !== (b.taskId === preferredTaskId)) return a.taskId === preferredTaskId ? -1 : 1;
    return new Date(b.importedAt) - new Date(a.importedAt);
  });
}

function escapeForHighlight(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

/** 返回安全 HTML；优先匹配实际形式，无法匹配时原句保持原样并提示手动指定。 */
export function highlightVocabularySentence(sentence, term, surfaceForm = "", manualHighlightText = "") {
  const source = String(sentence ?? "");
  const baseCandidates = [manualHighlightText, surfaceForm, term]
    .map(value => String(value ?? "").trim()).filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const candidates = [...baseCandidates];
  const word = String(term ?? "").trim();
  if (/^[A-Za-z]+$/.test(word) && !word.includes(" ")) {
    const lower = word.toLocaleLowerCase();
    candidates.push(`${word}s`, `${word}es`, `${word}ed`, `${word}ing`, `${word}ly`);
    if (lower.endsWith("y")) candidates.push(`${word.slice(0, -1)}ies`);
    if (lower.endsWith("e")) candidates.push(`${word.slice(0, -1)}ing`, `${word.slice(0, -1)}ed`);
  }
  let match = null;
  let matchedCandidate = "";
  for (const candidate of candidates) {
    const escapedCandidate = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^A-Za-z])(${escapedCandidate})(?=$|[^A-Za-z])`, "i");
    match = source.match(pattern);
    if (match) { matchedCandidate = candidate; break; }
  }
  if (!match) return { html: escapeForHighlight(source), matched: false };
  const start = match.index + match[1].length;
  const end = start + match[2].length;
  return {
    matched: true,
    matchedText: matchedCandidate,
    html: `${escapeForHighlight(source.slice(0, start))}<mark>${escapeForHighlight(source.slice(start, end))}</mark>${escapeForHighlight(source.slice(end))}`
  };
}
