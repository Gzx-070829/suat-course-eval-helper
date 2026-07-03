// ==UserScript==
// @name         SIAT/SUAT 教师评价辅助填写 Lite
// @namespace    https://github.com/Gzx-070829/suat-course-eval-helper
// @version      0.1.0
// @description  深圳理工大学教评辅助预填工具：自动选择分值、填写模板评价；不自动保存、不自动提交
// @author       Gzx-070829
// @match        https://education.siat.ac.cn/*
// @match        https://education.suat-sz.edu.cn/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // constants
  // ---------------------------------------------------------------------------

  const SCRIPT_ID = 'suat-eval-helper-lite';
  const BUTTON_ID = `${SCRIPT_ID}-button`;
  const STYLE_ID = `${SCRIPT_ID}-style`;
  const TARGET_RATINGS = ['非常满意（5分）', '非常满意(5分)', '非常满意'];
  const PAGE_KEYWORDS = ['评价详情', '课程名称', '教师'];
  const FORBIDDEN_ACTION_PATTERN = /(保存|提交|确认|完成评价|立即评价)/;
  const TEXT_TEMPLATES = {
    advantage: '老师授课认真负责，课程内容安排清晰，重点突出，能够结合课程内容进行讲解，对学生学习有帮助。',
    suggestion: '希望之后可以适当增加课堂互动、案例分析或实践练习，帮助学生进一步理解和掌握课程内容。'
  };
  const TIMING = {
    routeDebounce: 300,
    selectOpen: 260,
    selectClose: 100,
    elementScroll: 120
  };

  let routeTimer = 0;
  let isFilling = false;

  // ---------------------------------------------------------------------------
  // utils
  // ---------------------------------------------------------------------------

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, '').trim();
  }

  function isRenderable(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function safeClick(element) {
    if (!(element instanceof HTMLElement)) return false;

    const actionText = [
      element.innerText,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('value')
    ].filter(Boolean).join(' ');

    if (FORBIDDEN_ACTION_PATTERN.test(actionText)) {
      console.warn(`[${SCRIPT_ID}] 已阻止对敏感操作元素的点击：`, actionText);
      return false;
    }

    element.click();
    return true;
  }

  function dispatchInputEvents(element) {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function closeOpenDropdown() {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      bubbles: true
    }));
  }

  async function revealElement(element) {
    try {
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      await sleep(TIMING.elementScroll);
    } catch (error) {
      console.debug(`[${SCRIPT_ID}] 无法滚动到元素：`, error);
    }
  }

  // ---------------------------------------------------------------------------
  // page detection
  // ---------------------------------------------------------------------------

  function isEvaluationPage() {
    if (location.pathname.includes('/teaching/evaluation')) return true;

    const pageText = document.body ? document.body.innerText.slice(0, 120000) : '';
    const hitCount = PAGE_KEYWORDS.filter((keyword) => pageText.includes(keyword)).length;
    return hitCount >= 2;
  }

  function schedulePageCheck() {
    window.clearTimeout(routeTimer);
    routeTimer = window.setTimeout(syncUIWithPage, TIMING.routeDebounce);
  }

  function patchHistory() {
    for (const methodName of ['pushState', 'replaceState']) {
      const original = history[methodName];
      history[methodName] = function (...args) {
        const result = original.apply(this, args);
        schedulePageCheck();
        return result;
      };
    }

    window.addEventListener('popstate', schedulePageCheck);
    window.addEventListener('hashchange', schedulePageCheck);
  }

  // ---------------------------------------------------------------------------
  // form detection
  // ---------------------------------------------------------------------------

  function findEvaluationSelects() {
    return Array.from(document.querySelectorAll('.el-select')).filter((select) => {
      if (!isRenderable(select)) return false;
      return !select.classList.contains('is-disabled') && select.getAttribute('aria-disabled') !== 'true';
    });
  }

  function findVisibleDropdownItems() {
    return Array.from(document.querySelectorAll('.el-select-dropdown__item')).filter((item) => {
      return isRenderable(item) &&
        !item.classList.contains('is-disabled') &&
        item.getAttribute('aria-disabled') !== 'true';
    });
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

  function getFieldContext(element) {
    const container = element.closest('.el-form-item, .form-item, [class*="question"], tr, li') || element.parentElement;
    return normalizeText(container ? container.innerText : '');
  }

  // ---------------------------------------------------------------------------
  // fill actions
  // ---------------------------------------------------------------------------

  function findRatingItem(items) {
    for (const target of TARGET_RATINGS) {
      const exact = items.find((item) => normalizeText(item.innerText) === normalizeText(target));
      if (exact) return exact;
    }

    return items.find((item) => /^非常满意(?:[（(]5分[）)])?$/.test(normalizeText(item.innerText))) || null;
  }

  async function selectVerySatisfied(select) {
    await revealElement(select);

    const trigger = select.querySelector('input.el-input__inner, .el-input__inner, [role="combobox"]') || select;
    if (!safeClick(trigger)) return false;
    await sleep(TIMING.selectOpen);

    const items = findVisibleDropdownItems();
    const targetItem = findRatingItem(items);
    if (!targetItem) {
      closeOpenDropdown();
      await sleep(TIMING.selectClose);
      return false;
    }

    await revealElement(targetItem);
    const selected = safeClick(targetItem);
    await sleep(TIMING.selectClose);
    return selected;
  }

  function chooseTemplate(textarea, index) {
    const context = getFieldContext(textarea);
    if (/(建议|改进|意见|不足|希望)/.test(context)) return TEXT_TEMPLATES.suggestion;
    if (/(优点|满意|评价|特色|收获)/.test(context)) return TEXT_TEMPLATES.advantage;
    if (index === 0) return TEXT_TEMPLATES.advantage;
    if (index === 1) return TEXT_TEMPLATES.suggestion;
    return `${TEXT_TEMPLATES.advantage}\n${TEXT_TEMPLATES.suggestion}`;
  }

  async function fillTextareas() {
    const textareas = findTextareas();
    let filled = 0;

    for (let index = 0; index < textareas.length; index += 1) {
      const textarea = textareas[index];
      if (textarea.value.trim()) continue;

      await revealElement(textarea);
      textarea.focus();
      textarea.value = chooseTemplate(textarea, index);
      dispatchInputEvents(textarea);
      filled += 1;
    }

    return filled;
  }

  async function fillEvaluation() {
    if (isFilling) return;

    const approved = window.confirm(
      '辅助填写将执行以下操作：\n\n' +
      '1. 尝试将评分选择为“非常满意”\n' +
      '2. 在空白开放式评价中填写模板文字\n' +
      '3. 不会自动点击“保存”“提交”或“确认”\n\n' +
      '请在填写后逐项检查，并由你手动保存。是否继续？'
    );
    if (!approved) return;

    isFilling = true;
    const button = document.getElementById(BUTTON_ID);
    if (button) {
      button.disabled = true;
      button.textContent = '正在辅助填写…';
    }

    try {
      const selects = findEvaluationSelects();
      let selectedCount = 0;

      for (const select of selects) {
        try {
          if (await selectVerySatisfied(select)) selectedCount += 1;
        } catch (error) {
          console.warn(`[${SCRIPT_ID}] 下拉框处理失败：`, error);
        }
      }

      const textareaCount = await fillTextareas();
      const skippedCount = selects.length - selectedCount;

      window.alert(
        '辅助填写完成，请人工检查：\n\n' +
        `发现下拉框数量：${selects.length}\n` +
        `成功选择数量：${selectedCount}\n` +
        `失败/跳过数量：${skippedCount}\n` +
        `填写文本框数量：${textareaCount}\n\n` +
        '脚本没有保存或提交，请确认内容后手动操作。'
      );
    } finally {
      isFilling = false;
      if (button) {
        button.disabled = false;
        button.textContent = '辅助填写教评';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID} {
        position: fixed;
        right: 24px;
        bottom: 28px;
        z-index: 2147483000;
        padding: 12px 18px;
        border: 0;
        border-radius: 999px;
        color: #fff;
        background: #1769e0;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
        font: 600 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
      }
      #${BUTTON_ID}:hover { background: #0f58c7; }
      #${BUTTON_ID}:focus-visible { outline: 3px solid rgba(23, 105, 224, 0.35); outline-offset: 3px; }
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
    button.textContent = '辅助填写教评';
    button.setAttribute('aria-label', '辅助填写教评，不会自动保存或提交');
    button.addEventListener('click', fillEvaluation);
    document.body.appendChild(button);
  }

  function unmountButton() {
    document.getElementById(BUTTON_ID)?.remove();
  }

  function syncUIWithPage() {
    if (isEvaluationPage()) mountButton();
    else unmountButton();
  }

  // ---------------------------------------------------------------------------
  // bootstrap
  // ---------------------------------------------------------------------------

  function bootstrap() {
    patchHistory();
    syncUIWithPage();

    const observer = new MutationObserver(schedulePageCheck);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setInterval(syncUIWithPage, 2000);
  }

  bootstrap();
})();
