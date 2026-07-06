// ==UserScript==
// @name         SIAT/SUAT 教师评价辅助填写器 Lite
// @namespace    https://github.com/Gzx-070829/suat-course-eval-helper
// @version      1.1.0
// @description  深圳理工大学教评极简辅助预填工具：只填写当前课程，本地运行，不联网，不自动保存，不自动提交
// @author       Gzx-070829
// @homepageURL  https://github.com/Gzx-070829/suat-course-eval-helper
// @supportURL   https://github.com/Gzx-070829/suat-course-eval-helper/issues
// @downloadURL  https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper-lite.user.js
// @updateURL    https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper-lite.user.js
// @match        https://education.siat.ac.cn/*
// @match        https://education.suat-sz.edu.cn/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Safety rules:
  // - This script only fills the current course evaluation page.
  // - This script must never click save, submit, confirm, final submit, or any final action button.
  // - Users must review and manually save.

  // ---------------------------------------------------------------------------
  // constants
  // ---------------------------------------------------------------------------

  const SCRIPT_ID = 'suat-eval-helper-lite';
  const BUTTON_ID = `${SCRIPT_ID}-button`;
  const STYLE_ID = `${SCRIPT_ID}-style`;
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
      '课程进度安排整体较合适',
      '讲得比较清楚，整体是顺的',
      '课程安排还可以，学习起来不费力',
      '内容比较容易跟上',
      '整体理解难度不大',
      '内容整体是完整的',
      '整体还可以',
      '学习体验比较正常',
      '课程整体比较顺',
      '整体感觉可以接受'
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
      '希望对抽象内容能配合更多直观说明',
      '有些地方可以稍微放慢一点',
      '可以多加一点例子会更好理解',
      '关键部分可以再讲清楚一点',
      '中间可以稍微总结一下',
      '有些内容讲得稍微快了一点',
      '可以多一点提示或过渡',
      '结构还可以再优化一点',
      '有些部分可以讲得更集中',
      '重点可以再突出一些',
      '章节之间可以再顺一点',
      '还有优化空间'
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
      '帮助学生及时发现理解上的问题',
      '可以多一点课堂互动',
      '中间可以多问一下理解情况',
      '如果能停一下讨论会更好',
      '可以增加一点提问环节',
      '互动稍微多一点会更容易跟上',
      '可以多一点练习内容',
      '如果结合案例会更好理解',
      '动手部分可以再多一点',
      '可以增加小练习巩固',
      '理论和实践可以更紧一点'
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
    routeTimer: 0,
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

  async function reveal(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    await sleep(TIMING.scroll);
  }

  // ---------------------------------------------------------------------------
  // page detection
  // ---------------------------------------------------------------------------

  function isEvaluationPage() {
    if (!ALLOWED_HOSTS.has(location.hostname)) return false;
    const bodyText = document.body?.innerText || '';
    const hasRatingSelect = Boolean(document.querySelector('.el-select'));
    const hasOpenQuestion = Boolean(document.querySelector('textarea, .el-textarea__inner'));
    const hasAllDetailKeywords = ['课程名称', '教师', '评价详情', '设置分值'].every((keyword) => bodyText.includes(keyword));
    return hasAllDetailKeywords || (
      location.pathname.includes('/teaching/evaluation') &&
      hasRatingSelect &&
      (bodyText.includes('设置分值') || hasOpenQuestion)
    );
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

  async function performFillTask(task) {
    assertTaskActive(task);
    const button = document.getElementById(BUTTON_ID);
    if (button) {
      button.disabled = true;
      button.textContent = '填写中...';
    }

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let scan = { selects: [], emptyTextareas: [], existingContentCount: 0, unrecognizedControlCount: 0 };

    try {
      await waitForStableDOM(task.sessionId);
      await sleep(TIMING.postStableDelay);
      assertTaskActive(task);
      if (!isEvaluationPage()) throw new Error('SESSION_CHANGED');
      scan = scanFieldsReadOnly(task);
      skippedCount = scan.existingContentCount;

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
      window.alert(
        `教评辅助填写完成：\n\n` +
        `✔ 成功写入：${successCount}\n` +
        `⏭ 跳过已有内容：${skippedCount}\n` +
        `⚠ 写入失败（重试后）：${failedCount}\n` +
        `❌ 未识别控件：${scan.unrecognizedControlCount}\n\n` +
        '请逐项检查评分和文字，确认无误后手动保存。'
      );
    } finally {
      const currentButton = document.getElementById(BUTTON_ID);
      if (currentButton) {
        currentButton.disabled = false;
        currentButton.textContent = '教评辅助';
      }
    }
  }

  function fillEvaluation() {
    if (!isEvaluationPage()) {
      window.alert('当前页面不像课程评价详情页，请进入具体课程后再试。');
      return;
    }
    const hasActiveFill = state.currentTask?.sessionId === state.pageSessionId ||
      state.taskQueue.some((task) => task.sessionId === state.pageSessionId);
    if (hasActiveFill) return;
    enqueue(performFillTask, { sessionId: state.pageSessionId, timeout: TIMING.taskTimeout });
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
    button.setAttribute('aria-label', '教评辅助预填，不会自动保存或提交');
    button.addEventListener('click', fillEvaluation);
    document.body.appendChild(button);
  }

  function unmountButton() {
    if (document.getElementById(BUTTON_ID)) {
      document.getElementById(BUTTON_ID)?.remove();
    }
  }

  function syncWithPage() {
    if (isEvaluationPage()) mountButton();
    else unmountButton();
  }

  function scheduleSync() {
    window.clearTimeout(state.routeTimer);
    state.routeTimer = window.setTimeout(syncWithPage, TIMING.route);
  }

  function handleRouteChange() {
    rotatePageSession();
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
