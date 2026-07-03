// ==UserScript==
// @name         SIAT/SUAT 教师评价辅助填写器 Queue
// @namespace    https://github.com/Gzx-070829/suat-course-eval-helper
// @version      0.5.1
// @description  深圳理工大学教评队列辅助预填工具：支持列表页队列填写和自动保存草稿，本地运行，不联网，不自动最终提交
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
  // - This script may click the detail-page "保存" button after filling the current course.
  // - This script must never click "提交评价", "提交", "确认", "最终提交", or any final submission button.
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
  const TIMING = Object.freeze({ route: 350, dropdownOpen: 240, selected: 120, scroll: 90 });

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
    operationToken: 0,
    historyPatched: false,
    observer: null
  };

  // ---------------------------------------------------------------------------
  // utils
  // ---------------------------------------------------------------------------

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
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
      currentId: '',
      phase: 'idle'
    };
  }

  function loadQueueState() {
    try {
      const saved = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '{}');
      const queue = { ...createEmptyQueueState(), ...(saved && typeof saved === 'object' ? saved : {}) };
      queue.processed = Array.isArray(queue.processed) ? queue.processed.slice(0, MAX_QUEUE_ITEMS) : [];
      queue.failed = Array.isArray(queue.failed) ? queue.failed.slice(0, MAX_QUEUE_ITEMS) : [];
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
    state.operationToken += 1;
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

  function findRatingSelects() {
    return Array.from(document.querySelectorAll('.el-select')).filter((select) => {
      if (!isRenderable(select)) return false;
      if (select.classList.contains('is-disabled') || select.getAttribute('aria-disabled') === 'true') return false;
      return RATING_CONTEXT_PATTERN.test(getNearbyText(select));
    });
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

    return visible.length === 1 ? visible[0] : null;
  }

  function canonicalRating(text) {
    const value = normalizeText(text).replace(/\s/g, '');
    if (/^非常满意(?:[（(]5分[）)])?$/.test(value)) return 'verySatisfied';
    if (/^满意(?:[（(]4分[）)])?$/.test(value)) return 'satisfied';
    return '';
  }

  function closeDropdown(trigger) {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  }

  function createRatingPlan(count) {
    if (count <= 0) return [];
    const plan = Array(count).fill('verySatisfied');

    let satisfiedCount = 0;
    if (count >= 8) satisfiedCount = 1 + Math.floor(Math.random() * 2);
    else satisfiedCount = Math.random() < 0.20 ? 1 : 0;

    const indexes = Array.from({ length: count }, (_, index) => index);
    for (let index = indexes.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
    }
    indexes.slice(0, satisfiedCount).forEach((index) => { plan[index] = 'satisfied'; });
    return plan;
  }

  async function selectRating(select, rating, operationToken) {
    if (operationToken !== state.operationToken || !select.isConnected) return false;
    await reveal(select);

    const trigger = select.querySelector('input.el-input__inner, [role="combobox"]') || select;
    const beforeDropdowns = new Set(visibleDropdowns());
    trigger.click();
    await sleep(TIMING.dropdownOpen);
    if (operationToken !== state.operationToken || !select.isConnected) return false;

    const dropdown = resolveCurrentDropdown(select, beforeDropdowns);
    if (!dropdown) {
      closeDropdown(trigger);
      return false;
    }

    const items = Array.from(dropdown.querySelectorAll('.el-select-dropdown__item')).filter((item) => {
      return isRenderable(item) && !item.classList.contains('is-disabled') && item.getAttribute('aria-disabled') !== 'true';
    });
    const targetItems = items.filter((item) => canonicalRating(item.innerText) === rating);
    if (targetItems.length !== 1) {
      closeDropdown(trigger);
      return false;
    }

    if (operationToken !== state.operationToken) return false;
    targetItems[0].click();
    await sleep(TIMING.selected);
    return canonicalRating(getSelectValue(select)) === rating;
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

  async function fillOpenQuestions() {
    const textareas = findTextareas().slice(0, 2);
    if (!textareas.length) return 0;

    if (textareas.length === 1) {
      await reveal(textareas[0]);
      fillTextarea(textareas[0], `${generateAdvantage()}${generateSuggestion()}`);
      return 1;
    }

    await reveal(textareas[0]);
    fillTextarea(textareas[0], generateAdvantage());
    await reveal(textareas[1]);
    fillTextarea(textareas[1], generateSuggestion());
    return 2;
  }

  // ---------------------------------------------------------------------------
  // one-click fill
  // ---------------------------------------------------------------------------

  async function fillCurrentDetailPage() {
    if (!isEvaluationPage()) throw new Error('当前页面不是课程评价详情页');
    const operationToken = state.operationToken;
    const ratingSelects = findRatingSelects();
    const ratingPlan = createRatingPlan(ratingSelects.length);
    let verySatisfiedCount = 0;
    let satisfiedCount = 0;
    let textareaCount = 0;

    for (let index = 0; index < ratingSelects.length; index += 1) {
      try {
        const rating = ratingPlan[index];
        const selected = await selectRating(ratingSelects[index], rating, operationToken);
        if (selected && rating === 'verySatisfied') verySatisfiedCount += 1;
        if (selected && rating === 'satisfied') satisfiedCount += 1;
      } catch (error) {
        console.warn(`[${SCRIPT_ID}] 评分项处理失败：`, error);
      }
    }

    if (operationToken === state.operationToken && isEvaluationPage()) textareaCount = await fillOpenQuestions();
    return { ratingTotal: ratingSelects.length, verySatisfiedCount, satisfiedCount, textareaCount };
  }

  function findStrictSaveButton() {
    const candidates = Array.from(document.querySelectorAll('button, .el-button, [role="button"]')).filter((control) => {
      return control.id !== BUTTON_ID &&
        isRenderable(control) &&
        !control.disabled &&
        control.getAttribute('aria-disabled') !== 'true' &&
        normalizeText(control.innerText || control.textContent) === '保存';
    });
    return candidates.length === 1 ? candidates[0] : null;
  }

  async function saveCurrentDetailPage() {
    if (!isEvaluationPage()) return { success: false, reason: '当前页面不是评价详情页' };
    await sleep(500);
    const saveButton = findStrictSaveButton();
    if (!saveButton) return { success: false, reason: '没有找到唯一且文字严格等于“保存”的按钮' };

    const oldSuccessNodes = new Set(Array.from(document.querySelectorAll('.el-message--success, .el-notification, [class*="success"]')));
    saveButton.click();
    const waitTime = 1200 + Math.floor(Math.random() * 801);
    const deadline = Date.now() + waitTime;
    let confirmed = false;
    let reason = '';
    while (Date.now() < deadline) {
      await sleep(200);
      if (isListPage()) {
        confirmed = true;
        reason = '保存后已返回列表';
      }
      const newSuccess = Array.from(document.querySelectorAll('.el-message--success, .el-notification, [class*="success"]')).find((node) => {
        return !oldSuccessNodes.has(node) && isRenderable(node) && normalizeText(node.innerText).includes('保存成功');
      });
      if (newSuccess) {
        confirmed = true;
        reason = '检测到保存成功提示';
      }
    }
    return confirmed ? { success: true, reason } : { success: false, reason: '未检测到保存成功提示' };
  }

  function findBackControl() {
    return Array.from(document.querySelectorAll('button, a, [role="button"]')).find((control) => {
      return control.id !== BUTTON_ID &&
        isRenderable(control) &&
        !control.disabled &&
        normalizeText(control.innerText || control.textContent) === '返回';
    }) || null;
  }

  async function returnToListPage() {
    updateButtonText('返回列表...');
    const backControl = findBackControl();
    if (backControl) backControl.click();
    else history.back();
    await sleep(1200);
  }

  async function processCurrentDetailPage(fromQueue) {
    if (state.busy || !isEvaluationPage()) return;
    state.busy = true;
    state.operationToken += 1;
    const button = document.getElementById(BUTTON_ID);
    if (button) button.disabled = true;
    updateButtonText('填写中...');

    let queue = loadQueueState();
    if (fromQueue) {
      if (!queue.running || queue.phase !== 'entering') {
        state.busy = false;
        if (button) button.disabled = false;
        updateButtonText('教评辅助');
        return;
      }
      queue.phase = 'filling';
      queue.lastActionAt = Date.now();
      saveQueueState(queue);
    }

    try {
      await fillCurrentDetailPage();
      updateButtonText('保存中...');
      const saveResult = await saveCurrentDetailPage();
      if (!saveResult.success) {
        if (fromQueue) {
          queue = loadQueueState();
          queue.running = false;
          queue.phase = 'failed';
          if (queue.currentId && !queue.failed.includes(queue.currentId)) queue.failed.push(queue.currentId);
          queue.lastActionAt = Date.now();
          saveQueueState(queue);
        }
        window.alert(`自动保存失败：${saveResult.reason}\n\n${fromQueue ? '队列已停止，' : ''}请手动检查并处理当前课程。`);
        return;
      }

      if (!fromQueue) {
        window.alert('已保存当前课程，请返回列表检查状态。');
        return;
      }

      queue = loadQueueState();
      if (queue.currentId && !queue.processed.includes(queue.currentId)) queue.processed.push(queue.currentId);
      queue.currentId = '';
      queue.phase = 'returning';
      queue.lastActionAt = Date.now();
      saveQueueState(queue);
      if (!isListPage()) await returnToListPage();
    } catch (error) {
      console.error(`[${SCRIPT_ID}] 处理当前课程失败：`, error);
      if (fromQueue) {
        queue = loadQueueState();
        queue.running = false;
        queue.phase = 'failed';
        if (queue.currentId && !queue.failed.includes(queue.currentId)) queue.failed.push(queue.currentId);
        saveQueueState(queue);
      }
      window.alert(`处理当前课程失败：${error.message}\n\n队列已停止，请手动处理。`);
    } finally {
      state.busy = false;
      const currentButton = document.getElementById(BUTTON_ID);
      if (currentButton) currentButton.disabled = false;
      updateButtonText('教评辅助');
      scheduleSync();
    }
  }

  async function processNextUnfilledCourse() {
    if (state.busy || !isListPage()) return;
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
      queue.currentId = '';
      queue.lastActionAt = Date.now();
      saveQueueState(queue);
      window.alert('已处理完成。请在列表页检查所有课程状态，确认无误后再手动点击最终提交评价。');
      return;
    }

    state.busy = true;
    const button = document.getElementById(BUTTON_ID);
    if (button) button.disabled = true;
    updateButtonText('继续下一门...');
    queue.currentId = getRowIdentity(nextItem.row);
    queue.phase = 'entering';
    queue.lastActionAt = Date.now();
    saveQueueState(queue);

    if (!clickEvaluateByRowIndex(nextItem.rowIndex)) {
      queue.running = false;
      queue.phase = 'failed';
      if (!queue.failed.includes(queue.currentId)) queue.failed.push(queue.currentId);
      saveQueueState(queue);
      state.busy = false;
      if (button) button.disabled = false;
      updateButtonText('教评辅助');
      window.alert('无法安全点击当前“未填写”课程的“评价”按钮，队列已停止。');
      return;
    }

    await sleep(500);
    state.busy = false;
    if (button) button.disabled = false;
    scheduleSync();
  }

  function startQueue() {
    if (!isListPage() || state.busy) return;
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
    const approved = window.confirm(
      `发现 ${rows.length} 门未填写课程。将逐门进入详情页、自动预填并自动保存当前课程。不会点击最终提交评价。继续吗？`
    );
    if (!approved) return;
    const queue = createEmptyQueueState();
    queue.running = true;
    queue.startedAt = Date.now();
    queue.lastActionAt = Date.now();
    saveQueueState(queue);
    processNextUnfilledCourse();
  }

  function maybeContinueQueue() {
    window.clearTimeout(state.continueTimer);
    const queue = loadQueueState();
    if (!queue.running || state.busy) return;

    if (isListPage()) {
      if (queue.phase === 'entering' && queue.currentId) {
        if (Date.now() - queue.lastActionAt > 5000) {
          queue.running = false;
          queue.phase = 'failed';
          if (!queue.failed.includes(queue.currentId)) queue.failed.push(queue.currentId);
          saveQueueState(queue);
          window.alert('进入课程评价详情页失败，队列已停止。');
        } else {
          state.continueTimer = window.setTimeout(maybeContinueQueue, 800);
        }
        return;
      }
      state.continueTimer = window.setTimeout(processNextUnfilledCourse, 900);
      return;
    }
    if (isEvaluationPage() && queue.phase === 'entering') {
      state.continueTimer = window.setTimeout(() => processCurrentDetailPage(true), 700);
      return;
    }
    if (isEvaluationPage() && queue.phase === 'filling' && Date.now() - queue.lastActionAt > 15000) {
      queue.running = false;
      queue.phase = 'failed';
      if (queue.currentId && !queue.failed.includes(queue.currentId)) queue.failed.push(queue.currentId);
      saveQueueState(queue);
      window.alert('检测到上一次课程处理被中断，队列已停止，请手动检查当前课程。');
    }
  }

  function handleButtonClick(event) {
    if (event.altKey) {
      clearQueueState();
      window.alert('Queue 队列状态已清除。');
      return;
    }
    if (isEvaluationPage()) processCurrentDetailPage(false);
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
    button.setAttribute('aria-label', '教评队列辅助，只保存草稿，不会最终提交');
    button.addEventListener('click', handleButtonClick);
    document.body.appendChild(button);
  }

  function unmountButton() {
    if (document.getElementById(BUTTON_ID)) {
      state.operationToken += 1;
      document.getElementById(BUTTON_ID)?.remove();
    }
  }

  function syncWithPage() {
    if (isEvaluationPage() || isListPage()) {
      mountButton();
      maybeContinueQueue();
    } else unmountButton();
  }

  function scheduleSync() {
    window.clearTimeout(state.routeTimer);
    state.routeTimer = window.setTimeout(syncWithPage, TIMING.route);
  }

  function patchHistory() {
    if (state.historyPatched) return;
    state.historyPatched = true;
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        scheduleSync();
        return result;
      };
    }
    window.addEventListener('popstate', scheduleSync);
    window.addEventListener('hashchange', scheduleSync);
  }

  function bootstrap() {
    patchHistory();
    state.observer = new MutationObserver(scheduleSync);
    state.observer.observe(document.documentElement, { childList: true, subtree: true });
    syncWithPage();
  }

  bootstrap();
})();
