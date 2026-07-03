// ==UserScript==
// @name         SIAT/SUAT 教师评价辅助填写 AI
// @namespace    https://github.com/Gzx-070829/suat-course-eval-helper
// @version      0.1.0
// @description  深圳理工大学教评辅助工具：可选 AI 生成开放式评价草稿；不自动保存、不自动提交
// @author       Gzx-070829
// @homepageURL  https://github.com/Gzx-070829/suat-course-eval-helper
// @supportURL   https://github.com/Gzx-070829/suat-course-eval-helper/issues
// @downloadURL  https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper-ai.user.js
// @updateURL    https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper-ai.user.js
// @match        https://education.siat.ac.cn/*
// @match        https://education.suat-sz.edu.cn/*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // constants
  // ---------------------------------------------------------------------------

  const SCRIPT_ID = 'suat-eval-helper-ai';
  const PANEL_ID = `${SCRIPT_ID}-panel`;
  const STYLE_ID = `${SCRIPT_ID}-style`;
  const SETTINGS_KEY = `${SCRIPT_ID}:settings`;
  const PAGE_KEYWORDS = ['评价详情', '课程名称', '教师'];
  const FORBIDDEN_ACTION_PATTERN = /(保存|提交|确认|完成评价|立即评价)/;
  const RATING_LABELS = {
    verySatisfied: ['非常满意（5分）', '非常满意(5分)', '非常满意'],
    satisfied: ['满意（4分）', '满意(4分)', '满意']
  };
  const TEXT_TEMPLATES = {
    advantage: '老师授课认真负责，课程内容安排清晰，重点突出，能够结合课程内容进行讲解，对学生学习有帮助。',
    suggestion: '希望之后可以适当增加课堂互动、案例分析或实践练习，帮助学生进一步理解和掌握课程内容。'
  };
  const DEFAULT_SETTINGS = {
    rating: 'verySatisfied',
    mode: 'template',
    tone: '自然正式',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    apiKey: ''
  };
  const TIMING = {
    routeDebounce: 300,
    selectOpen: 260,
    selectClose: 100,
    elementScroll: 120
  };

  let routeTimer = 0;
  let isBusy = false;

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
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
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

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getSettings() {
    try {
      const saved = GM_getValue(SETTINGS_KEY, {});
      return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
    } catch (error) {
      console.warn(`[${SCRIPT_ID}] 读取设置失败：`, error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  function setStatus(message, type = 'info') {
    const status = document.querySelector(`#${PANEL_ID} [data-role="status"]`);
    if (!status) return;
    status.textContent = message;
    status.dataset.type = type;
  }

  function getControl(name) {
    return document.querySelector(`#${PANEL_ID} [data-field="${name}"]`);
  }

  function readPanelValues() {
    return {
      rating: getControl('rating')?.value || 'verySatisfied',
      mode: getControl('mode')?.value || 'template',
      tone: getControl('tone')?.value || '自然正式',
      extra: getControl('extra')?.value.trim() || '',
      baseUrl: getControl('baseUrl')?.value.trim() || '',
      model: getControl('model')?.value.trim() || '',
      apiKey: getControl('apiKey')?.value.trim() || '',
      draft: getControl('draft')?.value.trim() || ''
    };
  }

  function setBusy(busy, message = '') {
    isBusy = busy;
    document.querySelectorAll(`#${PANEL_ID} button`).forEach((button) => {
      button.disabled = busy;
    });
    if (message) setStatus(message, 'info');
  }

  // ---------------------------------------------------------------------------
  // page detection
  // ---------------------------------------------------------------------------

  function isEvaluationPage() {
    if (location.pathname.includes('/teaching/evaluation')) return true;
    const pageText = document.body ? document.body.innerText.slice(0, 120000) : '';
    return PAGE_KEYWORDS.filter((keyword) => pageText.includes(keyword)).length >= 2;
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

  function extractLabeledValue(labels) {
    const nodes = Array.from(document.querySelectorAll('label, .el-form-item__label, th, dt, span, div'));

    for (const node of nodes) {
      if (!isRenderable(node)) continue;
      const ownText = normalizeText(node.childNodes.length === 1 ? node.textContent : node.innerText);
      const matchedLabel = labels.find((label) => ownText === normalizeText(label) || ownText === `${normalizeText(label)}：`);
      if (!matchedLabel) continue;

      const formItem = node.closest('.el-form-item, tr, dl, [class*="detail"]');
      if (formItem) {
        const fullText = formItem.innerText.replace(node.innerText, '').replace(/^[:：\s]+/, '').trim();
        if (fullText && fullText.length <= 100) return fullText;
      }

      const sibling = node.nextElementSibling;
      if (sibling?.innerText?.trim()) return sibling.innerText.trim().slice(0, 100);
    }

    const bodyText = document.body?.innerText || '';
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = bodyText.match(new RegExp(`${escaped}\\s*[:：]\\s*([^\\n]{1,100})`));
      if (match) return match[1].trim();
    }
    return '未识别';
  }

  function extractPageContext() {
    const courseName = extractLabeledValue(['课程名称', '课程']);
    const teacherName = extractLabeledValue(['教师姓名', '授课教师', '教师']);
    const questions = [];
    const fields = Array.from(document.querySelectorAll('.el-select, textarea, .el-textarea__inner'))
      .filter((field) => !field.closest(`#${PANEL_ID}`));

    for (const field of fields) {
      const container = field.closest('.el-form-item, .form-item, [class*="question"], tr, li') || field.parentElement;
      const label = container?.querySelector('.el-form-item__label, label, th, [class*="title"]');
      const text = (label?.innerText || container?.innerText || '').trim().replace(/\s+/g, ' ');
      if (text && text.length <= 180 && !questions.includes(text)) questions.push(text);
      if (questions.length >= 12) break;
    }

    return {
      courseName,
      teacherName,
      questions: questions.length ? questions : ['请对本课程和教师进行评价']
    };
  }

  // ---------------------------------------------------------------------------
  // form detection
  // ---------------------------------------------------------------------------

  function findEvaluationSelects() {
    return Array.from(document.querySelectorAll('.el-select')).filter((select) => {
      return isRenderable(select) &&
        !select.classList.contains('is-disabled') &&
        select.getAttribute('aria-disabled') !== 'true';
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
    return Array.from(new Set(document.querySelectorAll('textarea, .el-textarea__inner'))).filter((textarea) => {
      return textarea instanceof HTMLTextAreaElement &&
        !textarea.closest(`#${PANEL_ID}`) &&
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

  function findRatingItem(items, rating) {
    const targets = RATING_LABELS[rating] || [];
    for (const target of targets) {
      const exact = items.find((item) => normalizeText(item.innerText) === normalizeText(target));
      if (exact) return exact;
    }
    return null;
  }

  async function selectRating(select, rating) {
    await revealElement(select);
    const trigger = select.querySelector('input.el-input__inner, .el-input__inner, [role="combobox"]') || select;
    if (!safeClick(trigger)) return false;
    await sleep(TIMING.selectOpen);

    const targetItem = findRatingItem(findVisibleDropdownItems(), rating);
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

  async function fillPageTextareas(mode, draft) {
    const textareas = findTextareas();
    let filled = 0;

    for (let index = 0; index < textareas.length; index += 1) {
      const textarea = textareas[index];
      if (textarea.value.trim()) continue;

      const text = mode === 'ai' ? draft : chooseTemplate(textarea, index);
      if (!text) continue;

      await revealElement(textarea);
      textarea.focus();
      textarea.value = text;
      dispatchInputEvents(textarea);
      filled += 1;
    }
    return filled;
  }

  async function prefillPage() {
    if (isBusy) return;
    const values = readPanelValues();

    if (values.mode === 'ai' && !values.draft) {
      setStatus('请先生成或手动输入 AI 草稿。', 'error');
      return;
    }

    const ratingDescription = values.rating === 'none'
      ? '不自动选择评分'
      : `尝试选择“${values.rating === 'satisfied' ? '满意' : '非常满意'}”`;
    const approved = window.confirm(
      `即将预填页面：\n\n1. ${ratingDescription}\n2. 仅填写当前为空的开放式评价\n` +
      '3. 不会自动点击“保存”“提交”或“确认”\n\n请在预填后逐项检查，并由你手动保存。是否继续？'
    );
    if (!approved) return;

    setBusy(true, '正在逐项预填，请稍候…');
    try {
      const selects = findEvaluationSelects();
      let selectedCount = 0;

      if (values.rating !== 'none') {
        for (const select of selects) {
          try {
            if (await selectRating(select, values.rating)) selectedCount += 1;
          } catch (error) {
            console.warn(`[${SCRIPT_ID}] 下拉框处理失败：`, error);
          }
        }
      }

      const textareaCount = await fillPageTextareas(values.mode, values.draft);
      const skippedCount = selects.length - selectedCount;

      window.alert(
        '辅助预填完成，请人工检查：\n\n' +
        `发现下拉框数量：${selects.length}\n` +
        `成功选择数量：${selectedCount}\n` +
        `失败/跳过数量：${skippedCount}\n` +
        `填写文本框数量：${textareaCount}\n\n` +
        '脚本没有保存或提交，请确认内容后手动操作。'
      );
      setStatus('预填完成。请逐项检查后手动保存。', 'success');
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------------------
  // AI client
  // ---------------------------------------------------------------------------

  function buildEndpoint(baseUrl) {
    const trimmed = baseUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
  }

  function requestChatCompletion({ baseUrl, model, apiKey, messages }) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: buildEndpoint(baseUrl),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        data: JSON.stringify({ model, messages, temperature: 0.7 }),
        timeout: 60000,
        onload(response) {
          let data;
          try {
            data = JSON.parse(response.responseText);
          } catch (error) {
            reject(new Error(`API 返回了无法解析的内容（HTTP ${response.status}）`));
            return;
          }

          if (response.status < 200 || response.status >= 300) {
            reject(new Error(data?.error?.message || `API 请求失败（HTTP ${response.status}）`));
            return;
          }

          const content = data?.choices?.[0]?.message?.content;
          if (typeof content !== 'string' || !content.trim()) {
            reject(new Error('API 响应中没有可用的草稿文本。'));
            return;
          }
          resolve(content.trim());
        },
        onerror() {
          reject(new Error('网络请求失败，请检查 Base URL、网络和服务商设置。'));
        },
        ontimeout() {
          reject(new Error('API 请求超时，请稍后重试。'));
        }
      });
    });
  }

  async function generateDraft() {
    if (isBusy) return;
    const values = readPanelValues();

    if (values.mode !== 'ai') {
      setStatus('AI 默认关闭。请先把“评价模式”改为“AI 草稿”。', 'error');
      return;
    }
    if (!values.baseUrl || !values.model || !values.apiKey) {
      setStatus('请完整填写 API Base URL、Model 和 API Key。', 'error');
      return;
    }

    const context = extractPageContext();
    const approved = window.confirm(
      '生成草稿会把以下内容发送到你配置的 API 服务：\n\n' +
      `课程名称：${context.courseName}\n` +
      `教师姓名：${context.teacherName}\n` +
      '页面评价问题文本，以及你的补充说明。\n\n' +
      'API Key 仅保存在 Tampermonkey 存储中。是否继续发送？'
    );
    if (!approved) return;

    const systemMessage = [
      '你是课程评价写作助手。',
      '根据课程名、教师名、评价方向和用户补充，生成真实、礼貌、具体、建设性的评价草稿。',
      '不要夸张吹捧，不要编造不存在的事实，不要替用户做最终判断。',
      '只输出一段可编辑的中文评价草稿，字数控制在 60 到 120 个汉字。'
    ].join('\n');
    const userMessage = [
      `课程名称：${context.courseName}`,
      `教师姓名：${context.teacherName}`,
      `评价方向：${context.questions.join('；')}`,
      `语气：${values.tone}`,
      `用户补充：${values.extra || '无；仅依据已提供信息稳妥表达，不要补充具体事实。'}`
    ].join('\n');

    setBusy(true, '正在请求 AI 草稿…');
    try {
      const draft = await requestChatCompletion({
        baseUrl: values.baseUrl,
        model: values.model,
        apiKey: values.apiKey,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ]
      });
      getControl('draft').value = draft;
      setStatus('草稿已生成。请先修改和确认，再点击“预填页面”。', 'success');
    } catch (error) {
      console.error(`[${SCRIPT_ID}] AI 草稿生成失败：`, error);
      setStatus(`生成失败：${error.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  function saveSettings() {
    const values = readPanelValues();
    try {
      GM_setValue(SETTINGS_KEY, {
        rating: values.rating,
        tone: values.tone,
        baseUrl: values.baseUrl,
        model: values.model,
        apiKey: values.apiKey
      });
      setStatus('设置已保存到 Tampermonkey 本地存储。', 'success');
    } catch (error) {
      console.error(`[${SCRIPT_ID}] 保存设置失败：`, error);
      setStatus('设置保存失败，请检查 Tampermonkey 权限。', 'error');
    }
  }

  function syncModeUI() {
    const isAiMode = getControl('mode')?.value === 'ai';
    const aiSection = document.querySelector(`#${PANEL_ID} [data-role="ai-section"]`);
    const draft = getControl('draft');
    if (aiSection) aiSection.hidden = !isAiMode;
    const fixedDraft = `${TEXT_TEMPLATES.advantage}\n${TEXT_TEMPLATES.suggestion}`;
    if (draft && isAiMode && draft.value.trim() === fixedDraft) {
      draft.value = '';
    } else if (draft && !isAiMode && !draft.value.trim()) {
      draft.value = fixedDraft;
    }
    setStatus(
      isAiMode
        ? 'AI 模式已开启；只有点击“生成草稿”才会请求外部 API。'
        : '固定模板模式，不会发送任何页面数据。',
      'info'
    );
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}, #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} {
        position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
        width: min(380px, calc(100vw - 28px)); max-height: calc(100vh - 40px); overflow: auto;
        padding: 16px; border: 1px solid #d9e2f0; border-radius: 14px;
        color: #172033; background: #fff; box-shadow: 0 12px 38px rgba(23, 32, 51, 0.24);
        font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #${PANEL_ID} h2 { margin: 0 0 4px; font-size: 17px; }
      #${PANEL_ID} .suat-note { margin: 0 0 12px; color: #657086; font-size: 12px; }
      #${PANEL_ID} .suat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      #${PANEL_ID} label { display: block; margin: 9px 0 4px; color: #3c465a; font-size: 12px; font-weight: 600; }
      #${PANEL_ID} input, #${PANEL_ID} select, #${PANEL_ID} textarea {
        width: 100%; border: 1px solid #cdd6e5; border-radius: 8px; padding: 8px 9px;
        color: #172033; background: #fff; font: inherit;
      }
      #${PANEL_ID} textarea { min-height: 68px; resize: vertical; }
      #${PANEL_ID} [data-field="draft"] { min-height: 112px; }
      #${PANEL_ID} input:focus, #${PANEL_ID} select:focus, #${PANEL_ID} textarea:focus {
        border-color: #1769e0; outline: 2px solid rgba(23, 105, 224, 0.16);
      }
      #${PANEL_ID} .suat-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
      #${PANEL_ID} button {
        min-height: 36px; border: 0; border-radius: 8px; padding: 8px 10px;
        color: #fff; background: #1769e0; font: 600 13px/1.3 inherit; cursor: pointer;
      }
      #${PANEL_ID} button[data-action="save"] { color: #26415f; background: #eaf1fa; }
      #${PANEL_ID} button[data-action="prefill"] { grid-column: 1 / -1; background: #127a4b; }
      #${PANEL_ID} button:disabled { opacity: 0.6; cursor: wait; }
      #${PANEL_ID} [data-role="status"] { margin: 10px 0 0; padding: 8px; border-radius: 7px; background: #f2f5f9; font-size: 12px; }
      #${PANEL_ID} [data-role="status"][data-type="success"] { color: #12613f; background: #e9f7ef; }
      #${PANEL_ID} [data-role="status"][data-type="error"] { color: #9b2c2c; background: #fff0f0; }
      #${PANEL_ID} [hidden] { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  function mountPanel() {
    if (document.getElementById(PANEL_ID)) return;
    injectStyles();
    const settings = getSettings();

    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-label', 'SIAT/SUAT 教师评价辅助填写 AI 面板');
    panel.innerHTML = `
      <h2>教评辅助填写</h2>
      <p class="suat-note">只预填，不保存、不提交。所有结果请人工检查。</p>

      <div class="suat-grid">
        <div>
          <label for="${PANEL_ID}-rating">评分选择</label>
          <select id="${PANEL_ID}-rating" data-field="rating">
            <option value="verySatisfied">非常满意</option>
            <option value="satisfied">满意</option>
            <option value="none">不自动选择</option>
          </select>
        </div>
        <div>
          <label for="${PANEL_ID}-mode">评价模式</label>
          <select id="${PANEL_ID}-mode" data-field="mode">
            <option value="template">固定模板</option>
            <option value="ai">AI 草稿</option>
          </select>
        </div>
      </div>

      <label for="${PANEL_ID}-tone">语气选择</label>
      <select id="${PANEL_ID}-tone" data-field="tone">
        <option>自然正式</option>
        <option>简洁</option>
        <option>具体建设性</option>
        <option>温和指出问题</option>
      </select>

      <label for="${PANEL_ID}-extra">用户补充</label>
      <textarea id="${PANEL_ID}-extra" data-field="extra" placeholder="可填写真实感受、希望强调的优点或建议"></textarea>

      <div data-role="ai-section" hidden>
        <label for="${PANEL_ID}-base-url">API Base URL</label>
        <input id="${PANEL_ID}-base-url" data-field="baseUrl" type="url" placeholder="https://api.example.com/v1">

        <div class="suat-grid">
          <div>
            <label for="${PANEL_ID}-model">Model</label>
            <input id="${PANEL_ID}-model" data-field="model" placeholder="模型名称">
          </div>
          <div>
            <label for="${PANEL_ID}-api-key">API Key</label>
            <input id="${PANEL_ID}-api-key" data-field="apiKey" type="password" autocomplete="off" placeholder="仅存于篡改猴">
          </div>
        </div>
      </div>

      <label for="${PANEL_ID}-draft">评价草稿（请先预览和修改）</label>
      <textarea id="${PANEL_ID}-draft" data-field="draft"></textarea>

      <div class="suat-actions">
        <button type="button" data-action="save">保存设置</button>
        <button type="button" data-action="generate">生成草稿</button>
        <button type="button" data-action="prefill">预填页面（不会保存/提交）</button>
      </div>
      <p data-role="status" data-type="info" aria-live="polite"></p>
    `;
    document.body.appendChild(panel);

    getControl('rating').value = settings.rating;
    // AI mode intentionally starts disabled on every page load. It is never
    // restored automatically, even if the user saved other API settings.
    getControl('mode').value = 'template';
    getControl('tone').value = settings.tone;
    getControl('baseUrl').value = settings.baseUrl;
    getControl('model').value = settings.model;
    getControl('apiKey').value = settings.apiKey;
    getControl('draft').value = `${TEXT_TEMPLATES.advantage}\n${TEXT_TEMPLATES.suggestion}`;

    getControl('mode').addEventListener('change', syncModeUI);
    panel.querySelector('[data-action="save"]').addEventListener('click', saveSettings);
    panel.querySelector('[data-action="generate"]').addEventListener('click', generateDraft);
    panel.querySelector('[data-action="prefill"]').addEventListener('click', prefillPage);
    syncModeUI();
  }

  function unmountPanel() {
    document.getElementById(PANEL_ID)?.remove();
  }

  function syncUIWithPage() {
    if (isEvaluationPage()) mountPanel();
    else unmountPanel();
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
