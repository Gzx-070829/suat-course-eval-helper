// ==UserScript==
// @name         SIAT/SUAT 教师评价辅助填写 AI
// @namespace    https://github.com/Gzx-070829/suat-course-eval-helper
// @version      1.0.0-beta
// @description  深圳理工大学教评 AI 草稿辅助工具：用户主动生成、可编辑预览；不自动保存、不自动提交
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
  // constants and state
  // ---------------------------------------------------------------------------

  const SCRIPT = Object.freeze({ id: 'suat-eval-helper-ai', name: 'SIAT/SUAT 教师评价辅助填写 AI', version: '1.0.0-beta' });
  const IDS = Object.freeze({ button: `${SCRIPT.id}-button`, panel: `${SCRIPT.id}-panel`, style: `${SCRIPT.id}-style` });
  const SETTINGS_KEY = `${SCRIPT.id}:settings`;
  const HOSTS = new Set(['education.siat.ac.cn', 'education.suat-sz.edu.cn']);
  const DEFAULTS = Object.freeze({ baseUrl: 'https://api.openai.com/v1', model: '', apiKey: '' });
  const state = {
    open: false, busy: false, drafts: [], snapshot: null, pageFingerprint: '',
    timer: 0, observer: null, historyPatched: false, operationToken: 0,
    lastScanAt: '尚未生成', lastErrorType: '无', lastTechnicalError: '无'
  };
  const TIMING = Object.freeze({ route: 350, scroll: 100 });

  // ---------------------------------------------------------------------------
  // utils
  // ---------------------------------------------------------------------------

  function normalizeText(value) { return String(value || '').replace(/[\u00a0\s]+/g, ' ').trim(); }
  function sleep(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  }
  function stableHash(value) {
    let hash = 2166136261;
    for (const char of String(value || '')) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }
  function isRenderable(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }
  function belongsToSchoolForm(element) {
    return element instanceof Element && !element.closest(`#${IDS.panel}`) && !element.closest(`#${IDS.button}`);
  }
  function setNativeValue(element, value) {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function reveal(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    await sleep(TIMING.scroll);
  }
  function setStatus(message, type = 'info') {
    const status = document.querySelector(`#${IDS.panel} [data-role="status"]`);
    if (status) { status.textContent = message; status.dataset.type = type; }
  }
  function setBusy(busy, message = '') {
    state.busy = busy;
    document.querySelectorAll(`#${IDS.panel} button, #${IDS.panel} select`).forEach((item) => { item.disabled = busy; });
    if (message) setStatus(message);
  }
  function rememberError(type, detail = '') {
    state.lastErrorType = type;
    state.lastTechnicalError = String(detail || type).replace(/Bearer\s+\S+/gi, 'Bearer [已隐藏]').slice(0, 300);
  }
  function getSchoolPageText() {
    const text = document.body?.innerText || '';
    return [document.getElementById(IDS.button), document.getElementById(IDS.panel)]
      .reduce((value, node) => node?.innerText ? value.replace(node.innerText, '') : value, text);
  }

  // ---------------------------------------------------------------------------
  // page detection and context
  // ---------------------------------------------------------------------------

  function pageSignals() {
    const text = getSchoolPageText();
    const hits = ['评价详情', '课程名称', '教师', '设置分值'].filter((word) => text.includes(word));
    const recognized = HOSTS.has(location.hostname) && (
      (location.pathname.includes('/teaching/evaluation') && text.includes('评价')) ||
      ['评价详情', '课程名称', '教师'].every((word) => text.includes(word)) ||
      (text.includes('设置分值') && Boolean(document.querySelector('textarea, .el-select')))
    );
    return { recognized, hits };
  }

  function extractLabeledValue(names) {
    const labels = Array.from(document.querySelectorAll('label, th, dt, .el-form-item__label'));
    for (const label of labels) {
      const labelText = normalizeText(label.textContent).replace(/[：:]$/, '');
      if (!names.includes(labelText)) continue;
      const container = label.closest('.el-form-item, tr, dl') || label.parentElement;
      const value = normalizeText(container?.innerText || '').replace(normalizeText(label.textContent), '').replace(/^[:：]/, '').trim();
      if (value && value.length <= 100) return value;
      const sibling = label.nextElementSibling;
      if (normalizeText(sibling?.innerText)) return normalizeText(sibling.innerText).slice(0, 100);
    }
    return '未识别';
  }

  function pageFingerprint() {
    const identity = `${extractLabeledValue(['课程名称', '课程'])}|${extractLabeledValue(['教师姓名', '授课教师', '教师'])}`;
    return `${location.hostname}${location.pathname}${location.search}${location.hash}:${stableHash(identity)}`;
  }

  function findSchoolTextareas() {
    return Array.from(document.querySelectorAll('textarea')).filter((item) => item instanceof HTMLTextAreaElement && belongsToSchoolForm(item) && isRenderable(item));
  }

  function cleanQuestionText(value, textarea) {
    let text = String(value || '');
    if (textarea.value) text = text.replace(textarea.value, ' ');
    return normalizeText(text
      .replace(/(?:^|\s)[（(]?\d+[）).、．]\s*/g, ' ')
      .replace(/[＊*]+/g, ' ')
      .replace(/请输入|最多\s*\d+\s*字|还可输入\s*\d+\s*字|\d+\s*\/\s*\d+|不能为空|必填项?/g, ' '));
  }

  function collectQuestionContext(textarea) {
    const candidates = [];
    const labelledBy = textarea.getAttribute('aria-labelledby');
    if (labelledBy) candidates.push(labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.innerText || '').join(' '));
    if (textarea.id) {
      const label = Array.from(document.querySelectorAll('label[for]')).find((item) => item.htmlFor === textarea.id);
      if (label) candidates.push(label.innerText);
    }
    const item = textarea.closest('.el-form-item, .form-item, [class*="question"], li, fieldset');
    candidates.push(item?.querySelector('.el-form-item__label, legend, label, [class*="title"]')?.innerText || '');
    const row = textarea.closest('tr');
    candidates.push(row?.querySelector('th')?.innerText || '');
    const cell = textarea.closest('td');
    candidates.push(cell?.previousElementSibling?.innerText || '');
    let sibling = textarea.previousElementSibling;
    while (sibling && candidates.length < 9) { candidates.push(sibling.innerText || sibling.textContent || ''); sibling = sibling.previousElementSibling; }
    candidates.push(item?.innerText || textarea.parentElement?.innerText || '');
    for (const candidate of candidates) {
      const text = cleanQuestionText(candidate, textarea);
      if (text.length >= 2 && text.length <= 180) return text;
    }
    return '未识别到明确题目';
  }

  function collectContext() {
    const fields = findSchoolTextareas();
    return {
      courseName: extractLabeledValue(['课程名称', '课程']),
      teacherName: extractLabeledValue(['教师姓名', '授课教师', '教师']),
      fields,
      questions: fields.map(collectQuestionContext)
    };
  }

  // ---------------------------------------------------------------------------
  // settings and AI client
  // ---------------------------------------------------------------------------

  function getSettings() {
    try { return { ...DEFAULTS, ...(GM_getValue(SETTINGS_KEY, {}) || {}) }; }
    catch (error) { rememberError('读取 API 设置失败', error.message); return { ...DEFAULTS }; }
  }

  function readSettingsForm() {
    const panel = document.getElementById(IDS.panel);
    return {
      baseUrl: panel?.querySelector('[data-field="baseUrl"]')?.value.trim() || '',
      model: panel?.querySelector('[data-field="model"]')?.value.trim() || '',
      apiKey: panel?.querySelector('[data-field="apiKey"]')?.value.trim() || ''
    };
  }

  function settingsComplete(settings) { return Boolean(settings.baseUrl && settings.model && settings.apiKey); }

  function saveSettings() {
    const settings = readSettingsForm();
    if (!settingsComplete(settings)) { setStatus('请完整填写 Base URL、Model 和 API Key。', 'error'); return; }
    try {
      GM_setValue(SETTINGS_KEY, settings);
      updateSettingsStatus(settings);
      setStatus('API 设置已保存在 Tampermonkey 本地存储中。', 'success');
    } catch (error) { rememberError('保存 API 设置失败', error.message); setStatus('设置保存失败，请检查 Tampermonkey 权限。', 'error'); }
  }

  function clearApiKey() {
    const settings = readSettingsForm();
    settings.apiKey = '';
    GM_setValue(SETTINGS_KEY, settings);
    const input = document.querySelector(`#${IDS.panel} [data-field="apiKey"]`);
    if (input) input.value = '';
    updateSettingsStatus(settings);
    setStatus('API Key 已从本地脚本存储中清除。', 'success');
  }

  function endpointFor(baseUrl) {
    const value = baseUrl.replace(/\/+$/, '');
    return value.endsWith('/chat/completions') ? value : `${value}/chat/completions`;
  }

  function requestCompletion(settings, messages) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST', url: endpointFor(settings.baseUrl), timeout: 30000,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
        data: JSON.stringify({ model: settings.model, messages, temperature: 0.7 }),
        onload(response) {
          if (response.status < 200 || response.status >= 300) {
            const error = new Error(`HTTP ${response.status}`); error.status = response.status; reject(error); return;
          }
          try {
            const data = JSON.parse(response.responseText);
            const content = data?.choices?.[0]?.message?.content;
            if (typeof content !== 'string' || !content.trim()) throw new Error('响应中没有草稿内容');
            resolve(content.trim());
          } catch (error) { error.kind = 'format'; reject(error); }
        },
        onerror() { const error = new Error('网络连接失败'); error.kind = 'network'; reject(error); },
        ontimeout() { const error = new Error('请求超时'); error.kind = 'timeout'; reject(error); }
      });
    });
  }

  function friendlyError(error) {
    if (error.status === 401 || error.status === 403) return 'API Key 无效或没有访问权限。';
    if (error.status === 402 || error.status === 429) return 'API 服务额度不足或请求过于频繁。';
    if (error.status === 404) return 'Base URL 或模型名称可能错误。';
    if (error.kind === 'timeout') return '请求超时，请稍后重试。';
    if (error.kind === 'network') return 'Base URL 无法访问，请检查地址和网络。';
    if (error.kind === 'format') return 'API 返回格式异常，未找到可用草稿。';
    if (error.status >= 500) return 'API 服务暂时不可用，请稍后重试。';
    return 'AI 草稿生成失败，请检查高级设置。';
  }

  function stripCodeFence(value) {
    return value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  function parseDrafts(content, count) {
    try {
      const parsed = JSON.parse(stripCodeFence(content));
      const list = Array.isArray(parsed) ? parsed : parsed?.drafts;
      if (!Array.isArray(list)) throw new Error('返回内容不是草稿列表');
      const result = Array(count).fill('');
      list.forEach((item, position) => {
        const index = Number.isInteger(item?.index) ? item.index : position;
        const draft = normalizeText(item?.draft || '');
        if (index >= 0 && index < count && draft) result[index] = draft;
      });
      if (!result.some(Boolean)) throw new Error('草稿列表为空');
      return result;
    } catch (error) {
      error.kind = 'format';
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // draft generation, apply and undo
  // ---------------------------------------------------------------------------

  async function generateAiDrafts() {
    if (state.busy) return;
    const settings = getSettings();
    if (!settingsComplete(settings)) {
      const details = document.querySelector(`#${IDS.panel} details[data-role="settings"]`);
      if (details) details.open = true;
      markMissingSettings(settings);
      setStatus('请先在“首次设置 / 高级设置”中完成 API 配置；尚未发送请求。', 'error');
      return;
    }
    const panel = document.getElementById(IDS.panel);
    const feelings = panel?.querySelector('[data-field="feelings"]')?.value.trim() || '';
    const tone = panel?.querySelector('[data-field="tone"]')?.value || '自然正式';
    const context = collectContext();
    if (!context.fields.length) { setStatus('没有找到可见开放题，请确认已进入具体评价页面。', 'error'); return; }

    const approved = window.confirm(
      `生成草稿将把以下信息发送到你配置的 API 服务：\n\n课程名、教师名、${context.questions.length} 个评价问题、你输入的真实感受、语气选择。\n\n不会发送登录密码、Cookie 或学校登录凭据。是否继续？`
    );
    if (!approved) return;

    const system = [
      '你是课程评价写作助手。根据课程名、教师名、评价问题和用户真实感受，逐题生成真实、礼貌、具体、建设性且便于用户修改的中文草稿。',
      '不要夸张吹捧，不要编造不存在的事实，不要替用户做最终判断。用户真实感受很少时，使用保守、中性的表达。单题 60 到 120 个汉字。',
      '只输出 JSON，不要输出解释或 Markdown。格式必须为：{"drafts":[{"index":0,"draft":"..."}]}，index 与评价问题编号一致。'
    ].join('\n');
    const user = [
      `课程名称：${context.courseName}`,
      `教师姓名：${context.teacherName}`,
      `语气：${tone}`,
      `用户真实感受：${feelings || '未补充；请保守表达，不要补充具体事实。'}`,
      '评价问题：',
      ...context.questions.map((question, index) => `${index}. ${question}`)
    ].join('\n');

    state.operationToken += 1;
    const token = state.operationToken;
    setBusy(true, '正在请求 AI 草稿…');
    try {
      const content = await requestCompletion(settings, [{ role: 'system', content: system }, { role: 'user', content: user }]);
      if (token !== state.operationToken || pageFingerprint() !== state.pageFingerprint) throw new Error('页面已经变化');
      const generated = parseDrafts(content, context.fields.length);
      state.drafts = context.fields.map((element, index) => ({
        id: `q${index}-${stableHash(context.questions[index])}`,
        element, question: context.questions[index], draft: generated[index],
        existing: Boolean(element.value.trim()) || element.disabled || element.readOnly,
        skip: Boolean(element.value.trim()) || element.disabled || element.readOnly || !generated[index]
      }));
      state.lastScanAt = new Date().toLocaleString('zh-CN', { hour12: false });
      state.lastErrorType = '无'; state.lastTechnicalError = '无';
      renderDraftCards();
      setStatus('AI 草稿已生成。请逐题检查、修改后，再点击“采用并预填”。', 'success');
    } catch (error) {
      const message = error.message === '页面已经变化' ? '页面已经变化，本次结果已丢弃。' : friendlyError(error);
      rememberError(message, `${error.kind || 'request'} ${error.status || ''} ${error.message}`);
      setStatus(message, 'error');
      console.warn(`[${SCRIPT.id}] AI request failed:`, error);
    } finally { setBusy(false); }
  }

  function captureDraftEdits() {
    const panel = document.getElementById(IDS.panel);
    state.drafts.forEach((item) => {
      const editor = panel?.querySelector(`[data-draft-editor="${item.id}"]`);
      const skip = panel?.querySelector(`[data-draft-skip="${item.id}"]`);
      if (editor) item.draft = editor.value;
      if (skip) item.skip = skip.checked;
    });
  }

  async function applyDrafts() {
    if (state.busy) return;
    captureDraftEdits();
    const selected = state.drafts.filter((item) => !item.skip && item.draft.trim());
    if (!selected.length) { setStatus('没有可采用的草稿，请先生成并检查草稿。', 'error'); return; }
    if (!window.confirm(`即将把 ${selected.length} 份草稿写入仍为空白的开放题。\n\n不会自动保存或提交，写入后仍需你检查。是否继续？`)) return;
    const fingerprint = pageFingerprint();
    const snapshot = { pageFingerprint: fingerprint, entries: [] };
    setBusy(true, '正在预填空白文本框…');
    let filled = 0; let skipped = 0;
    try {
      for (const item of selected) {
        const element = item.element;
        if (pageFingerprint() !== fingerprint) throw new Error('页面已经变化，操作已停止');
        if (!element?.isConnected || element.disabled || element.readOnly || !belongsToSchoolForm(element) || element.value.trim()) { skipped += 1; continue; }
        await reveal(element);
        if (element.value.trim()) { skipped += 1; continue; }
        const value = item.draft.trim();
        setNativeValue(element, value);
        snapshot.entries.push({ element, before: '', after: value });
        filled += 1;
      }
      state.snapshot = snapshot.entries.length ? snapshot : null;
      setStatus(`已预填 ${filled} 个文本框，跳过 ${skipped} 个已有或不可编辑项。请检查后手动保存。`, 'success');
      window.alert(`采用完成：\n\n填写文本框：${filled}\n跳过：${skipped}\n\n本工具没有保存或提交，请检查后手动操作。`);
    } catch (error) {
      state.snapshot = snapshot.entries.length ? snapshot : null;
      rememberError('预填过程失败', error.message);
      setStatus(error.message, 'error');
    } finally { setBusy(false); }
  }

  async function undoLastApply() {
    if (state.busy) return;
    if (!state.snapshot) { setStatus('当前没有可撤销的填写记录。', 'error'); return; }
    if (pageFingerprint() !== state.snapshot.pageFingerprint) { state.snapshot = null; setStatus('页面已经变化，旧撤销记录已失效。', 'error'); return; }
    setBusy(true, '正在撤销最近一次填写…');
    let restored = 0; let changed = 0;
    for (const entry of [...state.snapshot.entries].reverse()) {
      if (!entry.element?.isConnected || entry.element.value !== entry.after) { changed += 1; continue; }
      setNativeValue(entry.element, entry.before); restored += 1;
    }
    state.snapshot = null;
    setBusy(false);
    setStatus(`撤销完成：恢复 ${restored} 个文本框，因用户修改跳过 ${changed} 个。`, 'success');
  }

  // ---------------------------------------------------------------------------
  // diagnostics and UI
  // ---------------------------------------------------------------------------

  function diagnosticPayload() {
    const signals = pageSignals();
    const textareas = Array.from(document.querySelectorAll('textarea')).filter(belongsToSchoolForm);
    const selects = Array.from(document.querySelectorAll('.el-select')).filter(belongsToSchoolForm);
    return {
      scriptName: SCRIPT.name, version: SCRIPT.version, hostname: location.hostname, pathname: location.pathname,
      evaluationPageRecognized: signals.recognized, pageKeywordHits: signals.hits,
      selectTotal: selects.length, selectVisible: selects.filter(isRenderable).length,
      textareaTotal: textareas.length, textareaVisible: textareas.filter(isRenderable).length,
      textareaFillable: textareas.filter((item) => isRenderable(item) && !item.disabled && !item.readOnly && !item.value.trim()).length,
      apiConfigured: settingsComplete(getSettings()), lastScanAt: state.lastScanAt,
      lastErrorType: state.lastErrorType, lastTechnicalError: state.lastTechnicalError
    };
  }

  function showDiagnostics() {
    const box = document.querySelector(`#${IDS.panel} [data-role="diagnostics"]`);
    if (!box) return;
    const data = diagnosticPayload();
    box.hidden = false;
    box.innerHTML = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre><button type="button" data-action="copy-diagnostics">复制诊断信息</button>`;
    box.querySelector('button').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(JSON.stringify(data, null, 2)); setStatus('诊断信息已复制，不包含 API Key 或评价内容。', 'success'); }
      catch (error) { rememberError('复制诊断失败', error.message); setStatus('复制失败，请手动选择诊断文本。', 'error'); }
    });
  }

  function updateSettingsStatus(settings = getSettings()) {
    const label = document.querySelector(`#${IDS.panel} [data-role="settings-status"]`);
    if (label) label.textContent = settingsComplete(settings) ? `API 已配置（Key：••••${settings.apiKey.slice(-4)}）` : 'API 尚未完整配置';
  }

  function markMissingSettings(settings) {
    const panel = document.getElementById(IDS.panel);
    for (const field of ['baseUrl', 'model', 'apiKey']) {
      panel?.querySelector(`[data-field="${field}"]`)?.classList.toggle('suat-missing', !settings[field]);
    }
  }

  function renderDraftCards() {
    const container = document.querySelector(`#${IDS.panel} [data-role="drafts"]`);
    if (!container) return;
    container.innerHTML = state.drafts.length ? `<h3>AI 草稿（请逐题检查和修改）</h3>${state.drafts.map((item) => `
      <article class="suat-card"><p>${escapeHtml(item.question)}</p>
      ${item.existing ? '<small>此题已有内容或不可编辑，已自动跳过。</small>' : ''}
      <textarea data-draft-editor="${escapeHtml(item.id)}" ${item.existing ? 'disabled' : ''}>${escapeHtml(item.draft)}</textarea>
      <label class="suat-check"><input type="checkbox" data-draft-skip="${escapeHtml(item.id)}" ${item.skip ? 'checked' : ''} ${item.existing ? 'disabled' : ''}> 本题不填写</label></article>
    `).join('')}` : '';
    state.drafts.forEach((item) => {
      container.querySelector(`[data-draft-editor="${item.id}"]`)?.addEventListener('input', (event) => { item.draft = event.target.value; });
      container.querySelector(`[data-draft-skip="${item.id}"]`)?.addEventListener('change', (event) => { item.skip = event.target.checked; });
    });
  }

  function injectStyles() {
    if (document.getElementById(IDS.style)) return;
    const style = document.createElement('style'); style.id = IDS.style;
    style.textContent = `
      #${IDS.button}, #${IDS.panel}, #${IDS.panel} * { box-sizing: border-box; }
      #${IDS.button} { position:fixed;right:20px;bottom:20px;z-index:2147483000;border:0;border-radius:999px;padding:11px 17px;color:#fff;background:#6d3fc0;box-shadow:0 8px 28px rgba(109,63,192,.3);font:600 14px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer; }
      #${IDS.panel} { position:fixed;right:20px;bottom:74px;z-index:2147483000;width:min(430px,calc(100vw - 28px));max-height:calc(100vh - 94px);overflow:auto;padding:16px;border:1px solid #ddd6eb;border-radius:15px;color:#1e1930;background:#fff;box-shadow:0 16px 46px rgba(31,22,50,.25);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      #${IDS.panel}[hidden], #${IDS.panel} [hidden] { display:none!important; }
      #${IDS.panel} h2 { margin:0 0 6px;font-size:18px; } #${IDS.panel} h3 { font-size:14px;margin:14px 0 6px; }
      #${IDS.panel} .suat-note { margin:4px 0 10px;color:#625875;font-size:12px; }
      #${IDS.panel} label { display:block;margin:8px 0 4px;font-size:12px;font-weight:650; }
      #${IDS.panel} input, #${IDS.panel} select, #${IDS.panel} textarea { width:100%;border:1px solid #cec5dc;border-radius:8px;padding:8px 9px;color:#1e1930;background:#fff;font:inherit; }
      #${IDS.panel} textarea { min-height:86px;resize:vertical; } #${IDS.panel} textarea[data-field="feelings"] { min-height:74px; }
      #${IDS.panel} .suat-missing { border-color:#c63e3e;outline:2px solid rgba(198,62,62,.12); }
      #${IDS.panel} details { margin:12px 0;padding:9px 11px;border:1px solid #e3ddeb;border-radius:9px;background:#faf9fc; }
      #${IDS.panel} summary { cursor:pointer;font-weight:650; }
      #${IDS.panel} .suat-actions { display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0; }
      #${IDS.panel} button { min-height:36px;border:0;border-radius:8px;padding:8px 10px;color:#fff;background:#6d3fc0;font:600 13px/1.25 inherit;cursor:pointer; }
      #${IDS.panel} button[data-action="apply"] { background:#127a4b; } #${IDS.panel} button[data-action="undo"], #${IDS.panel} button[data-action="diagnostics"], #${IDS.panel} button[data-action="clear-key"] { color:#3e3153;background:#eee9f5; }
      #${IDS.panel} button:disabled { opacity:.55;cursor:wait; }
      #${IDS.panel} .suat-card { margin:10px 0;padding:11px;border:1px solid #e1daec;border-radius:10px;background:#fcfbfd; }
      #${IDS.panel} .suat-card p { margin:0 0 6px;font-weight:650; } #${IDS.panel} .suat-card small { display:block;margin-bottom:5px;color:#96630a; }
      #${IDS.panel} .suat-check { display:flex;align-items:center;gap:6px;font-weight:500; } #${IDS.panel} .suat-check input { width:auto;margin:0; }
      #${IDS.panel} [data-role="status"] { padding:8px 10px;border-radius:8px;background:#f3f0f7;font-size:12px; } #${IDS.panel} [data-role="status"][data-type="success"] { color:#12613f;background:#e9f7ef; } #${IDS.panel} [data-role="status"][data-type="error"] { color:#962f2f;background:#fff0f0; }
      #${IDS.panel} [data-role="diagnostics"] { margin-top:10px;padding:10px;border-radius:9px;background:#f6f4f9; } #${IDS.panel} pre { max-height:230px;overflow:auto;white-space:pre-wrap;font:11px/1.45 ui-monospace,Consolas,monospace; }
    `;
    document.head.appendChild(style);
  }

  function mountUI() {
    injectStyles();
    if (!document.getElementById(IDS.button)) {
      const button = document.createElement('button'); button.id = IDS.button; button.type = 'button'; button.textContent = '教评辅助 AI';
      button.addEventListener('click', () => { state.open = !state.open; const panel = document.getElementById(IDS.panel); if (panel) panel.hidden = !state.open; });
      document.body.appendChild(button);
    }
    if (document.getElementById(IDS.panel)) return;
    const settings = getSettings();
    const panel = document.createElement('section'); panel.id = IDS.panel; panel.hidden = !state.open;
    panel.innerHTML = `
      <h2>教评辅助 · AI</h2>
      <p class="suat-note">AI 版只在你主动点击生成时联网。生成内容需要你检查和修改。</p>
      <label>用户真实感受</label><textarea data-field="feelings" placeholder="写下真实的优点、问题或建议；请勿填写学号、密码等敏感信息"></textarea>
      <label>语气选择</label><select data-field="tone"><option>自然正式</option><option>简洁</option><option>具体建设性</option><option>温和指出问题</option></select>
      <div class="suat-actions"><button type="button" data-action="generate">生成 AI 草稿</button><button type="button" data-action="apply">采用并预填</button><button type="button" data-action="undo">撤销本次填写</button><button type="button" data-action="diagnostics">查看诊断信息</button></div>
      <details data-role="settings"><summary>首次设置 / 高级设置</summary>
        <p class="suat-note" data-role="settings-status"></p>
        <label>API Base URL</label><input data-field="baseUrl" type="url" value="${escapeHtml(settings.baseUrl)}" placeholder="https://api.example.com/v1">
        <label>Model</label><input data-field="model" value="${escapeHtml(settings.model)}" placeholder="模型名称">
        <label>API Key</label><input data-field="apiKey" type="password" value="${escapeHtml(settings.apiKey)}" autocomplete="off" placeholder="仅保存在篡改猴本地存储">
        <div class="suat-actions"><button type="button" data-action="save-settings">保存设置</button><button type="button" data-action="clear-key">清除 API Key</button></div>
      </details>
      <div data-role="status" data-type="info" aria-live="polite">输入真实感受后，可主动生成草稿。</div>
      <div data-role="drafts"></div><div data-role="diagnostics" hidden></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('[data-action="generate"]').addEventListener('click', generateAiDrafts);
    panel.querySelector('[data-action="apply"]').addEventListener('click', applyDrafts);
    panel.querySelector('[data-action="undo"]').addEventListener('click', undoLastApply);
    panel.querySelector('[data-action="diagnostics"]').addEventListener('click', showDiagnostics);
    panel.querySelector('[data-action="save-settings"]').addEventListener('click', saveSettings);
    panel.querySelector('[data-action="clear-key"]').addEventListener('click', clearApiKey);
    updateSettingsStatus(settings); renderDraftCards();
  }

  function unmountUI() { document.getElementById(IDS.button)?.remove(); document.getElementById(IDS.panel)?.remove(); state.open = false; }

  // ---------------------------------------------------------------------------
  // SPA lifecycle and bootstrap
  // ---------------------------------------------------------------------------

  function resetPage(next = '') { state.operationToken += 1; state.drafts = []; state.snapshot = null; state.pageFingerprint = next; state.lastScanAt = '尚未生成'; }
  function syncPage() {
    const signals = pageSignals();
    if (!signals.recognized) { if (state.pageFingerprint) resetPage(''); unmountUI(); return; }
    const next = pageFingerprint();
    if (next !== state.pageFingerprint) { resetPage(next); unmountUI(); }
    mountUI();
  }
  function scheduleSync() { clearTimeout(state.timer); state.timer = setTimeout(syncPage, TIMING.route); }
  function patchHistory() {
    if (state.historyPatched) return; state.historyPatched = true;
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method]; history[method] = function (...args) { const result = original.apply(this, args); scheduleSync(); return result; };
    }
    addEventListener('popstate', scheduleSync); addEventListener('hashchange', scheduleSync);
  }
  function bootstrap() {
    patchHistory();
    state.observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => { const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement; return !target?.closest?.(`#${IDS.panel}`) && !target?.closest?.(`#${IDS.button}`); })) scheduleSync();
    });
    state.observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    syncPage();
  }

  bootstrap();
})();
