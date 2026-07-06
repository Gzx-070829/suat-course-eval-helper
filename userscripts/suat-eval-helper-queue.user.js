// ==UserScript==
// @name         SIAT/SUAT 教师评价辅助填写器 Queue
// @namespace    https://github.com/Gzx-070829/suat-course-eval-helper
// @version      1.1.0
// @description  深圳理工大学教评队列辅助预填工具：本地运行，不联网，不自动保存，不自动提交
// @author       Gzx-070829
// @homepageURL  https://github.com/Gzx-070829/suat-course-eval-helper
// @supportURL   https://github.com/Gzx-070829/suat-course-eval-helper/issues
// @downloadURL  https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper-queue.user.js
// @updateURL    https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper-queue.user.js
// @match        https://education.siat.ac.cn/*
// @match        https://education.suat-sz.edu.cn/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Safety rules:
  // - This script must never click save, submit, confirm, or final action buttons.
  // - This script only processes rows marked "未填写" by default.
  // - Users must review the final list and manually decide whether to submit evaluations.

  // ---------------------------------------------------------------------------
  // constants
  // ---------------------------------------------------------------------------

  const SCRIPT_ID = 'suat-eval-helper-queue';
  const BUTTON_ID = `${SCRIPT_ID}-button`;
  const STYLE_ID = `${SCRIPT_ID}-style`;
  const QUEUE_STORAGE_KEY = `${SCRIPT_ID}:state`;
  const MAX_QUEUE_ITEMS = 30;
  const ALLOWED_HOSTS = new Set(['education.siat.ac.cn', 'education.suat-sz.edu.cn']);
  const RATING_CONTEXT_PATTERN = /(评价|满意|分值|教学|课程|教师|评分)/;
  const TIMING = Object.freeze({
    route: 350,
    domQuiet: 800,
    domStableTimeout: 3000,
    postStableDelay: 300,
    dropdownTimeout: 300,
    selected: 250,
    verifyMin: 200,
    verifyMax: 400,
    scroll: 90,
    fieldTimeout: 2200,
    taskTimeout: 12000,
    watchdogTimeout: 15000
  });

  const ADVANTAGE_PARTS = Object.freeze({
    starts: [
      '课程整体安排比较清晰',
      '课程内容组织较有条理',
      '本课程的知识点安排比较完整',
      '课程整体节奏比较稳定',
      '课程内容与学习目标比较匹配',
      '各部分知识点衔接较自然',
      '课程重点和基本要求比较明确',
      '教学内容覆盖较全面',
      '课程安排有助于循序渐进地学习',
      '课堂内容和课程目标之间关联较清楚',
      '课程内容由浅入深，比较容易跟上',
      '整体教学安排比较合理',
      '课程框架比较清楚',
      '课程内容层次较分明',
      '课程进度安排整体较合适'
    ],
    middles: [
      '讲解重点较为明确',
      '能够帮助学生理解主要知识点',
      '对课程内容的理解有一定帮助',
      '课堂内容覆盖比较全面',
      '有助于建立对本课程的整体认识',
      '老师讲解比较认真',
      '老师对重点内容讲得比较清楚',
      '课堂讲授逻辑较清晰',
      '对主要知识点的说明比较到位',
      '讲解过程中能够突出重点',
      '对基础概念的解释比较细致',
      '讲课节奏整体比较适中',
      '课堂表达比较清楚',
      '讲解方式比较平实易懂',
      '授课过程比较有条理'
    ],
    ends: [
      '对后续学习有帮助。',
      '有利于学生掌握相关基础内容。',
      '能够帮助学生逐步理解课程要求。',
      '对理解本课程的核心内容有帮助。',
      '整体学习体验较好。',
      '有助于学生梳理课程框架。',
      '对理解课程重点比较有帮助。',
      '有助于学生逐步熟悉本学科内容。',
      '能够帮助学生形成较系统的认识。',
      '对掌握课程基本要求有帮助。',
      '有助于提高对课程内容的理解。',
      '能帮助学生把握学习重点。',
      '对课程知识体系的建立有帮助。',
      '有利于学生逐步进入学习状态。',
      '对相关知识的学习有一定促进作用。'
    ]
  });

  const SUGGESTION_PARTS = Object.freeze({
    starts: [
      '希望后续可以适当增加更多案例讲解',
      '建议课堂中可以增加一些重点内容回顾',
      '希望之后可以适当增加课堂互动',
      '建议适当增加课后练习或例题讲解',
      '希望对较难的知识点可以多一些展开说明',
      '建议课堂中可以增加一些具体例题',
      '希望对重点内容配合更多实例说明',
      '可以适当增加一些课堂练习',
      '建议增加一些与实际应用相关的例子',
      '希望能结合更多具体情境帮助理解',
      '对较难的知识点可以增加例题分析',
      '可以适当补充一些课后练习讲解',
      '希望能增加阶段性例题总结',
      '建议对典型问题进行更多展开',
      '希望对抽象内容能配合更多直观说明'
    ],
    middles: [
      '帮助学生更好地理解课程内容',
      '方便学生及时梳理知识点',
      '有助于学生巩固课堂所学',
      '让学生更容易把握课程重点',
      '帮助学生进一步理解和应用相关知识',
      '希望在重点章节后增加简短回顾',
      '方便学生在每节课后梳理主要知识点',
      '让课程难点部分的节奏更加平缓',
      '帮助区分容易混淆的内容',
      '给学生留出更多理解复杂内容的时间',
      '加强知识点之间的联系说明',
      '增加一些阶段性复习和总结',
      '通过课堂互动帮助学生加深理解',
      '增加一些答疑或总结环节',
      '帮助学生及时发现理解上的问题'
    ],
    ends: [
      '整体来说课程对学习是有帮助的。',
      '这样可能会让学习效果更好。',
      '这样有助于提高课堂学习效率。',
      '这样可以帮助学生更好地跟上课程节奏。',
      '整体教学已经比较认真，以上只是一些改进建议。',
      '以上只是一些改进建议。',
      '相信这样能进一步提升课程体验。',
      '这样能帮助学生更好地巩固课堂所学。',
      '这样可以让课程内容更加容易吸收。',
      '这样有助于学生更好地消化课堂内容。',
      '这样能让课程重点更加清楚。',
      '这样有助于提升整体学习效果。',
      '这样可能会让学生参与感更强。',
      '希望后续课程可以继续保持并进一步完善。'
    ]
  });

  const state = {
    busy: false,
    routeTimer: 0,
    continueTimer: 0,
    historyPatched: false,
    observer: null,
    pageSessionId: createSessionId(),
    taskQueue: [],
    currentTask: null,
    queueRunning: false,
    watchdogTimer: 0
  };

  // ---------------------------------------------------------------------------
  // utils
  // ---------------------------------------------------------------------------

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function createSessionId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function createTask(execute, options = {}) {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sessionId: options.sessionId || state.pageSessionId,
      execute,
      attempt: options.attempt || 0,
      maxRetries: 2,
      timeout: options.timeout || TIMING.taskTimeout,
      cancelled: false,
      cancel() { this.cancelled = true; }
    };
  }

  function assertTaskActive(task) {
    if (!task || task.cancelled) throw new Error('TASK_CANCELLED');
    if (task.sessionId !== state.pageSessionId) throw new Error('SESSION_CHANGED');
  }

  async function withTimeout(promise, timeoutMs, onTimeout) {
    let timer = 0;
    const operation = Promise.resolve(promise);
    const outcome = await Promise.race([
      operation.then(
        (value) => ({ status: 'fulfilled', value }),
        (error) => ({ status: 'rejected', error })
      ),
      new Promise((resolve) => {
        timer = window.setTimeout(() => {
          onTimeout?.();
          resolve({ status: 'timeout' });
        }, timeoutMs);
      })
    ]);
    window.clearTimeout(timer);
    if (outcome.status === 'timeout') {
      try { await operation; } catch (_) { /* wait until cancelled DOM work has stopped */ }
      throw new Error('TASK_TIMEOUT');
    }
    if (outcome.status === 'rejected') throw outcome.error;
    return outcome.value;
  }

  function enqueue(execute, options = {}) {
    const task = createTask(execute, options);
    state.taskQueue.push(task);
    runNext();
    return task;
  }

  function cancelAllTasks() {
    state.currentTask?.cancel();
    state.taskQueue.forEach((task) => task.cancel());
    state.taskQueue.length = 0;
    window.clearTimeout(state.watchdogTimer);
  }

  async function runNext() {
    if (state.queueRunning) return;
    const task = state.taskQueue.shift();
    if (!task) return;
    if (task.cancelled || task.sessionId !== state.pageSessionId) {
      runNext();
      return;
    }
    state.queueRunning = true;
    state.currentTask = task;
    state.watchdogTimer = window.setTimeout(() => {
      task.cancel();
      state.taskQueue.forEach((pending) => pending.cancel());
      state.taskQueue.length = 0;
    }, TIMING.watchdogTimeout);
    try {
      await withTimeout(Promise.resolve().then(() => task.execute(task)), task.timeout, () => task.cancel());
    } catch (error) {
      const canRetry = !['SESSION_CHANGED', 'TASK_CANCELLED', 'DOM_NOT_STABLE'].includes(error.message) &&
        task.attempt < task.maxRetries &&
        task.sessionId === state.pageSessionId;
      if (canRetry) {
        state.taskQueue.unshift(createTask(task.execute, {
          sessionId: task.sessionId,
          attempt: task.attempt + 1,
          timeout: task.timeout
        }));
      } else if (!['SESSION_CHANGED', 'TASK_CANCELLED'].includes(error.message)) {
        console.warn(`[${SCRIPT_ID}] 填写任务终止：`, error);
      }
    } finally {
      window.clearTimeout(state.watchdogTimer);
      state.currentTask = null;
      state.queueRunning = false;
      runNext();
    }
  }

  function rotatePageSession() {
    cancelAllTasks();
    state.pageSessionId = createSessionId();
    state.busy = false;
  }

  function waitForStableDOM(sessionId) {
    return new Promise((resolve, reject) => {
      if (!document.body || sessionId !== state.pageSessionId) {
        reject(new Error('SESSION_CHANGED'));
        return;
      }
      let settled = false;
      let quietTimer = 0;
      let timeoutTimer = 0;
      let sessionTimer = 0;
      const observer = new MutationObserver(() => {
        window.clearTimeout(quietTimer);
        quietTimer = window.setTimeout(finishStable, TIMING.domQuiet);
      });
      const cleanup = () => {
        observer.disconnect();
        window.clearTimeout(quietTimer);
        window.clearTimeout(timeoutTimer);
        window.clearInterval(sessionTimer);
      };
      const finishStable = () => {
        if (settled) return;
        if (sessionId !== state.pageSessionId) {
          settled = true;
          cleanup();
          reject(new Error('SESSION_CHANGED'));
          return;
        }
        settled = true;
        cleanup();
        resolve();
      };
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      quietTimer = window.setTimeout(finishStable, TIMING.domQuiet);
      timeoutTimer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('DOM_NOT_STABLE'));
      }, TIMING.domStableTimeout);
      sessionTimer = window.setInterval(() => {
        if (sessionId === state.pageSessionId || settled) return;
        settled = true;
        cleanup();
        reject(new Error('SESSION_CHANGED'));
      }, 100);
    });
  }

  function normalizeText(value) {
    return String(value || '').replace(/[\u00a0\s]+/g, ' ').trim();
  }

  function isRenderable(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function randomVerificationDelay() {
    return TIMING.verifyMin + Math.floor(Math.random() * (TIMING.verifyMax - TIMING.verifyMin + 1));
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (const char of String(value || '')) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function createEmptyQueueState() {
    return {
      running: false,
      processed: [],
      startedAt: 0,
      lastActionAt: 0,
      failed: [],
      current: '',
      phase: 'idle'
    };
  }

  function loadQueueState() {
    try {
      const saved = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '{}');
      const queue = { ...createEmptyQueueState(), ...(saved && typeof saved === 'object' ? saved : {}) };
      queue.processed = Array.isArray(queue.processed) ? queue.processed.slice(0, MAX_QUEUE_ITEMS) : [];
      queue.failed = Array.isArray(queue.failed) ? queue.failed.slice(0, MAX_QUEUE_ITEMS) : [];
      queue.current = queue.current || queue.currentId || '';
      delete queue.currentId;
      if (queue.startedAt && Date.now() - queue.startedAt > 6 * 60 * 60 * 1000) queue.running = false;
      return queue;
    } catch (error) {
      console.warn(`[${SCRIPT_ID}] 读取队列状态失败：`, error);
      return createEmptyQueueState();
    }
  }

  function saveQueueState(queue) {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  }

  function clearQueueState() {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
    cancelAllTasks();
    state.busy = false;
    window.clearTimeout(state.continueTimer);
    updateButtonText('教评辅助');
  }

  function updateButtonText(text) {
    const button = document.getElementById(BUTTON_ID);
    if (button) button.textContent = text;
  }

  async function reveal(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    await sleep(TIMING.scroll);
  }

  // ---------------------------------------------------------------------------
  // page detection
  // ---------------------------------------------------------------------------

  function getPageText() {
    return document.body?.innerText || document.body?.textContent || '';
  }

  function getDetailSignals() {
    const text = getPageText();
    const hasCourseName = text.includes('课程名称');
    const hasTeacher = text.includes('教师');
    const hasEvaluationDetail = text.includes('评价详情') || text.includes('课程评分评价') || text.includes('教师评分评价');
    const selectCount = document.querySelectorAll('.el-select input, input.el-input__inner').length;
    const textareaCount = document.querySelectorAll('textarea, .el-textarea__inner').length;
    return {
      hasCourseName,
      hasTeacher,
      hasEvaluationDetail,
      selectCount,
      textareaCount,
      isDetailPage: ALLOWED_HOSTS.has(location.hostname) &&
        hasCourseName &&
        hasTeacher &&
        hasEvaluationDetail &&
        selectCount >= 3
    };
  }

  function isDetailPage() {
    return getDetailSignals().isDetailPage;
  }

  function logDetailDiagnostics(phase) {
    const signals = getDetailSignals();
    console.log('[SUAT Queue] Detail diagnostics', {
      phase,
      href: location.href,
      textHasCourseName: signals.hasCourseName,
      textHasTeacher: signals.hasTeacher,
      textHasEvaluationDetail: signals.hasEvaluationDetail,
      selectCount: signals.selectCount,
      textareaCount: signals.textareaCount,
      isDetailPage: signals.isDetailPage
    });
  }

  async function waitForDetailPageStable(timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (isDetailPage()) {
        await sleep(800);
        if (isDetailPage()) return true;
      }
      await sleep(300);
    }
    return false;
  }

  function isListPage() {
    if (!ALLOWED_HOSTS.has(location.hostname)) return false;
    const bodyText = document.body?.innerText || '';
    return ['教学评价', '评价课程列表', '提交状态', '操作'].every((keyword) => bodyText.includes(keyword)) &&
      Boolean(document.querySelector('table, .el-table'));
  }

  function isVisibleRow(row) {
    return row instanceof HTMLElement && isRenderable(row);
  }

  function getMainTableRows() {
    return Array.from(new Set(document.querySelectorAll(
      '.el-table__body-wrapper tbody tr.el-table__row, .el-table__body-wrapper tbody tr'
    ))).filter((row) => {
      return isVisibleRow(row) &&
        row.closest('.el-table__fixed-right') === null &&
        row.closest('.el-table__fixed') === null;
    });
  }

  function getFixedRightRows() {
    return Array.from(new Set(document.querySelectorAll(
      '.el-table__fixed-right tbody tr.el-table__row, .el-table__fixed-right tbody tr'
    ))).filter(isVisibleRow);
  }

  function getExactEvaluateCandidates(container) {
    const candidates = Array.from(container.querySelectorAll('a, button, span, div, .cell, [role="button"]')).filter((element) => {
      return isRenderable(element) &&
        !element.disabled &&
        element.getAttribute('aria-disabled') !== 'true' &&
        normalizeText(element.innerText || element.textContent) === '评价';
    });
    const normalized = candidates.map((element) => {
      const clickable = element.closest('a, button, [role="button"]');
      return clickable && normalizeText(clickable.innerText || clickable.textContent) === '评价' ? clickable : element;
    });
    return Array.from(new Set(normalized)).sort((left, right) => {
      const leftPreferred = left.matches('a, button, [role="button"]') ? 0 : 1;
      const rightPreferred = right.matches('a, button, [role="button"]') ? 0 : 1;
      return leftPreferred - rightPreferred;
    });
  }

  function getPageEvaluateActions() {
    return getExactEvaluateCandidates(document).filter((element) => {
      return !element.closest(`#${BUTTON_ID}`) &&
        normalizeText(element.innerText || element.textContent) === '评价';
    });
  }

  function findEvaluateActionByRowIndex(rowIndex) {
    const mainRows = getMainTableRows();
    const fixedRightRows = getFixedRightRows();
    const actionRow = fixedRightRows.length ? fixedRightRows[rowIndex] : mainRows[rowIndex];
    const rowAction = actionRow ? getExactEvaluateCandidates(actionRow)[0] : null;
    if (rowAction) return rowAction;
    const pageActions = getPageEvaluateActions();
    const mainRow = mainRows[rowIndex];
    if (mainRow) {
      const rowRect = mainRow.getBoundingClientRect();
      const visuallyAligned = pageActions.find((action) => {
        const actionRect = action.getBoundingClientRect();
        const actionCenter = actionRect.top + actionRect.height / 2;
        return actionCenter >= rowRect.top - 2 && actionCenter <= rowRect.bottom + 2;
      });
      if (visuallyAligned) return visuallyAligned;
    }
    return pageActions[rowIndex] || null;
  }

  function findUnfilledRows() {
    return getMainTableRows().map((row, rowIndex) => {
      const text = normalizeText(row.innerText || row.textContent || '');
      return {
        row,
        rowIndex,
        isUnfilled: text.includes('未填写'),
        isDraft: text.includes('未提交'),
        isSubmitted: text.includes('已提交')
      };
    }).filter((item) => item.isUnfilled && !item.isDraft && !item.isSubmitted);
  }

  function getRowIdentity(row) {
    const text = normalizeText(row.innerText)
      .replace(/未填写|未提交|已提交/g, '')
      .replace(/评价|查看/g, '')
      .slice(0, 500);
    return `course-${stableHash(text)}`;
  }

  function clickEvaluateByRowIndex(rowIndex) {
    const action = findEvaluateActionByRowIndex(rowIndex);
    if (!action || normalizeText(action.innerText || action.textContent) !== '评价') return false;
    action.click();
    return true;
  }

  function getListDiagnostics() {
    const mainRows = getMainTableRows();
    const fixedRightRows = getFixedRightRows();
    let unfilledCount = 0;
    let draftCount = 0;
    let submittedCount = 0;
    for (const row of mainRows) {
      const text = normalizeText(row.innerText || row.textContent || '');
      if (text.includes('未填写')) unfilledCount += 1;
      if (text.includes('未提交')) draftCount += 1;
      if (text.includes('已提交')) submittedCount += 1;
    }
    const evaluateActionCount = mainRows.reduce((count, row, rowIndex) => {
      return count + (findEvaluateActionByRowIndex(rowIndex) ? 1 : 0);
    }, 0);
    return {
      pageType: 'list',
      mainRowsCount: mainRows.length,
      fixedRightRowsCount: fixedRightRows.length,
      unfilledCount,
      draftCount,
      submittedCount,
      evaluateActionCount
    };
  }

  // ---------------------------------------------------------------------------
  // Element UI rating handling
  // ---------------------------------------------------------------------------

  function getNearbyText(element) {
    const container = element.closest('.el-form-item, .form-item, [class*="question"], tr, li') || element.parentElement;
    return normalizeText(container?.innerText || '').slice(0, 260);
  }

  function getSelectValue(select) {
    const input = select.querySelector('input.el-input__inner, input[role="combobox"]');
    return normalizeText(input?.value || select.querySelector('.el-select__tags-text')?.textContent || '');
  }

  function findEditableSelects() {
    return Array.from(document.querySelectorAll('.el-select')).filter((select) => {
      if (!isRenderable(select)) return false;
      return !select.classList.contains('is-disabled') && select.getAttribute('aria-disabled') !== 'true';
    });
  }

  function findRatingSelects() {
    return findEditableSelects().filter((select) => RATING_CONTEXT_PATTERN.test(getNearbyText(select)));
  }

  function visibleDropdowns() {
    return Array.from(document.querySelectorAll('.el-select-dropdown')).filter(isRenderable);
  }

  function resolveCurrentDropdown(select, beforeDropdowns) {
    const visible = visibleDropdowns();
    const newlyVisible = visible.filter((dropdown) => !beforeDropdowns.has(dropdown));
    if (newlyVisible.length === 1) return newlyVisible[0];

    const trigger = select.querySelector('[aria-controls], [aria-owns]');
    const controlledId = trigger?.getAttribute('aria-controls') || trigger?.getAttribute('aria-owns');
    const controlled = controlledId ? document.getElementById(controlledId) : null;
    if (controlled && isRenderable(controlled)) {
      return controlled.closest('.el-select-dropdown') || (controlled.matches('.el-select-dropdown') ? controlled : null);
    }

    return null;
  }

  function isExactVerySatisfied(text) {
    return /^非常满意(?:\s*[（(]\s*5分\s*[）)])?$/.test(normalizeText(text));
  }

  function closeDropdown(trigger) {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  }

  function assertFieldActive(task, fieldState, element) {
    assertTaskActive(task);
    if (fieldState.cancelled || !element?.isConnected) throw new Error('FIELD_CANCELLED');
  }

  async function waitForCurrentDropdown(select, beforeDropdowns, task, fieldState) {
    const deadline = Date.now() + TIMING.dropdownTimeout;
    while (Date.now() < deadline) {
      assertFieldActive(task, fieldState, select);
      const dropdown = resolveCurrentDropdown(select, beforeDropdowns);
      if (dropdown) return dropdown;
      await sleep(25);
    }
    return null;
  }

  async function selectVerySatisfied(select, task, fieldState) {
    assertFieldActive(task, fieldState, select);
    await reveal(select);
    assertFieldActive(task, fieldState, select);

    const trigger = select.querySelector('input.el-input__inner, [role="combobox"]') || select;
    const beforeDropdowns = new Set(visibleDropdowns());
    trigger.click();
    const dropdown = await waitForCurrentDropdown(select, beforeDropdowns, task, fieldState);
    if (!dropdown) {
      closeDropdown(trigger);
      return false;
    }

    const items = Array.from(dropdown.querySelectorAll('.el-select-dropdown__item')).filter((item) => {
      return isRenderable(item) && !item.classList.contains('is-disabled') && item.getAttribute('aria-disabled') !== 'true';
    });
    const targetItems = items.filter((item) => isExactVerySatisfied(item.innerText));
    if (targetItems.length !== 1) {
      closeDropdown(trigger);
      return false;
    }

    assertFieldActive(task, fieldState, select);
    targetItems[0].click();
    await sleep(TIMING.selected);
    assertFieldActive(task, fieldState, select);
    const verified = isExactVerySatisfied(getSelectValue(select));
    if (!verified) closeDropdown(trigger);
    return verified;
  }

  async function fillSelectWithTimeout(select, task) {
    const fieldState = { cancelled: false };
    return withTimeout(
      (async () => {
        assertFieldActive(task, fieldState, select);
        if (getSelectValue(select).trim() !== '') return 'skipped';
        for (let attempt = 0; attempt <= 2; attempt += 1) {
          assertFieldActive(task, fieldState, select);
          if (await selectVerySatisfied(select, task, fieldState)) return 'success';
        }
        return 'failed';
      })(),
      TIMING.fieldTimeout,
      () => { fieldState.cancelled = true; }
    );
  }

  // ---------------------------------------------------------------------------
  // local text templates
  // ---------------------------------------------------------------------------

  function combineParts(parts) {
    const start = randomItem(parts.starts);
    const middle = randomItem(parts.middles);
    const end = randomItem(parts.ends);
    return Math.random() < 0.35
      ? `${start}，${middle}。${end}`
      : `${start}，${middle}，${end}`;
  }

  function generateAdvantage() {
    return combineParts(ADVANTAGE_PARTS);
  }

  function generateSuggestion() {
    return combineParts(SUGGESTION_PARTS);
  }

  function findTextareas() {
    const candidates = Array.from(document.querySelectorAll('textarea, .el-textarea__inner'));
    return Array.from(new Set(candidates)).filter((textarea) => {
      return textarea instanceof HTMLTextAreaElement &&
        isRenderable(textarea) &&
        !textarea.disabled &&
        !textarea.readOnly;
    });
  }

  function scanFieldsReadOnly(task) {
    assertTaskActive(task);
    const editableSelects = findEditableSelects();
    const recognizedSelects = findRatingSelects();
    const textareas = findTextareas();
    const selects = recognizedSelects.filter((select) => getSelectValue(select).trim() === '');
    const emptyTextareas = textareas.filter((textarea) => textarea.value.trim() === '');
    return {
      selects,
      textareas,
      emptySelectCount: selects.length,
      emptyTextareas,
      existingContentCount: recognizedSelects.length - selects.length + textareas.length - emptyTextareas.length,
      unrecognizedControlCount: editableSelects.length - recognizedSelects.length
    };
  }

  function setNativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  }

  function dispatchInputEvents(element) {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur();
  }

  function fillTextarea(textarea, value) {
    textarea.focus();
    setNativeValue(textarea, value);
    dispatchInputEvents(textarea);
  }

  async function fillTextareaWithTimeout(textarea, value, task) {
    const fieldState = { cancelled: false };
    return withTimeout((async () => {
      assertFieldActive(task, fieldState, textarea);
      if (textarea.value.trim() !== '') return 'skipped';
      await reveal(textarea);
      assertFieldActive(task, fieldState, textarea);
      if (textarea.value.trim() !== '') return 'skipped';
      for (let attempt = 0; attempt <= 2; attempt += 1) {
        assertFieldActive(task, fieldState, textarea);
        fillTextarea(textarea, value);
        await sleep(randomVerificationDelay());
        assertFieldActive(task, fieldState, textarea);
        if (textarea.value === value) return 'success';
      }
      return 'failed';
    })(), TIMING.fieldTimeout, () => { fieldState.cancelled = true; });
  }

  // ---------------------------------------------------------------------------
  // one-click fill
  // ---------------------------------------------------------------------------

  async function performDetailFillTask(task, fromQueue) {
    assertTaskActive(task);
    if (!isDetailPage()) throw new Error('SESSION_CHANGED');
    const button = document.getElementById(BUTTON_ID);
    if (button) button.disabled = true;
    updateButtonText('填写中...');

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let scan = { selects: [], emptyTextareas: [], existingContentCount: 0, unrecognizedControlCount: 0 };

    try {
      await waitForStableDOM(task.sessionId);
      await sleep(TIMING.postStableDelay);
      assertTaskActive(task);
      if (!isDetailPage()) throw new Error('SESSION_CHANGED');
      scan = scanFieldsReadOnly(task);
      skippedCount = scan.existingContentCount;

      if (fromQueue) {
        const queue = loadQueueState();
        if (!queue.running) throw new Error('TASK_CANCELLED');
        queue.phase = 'filling-detail';
        queue.lastActionAt = Date.now();
        saveQueueState(queue);
      }

      for (const select of scan.selects) {
        try {
          const result = await fillSelectWithTimeout(select, task);
          if (result === 'success') successCount += 1;
          else if (result === 'skipped') skippedCount += 1;
          else failedCount += 1;
        } catch (error) {
          assertTaskActive(task);
          failedCount += 1;
          console.warn(`[${SCRIPT_ID}] 评分项处理失败：`, error);
        }
      }

      const oneTextOnly = scan.emptyTextareas.length === 1;
      for (let index = 0; index < scan.emptyTextareas.length; index += 1) {
        const value = oneTextOnly
          ? `${generateAdvantage()}${generateSuggestion()}`
          : (index === 0 ? generateAdvantage() : generateSuggestion());
        try {
          const result = await fillTextareaWithTimeout(scan.emptyTextareas[index], value, task);
          if (result === 'success') successCount += 1;
          else if (result === 'skipped') skippedCount += 1;
          else failedCount += 1;
        } catch (error) {
          assertTaskActive(task);
          failedCount += 1;
          console.warn(`[${SCRIPT_ID}] 文本框处理失败：`, error);
        }
      }

      assertTaskActive(task);
      if (fromQueue) {
        const queue = loadQueueState();
        queue.phase = 'awaiting-manual-save';
        queue.lastActionAt = Date.now();
        saveQueueState(queue);
      }
      window.alert(
        `教评辅助填写完成：\n\n` +
        `✔ 成功写入：${successCount}\n` +
        `⏭ 跳过已有内容：${skippedCount}\n` +
        `⚠ 写入失败（重试后）：${failedCount}\n` +
        `❌ 未识别控件：${scan.unrecognizedControlCount}\n\n` +
        (fromQueue
          ? '请逐项检查后手动保存并返回列表，Queue 会继续下一门。'
          : '请逐项检查评分和文字，确认无误后手动保存。')
      );
    } finally {
      state.busy = false;
      const currentButton = document.getElementById(BUTTON_ID);
      if (currentButton) currentButton.disabled = false;
      updateButtonText('教评辅助');
    }
  }

  function stopQueueWithMessage(message) {
    const queue = loadQueueState();
    queue.running = false;
    queue.phase = 'failed';
    if (queue.current && !queue.failed.includes(queue.current)) queue.failed.push(queue.current);
    queue.lastActionAt = Date.now();
    saveQueueState(queue);
    state.busy = false;
    const button = document.getElementById(BUTTON_ID);
    if (button) button.disabled = false;
    updateButtonText('教评辅助');
    logDetailDiagnostics(queue.phase);
    window.alert(`${message}\n\n请打开控制台查看详情页诊断信息。`);
  }

  function enqueueDetailFill(fromQueue) {
    const hasActiveFill = state.currentTask?.sessionId === state.pageSessionId ||
      state.taskQueue.some((task) => task.sessionId === state.pageSessionId);
    if (hasActiveFill || !isDetailPage()) return;
    state.busy = true;
    enqueue((task) => performDetailFillTask(task, fromQueue), {
      sessionId: state.pageSessionId,
      timeout: TIMING.taskTimeout
    });
  }

  async function processCurrentDetailPageInQueue(timeoutMs = 15000) {
    const stable = await waitForDetailPageStable(timeoutMs);
    const queue = loadQueueState();
    logDetailDiagnostics(queue.phase);

    if (stable || isDetailPage()) {
      console.log('[SUAT Queue] Already on detail page, continue filling.');
      enqueueDetailFill(true);
      return;
    }
    stopQueueWithMessage('进入详情页超时，请确认是否已经进入课程评价详情页。');
  }

  async function performNextCourseTask(task) {
    assertTaskActive(task);
    const button = document.getElementById(BUTTON_ID);
    if (button) button.disabled = true;
    updateButtonText('继续下一门...');

    try {
      await waitForStableDOM(task.sessionId);
      await sleep(TIMING.postStableDelay);
      assertTaskActive(task);
      if (!isListPage()) throw new Error('SESSION_CHANGED');

    const queue = loadQueueState();
    if (!queue.running) return;
    if (queue.processed.length + queue.failed.length >= MAX_QUEUE_ITEMS) {
      queue.running = false;
      queue.phase = 'stopped';
      saveQueueState(queue);
      window.alert(`队列已达到最多 ${MAX_QUEUE_ITEMS} 门课程的安全上限，请检查列表后再决定是否继续。`);
      return;
    }

    const processed = new Set([...queue.processed, ...queue.failed]);
    const nextItem = findUnfilledRows().find((item) => !processed.has(getRowIdentity(item.row)));
    if (!nextItem) {
      queue.running = false;
      queue.phase = 'complete';
      queue.current = '';
      queue.lastActionAt = Date.now();
      saveQueueState(queue);
      window.alert('已处理完成。请在列表页检查所有课程状态，确认无误后再手动点击最终提交评价。');
      return;
    }

    queue.current = getRowIdentity(nextItem.row);
    queue.phase = 'awaiting-detail';
    queue.lastActionAt = Date.now();
    saveQueueState(queue);

    if (!clickEvaluateByRowIndex(nextItem.rowIndex)) {
      stopQueueWithMessage('无法安全点击当前“未填写”课程的“评价”按钮，队列已停止。');
      return;
    }

    logDetailDiagnostics(queue.phase);
    } finally {
      state.busy = false;
      const currentButton = document.getElementById(BUTTON_ID);
      if (currentButton) currentButton.disabled = false;
      updateButtonText('教评辅助');
      scheduleSync();
    }
  }

  function processNextUnfilledCourse() {
    if (state.busy || !isListPage()) return;
    const hasActiveTask = state.currentTask?.sessionId === state.pageSessionId ||
      state.taskQueue.some((task) => task.sessionId === state.pageSessionId);
    if (hasActiveTask) return;
    state.busy = true;
    enqueue(performNextCourseTask, { sessionId: state.pageSessionId, timeout: TIMING.taskTimeout });
  }

  async function performStartQueueTask(task) {
    const button = document.getElementById(BUTTON_ID);
    if (button) button.disabled = true;
    updateButtonText('检查中...');
    let approved = false;
    try {
      await waitForStableDOM(task.sessionId);
      await sleep(TIMING.postStableDelay);
      assertTaskActive(task);
      if (!isListPage()) throw new Error('SESSION_CHANGED');
      const diagnostics = getListDiagnostics();
      console.log({ ...diagnostics });
      const rows = findUnfilledRows();
      if (!rows.length) {
        const pageText = document.body?.innerText || '';
        window.alert(pageText.includes('未填写')
          ? '页面中检测到“未填写”文字，但没有成功匹配表格行。可能是表格结构变化，请打开控制台查看诊断信息。'
          : '没有发现状态为“未填写”的课程。');
        return;
      }
      approved = window.confirm(
        `发现 ${rows.length} 门未填写课程。将逐门进入详情页并自动预填；每门课程都需要你手动保存并返回列表。不会点击保存或最终提交评价。继续吗？`
      );
      if (!approved) return;
      const queue = createEmptyQueueState();
      queue.running = true;
      queue.startedAt = Date.now();
      queue.lastActionAt = Date.now();
      saveQueueState(queue);
    } finally {
      state.busy = false;
      const currentButton = document.getElementById(BUTTON_ID);
      if (currentButton) currentButton.disabled = false;
      updateButtonText('教评辅助');
      if (approved) window.setTimeout(processNextUnfilledCourse, 0);
    }
  }

  function startQueue() {
    if (!isListPage() || state.busy) return;
    state.busy = true;
    enqueue(performStartQueueTask, { sessionId: state.pageSessionId, timeout: TIMING.taskTimeout });
  }

  function maybeContinueQueue() {
    window.clearTimeout(state.continueTimer);
    let queue = loadQueueState();
    if (!queue.running || state.busy) return;

    if (isDetailPage()) {
      if (queue.phase !== 'awaiting-manual-save') {
        updateButtonText('填写中...');
        state.continueTimer = window.setTimeout(() => processCurrentDetailPageInQueue(15000), 300);
      }
      return;
    }

    if (isListPage()) {
      if (queue.phase === 'awaiting-detail' && queue.current) {
        const elapsed = Date.now() - queue.lastActionAt;
        const remaining = Math.max(1000, 15000 - elapsed);
        state.continueTimer = window.setTimeout(() => processCurrentDetailPageInQueue(remaining), 300);
        return;
      }
      if (queue.phase === 'awaiting-manual-save' && queue.current) {
        if (!queue.processed.includes(queue.current)) queue.processed.push(queue.current);
        queue.current = '';
        queue.phase = 'awaiting-list';
        queue.lastActionAt = Date.now();
        saveQueueState(queue);
      }
      state.continueTimer = window.setTimeout(processNextUnfilledCourse, 900);
    }
  }

  function handleButtonClick(event) {
    if (event.altKey) {
      clearQueueState();
      window.alert('Queue 队列状态已清除。');
      return;
    }
    if (isDetailPage()) enqueueDetailFill(false);
    else if (isListPage()) startQueue();
  }

  // ---------------------------------------------------------------------------
  // button and SPA lifecycle
  // ---------------------------------------------------------------------------

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID} {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483000;
        min-width: 88px;
        min-height: 38px;
        border: 0;
        border-radius: 999px;
        padding: 9px 15px;
        color: #fff;
        background: #1769e0;
        box-shadow: 0 6px 20px rgba(23, 105, 224, 0.28);
        font: 600 14px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
      }
      #${BUTTON_ID}:hover { background: #1259c3; }
      #${BUTTON_ID}:disabled { opacity: 0.68; cursor: wait; }
    `;
    document.head.appendChild(style);
  }

  function mountButton() {
    if (document.getElementById(BUTTON_ID)) return;
    injectStyles();
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = '教评辅助';
    button.setAttribute('aria-label', '教评队列辅助，不会自动保存或提交');
    button.addEventListener('click', handleButtonClick);
    document.body.appendChild(button);
  }

  function unmountButton() {
    document.getElementById(BUTTON_ID)?.remove();
  }

  function syncWithPage() {
    if (isDetailPage() || isListPage()) {
      mountButton();
      maybeContinueQueue();
    } else unmountButton();
  }

  function scheduleSync() {
    window.clearTimeout(state.routeTimer);
    state.routeTimer = window.setTimeout(syncWithPage, TIMING.route);
  }

  function handleRouteChange() {
    rotatePageSession();
    window.clearTimeout(state.continueTimer);
    scheduleSync();
  }

  function patchHistory() {
    if (state.historyPatched) return;
    state.historyPatched = true;
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        handleRouteChange();
        return result;
      };
    }
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
  }

  function bootstrap() {
    patchHistory();
    state.observer = new MutationObserver(scheduleSync);
    state.observer.observe(document.documentElement, { childList: true, subtree: true });
    syncWithPage();
  }

  bootstrap();
})();
