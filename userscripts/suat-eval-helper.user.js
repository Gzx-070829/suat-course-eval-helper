// ==UserScript==
// @name         SIAT/SUAT 教师评价辅助填写器
// @namespace    https://github.com/Gzx-070829/suat-course-eval-helper
// @version      0.3.0
// @description  深圳理工大学教评极简辅助预填工具：本地运行，不联网，不自动保存，不自动提交
// @author       Gzx-070829
// @homepageURL  https://github.com/Gzx-070829/suat-course-eval-helper
// @supportURL   https://github.com/Gzx-070829/suat-course-eval-helper/issues
// @downloadURL  https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper.user.js
// @updateURL    https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper.user.js
// @match        https://education.siat.ac.cn/*
// @match        https://education.suat-sz.edu.cn/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // This script must never click save, submit, confirm, or final action buttons.

  // ---------------------------------------------------------------------------
  // constants
  // ---------------------------------------------------------------------------

  const SCRIPT_ID = 'suat-eval-helper';
  const BUTTON_ID = `${SCRIPT_ID}-button`;
  const STYLE_ID = `${SCRIPT_ID}-style`;
  const ALLOWED_HOSTS = new Set(['education.siat.ac.cn', 'education.suat-sz.edu.cn']);
  const PAGE_KEYWORDS = ['评价', '课程名称', '教师', '设置分值'];
  const RATING_CONTEXT_PATTERN = /(评价|满意|分值|教学|课程|教师|评分)/;
  const TIMING = Object.freeze({ route: 350, dropdownOpen: 240, selected: 120, scroll: 90 });

  const ADVANTAGE_PARTS = Object.freeze({
    starts: [
      '课程整体安排比较清晰',
      '课程内容组织较有条理',
      '本课程的知识点安排比较完整',
      '课程整体节奏比较稳定',
      '课程内容与学习目标比较匹配'
    ],
    middles: [
      '讲解重点较为明确',
      '能够帮助学生理解主要知识点',
      '对课程内容的理解有一定帮助',
      '课堂内容覆盖比较全面',
      '有助于建立对本课程的整体认识'
    ],
    ends: [
      '对后续学习有帮助。',
      '有利于学生掌握相关基础内容。',
      '能够帮助学生逐步理解课程要求。',
      '对理解本课程的核心内容有帮助。',
      '整体学习体验较好。'
    ]
  });

  const SUGGESTION_PARTS = Object.freeze({
    starts: [
      '希望后续可以适当增加更多案例讲解',
      '建议课堂中可以增加一些重点内容回顾',
      '希望之后可以适当增加课堂互动',
      '建议适当增加课后练习或例题讲解',
      '希望对较难的知识点可以多一些展开说明'
    ],
    middles: [
      '帮助学生更好地理解课程内容',
      '方便学生及时梳理知识点',
      '有助于学生巩固课堂所学',
      '让学生更容易把握课程重点',
      '帮助学生进一步理解和应用相关知识'
    ],
    ends: [
      '整体来说课程对学习是有帮助的。',
      '这样可能会让学习效果更好。',
      '这样有助于提高课堂学习效率。',
      '这样可以帮助学生更好地跟上课程节奏。',
      '整体教学已经比较认真，以上只是一些改进建议。'
    ]
  });

  const state = {
    busy: false,
    routeTimer: 0,
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
    const hasFormControls = Boolean(document.querySelector('.el-select, textarea, .el-textarea__inner'));
    const keywordHits = PAGE_KEYWORDS.filter((keyword) => bodyText.includes(keyword)).length;
    return hasFormControls && (
      location.pathname.includes('/teaching/evaluation') ||
      keywordHits >= 2
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
    if (count >= 8) {
      const satisfiedRatio = 0.05 + Math.random() * 0.10;
      satisfiedCount = Math.max(1, Math.floor(count * satisfiedRatio));
    } else {
      for (let index = 0; index < count; index += 1) {
        if (Math.random() < 0.10) satisfiedCount += 1;
      }
      satisfiedCount = Math.min(1, satisfiedCount);
    }

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

  function fillTextarea(textarea, value) {
    textarea.focus();
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    descriptor?.set?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.blur();
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

  async function fillEvaluation() {
    if (state.busy) return;
    if (!isEvaluationPage()) {
      window.alert('当前页面不像课程评价详情页，请进入具体课程后再试。');
      return;
    }

    state.busy = true;
    state.operationToken += 1;
    const operationToken = state.operationToken;
    const button = document.getElementById(BUTTON_ID);
    if (button) {
      button.disabled = true;
      button.textContent = '填写中...';
    }

    const ratingSelects = findRatingSelects();
    const ratingPlan = createRatingPlan(ratingSelects.length);
    let verySatisfiedCount = 0;
    let satisfiedCount = 0;
    let textareaCount = 0;

    try {
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
      if (operationToken === state.operationToken && isEvaluationPage()) {
        textareaCount = await fillOpenQuestions();
      }

      window.alert(
        `教评辅助填写完成：\n\n` +
        `发现评分项数量：${ratingSelects.length}\n` +
        `非常满意数量：${verySatisfiedCount}\n` +
        `满意数量：${satisfiedCount}\n` +
        `文本框填写数量：${textareaCount}\n\n` +
        '请逐项检查评分和文字，确认无误后手动保存。'
      );
    } finally {
      state.busy = false;
      const currentButton = document.getElementById(BUTTON_ID);
      if (currentButton) {
        currentButton.disabled = false;
        currentButton.textContent = '教评辅助';
      }
    }
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
      state.operationToken += 1;
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
