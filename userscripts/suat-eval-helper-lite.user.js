// ==UserScript==
// @name         SIAT/SUAT 教师评价辅助填写 Lite
// @namespace    https://github.com/Gzx-070829/suat-course-eval-helper
// @version      1.0.0-beta
// @description  深圳理工大学教评离线智能辅助工具：本地生成可编辑草稿；不联网、不自动保存、不自动提交
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

  // ---------------------------------------------------------------------------
  // constants
  // ---------------------------------------------------------------------------

  const SCRIPT = Object.freeze({
    id: 'suat-eval-helper-lite',
    name: 'SIAT/SUAT 教师评价辅助填写 Lite',
    version: '1.0.0-beta'
  });
  const IDS = Object.freeze({
    button: `${SCRIPT.id}-button`,
    panel: `${SCRIPT.id}-panel`,
    style: `${SCRIPT.id}-style`
  });
  const ALLOWED_HOSTS = new Set(['education.siat.ac.cn', 'education.suat-sz.edu.cn']);
  const PAGE_KEYWORDS = ['评价详情', '课程名称', '教师', '设置分值'];
  const RATING_CONTEXT_PATTERN = /(评价|满意|分值|教学|课程|教师|评分)/;
  const TYPE_LABELS = Object.freeze({
    advantage: '优点类', suggestion: '建议类', interaction: '互动类',
    practice: '实践类', content: '内容类', general: '通用类'
  });
  const TYPE_RULES = Object.freeze([
    ['suggestion', ['建议', '意见', '改进', '不足', '希望', '需要加强', '可以提升', '优化']],
    ['interaction', ['互动', '讨论', '提问', '参与', '课堂氛围', '答疑', '反馈', '交流']],
    ['practice', ['实践', '实验', '案例', '练习', '作业', '项目', '代码', '动手', '应用']],
    ['content', ['内容', '重点', '难点', '结构', '进度', '安排', '知识', '章节', '讲解']],
    ['advantage', ['优点', '满意', '特色', '收获', '值得肯定', '教学效果', '认可', '亮点']]
  ]);
  const DRAFTS = Object.freeze({
    natural: {
      advantage: ['课程整体安排较为清晰，讲解重点明确，有助于理解和掌握相关内容。', '老师教学态度认真，课堂内容组织较清楚，对学生理解课程核心内容有帮助。'],
      suggestion: ['希望后续可以结合课程实际情况，适当增加案例讲解和重点内容总结，帮助学生进一步理解课程内容。', '建议在重点和难点部分适当放慢节奏，并增加一些阶段性回顾，便于学生及时梳理。'],
      interaction: ['希望课堂中可以适当增加提问、讨论或答疑环节，让学生有更多参与和反馈的机会。', '建议增加一些课堂互动或即时反馈，帮助老师了解学生的理解情况，也提高课堂参与感。'],
      practice: ['希望后续可以适当增加案例、练习或实践环节，帮助学生将课程内容与实际应用结合起来。', '建议结合课程内容安排更多练习、案例或项目式任务，帮助学生提升实际应用能力。'],
      content: ['课程内容安排较为完整，希望讲解时进一步突出重点和难点，并在关键章节增加总结。', '建议对课程中的核心知识点进行更清晰的梳理，帮助学生建立整体框架。'],
      general: ['课程整体体验较好，希望后续继续优化内容安排和课堂交流，帮助学生更好地理解和掌握课程内容。', '老师教学认真，课程整体安排较清晰，希望后续可以结合更多例子和互动进一步提升学习效果。']
    },
    concise: {
      advantage: ['课程安排清晰，重点较明确，有助于理解核心内容。', '课堂内容组织较清楚，整体学习体验较好。'],
      suggestion: ['建议适当增加案例和重点总结，帮助学生及时梳理。', '希望重点难点部分适当放慢节奏，并增加阶段性回顾。'],
      interaction: ['希望适当增加提问、讨论和答疑，提高课堂参与感。', '建议增加课堂互动和即时反馈，及时了解学习情况。'],
      practice: ['希望增加案例、练习或实践，帮助理解实际应用。', '建议适当增加项目式任务，提升实际应用能力。'],
      content: ['希望进一步突出重点难点，并在关键章节增加总结。', '建议更清晰地梳理核心知识点，帮助建立整体框架。'],
      general: ['课程整体体验较好，希望继续优化内容安排和课堂交流。', '课程安排较清晰，希望适当增加例子和互动。']
    },
    constructive: {
      advantage: ['课程整体安排较为清晰，讲解重点也比较明确，对理解核心内容有帮助。建议继续保持清楚的内容组织，并在关键章节加入简短回顾，方便学生形成完整的知识框架。', '老师教学态度认真，课程内容组织较清楚，能够帮助学生把握主要知识。后续若能结合重点内容增加阶段性总结，学习过程会更加连贯。'],
      suggestion: ['建议在重点和难点部分适当放慢节奏，并结合课程实际增加案例讲解和阶段性回顾，让学生能够及时发现疑问、梳理知识并跟上课程进度。', '希望后续进一步优化内容节奏，在核心章节增加总结、示例和答疑时间，帮助学生更稳妥地理解并巩固课程内容。'],
      interaction: ['希望课堂中适当增加提问、讨论和集中答疑环节，并为学生留出表达疑问的时间。这样既能获得更及时的学习反馈，也有助于提升课堂参与感。', '建议在关键知识点后加入简短互动或即时反馈，了解学生的理解情况，再针对常见疑问进行补充说明，使课堂交流更加充分。'],
      practice: ['希望结合课程内容安排更多案例、练习或小型实践任务，并在完成后进行讲解和总结，帮助学生理解知识如何应用，同时及时发现掌握不牢的部分。', '建议适当增加与核心内容对应的练习、案例或项目式任务，并给出清晰反馈，帮助学生把理论知识与实际应用联系起来。'],
      content: ['课程内容安排较为完整，建议讲解时进一步突出重点和难点，并在关键章节加入结构化总结和知识联系，帮助学生建立更清晰的整体框架。', '建议对核心知识点进行更清楚的分层梳理，适当说明章节之间的联系，并通过阶段性回顾帮助学生跟上课程进度。'],
      general: ['课程整体体验较好，希望后续继续优化内容安排、重点总结和课堂交流，并结合适量案例或练习，帮助学生更好地理解、巩固和应用课程内容。', '课程整体安排较清晰，建议后续在关键内容处增加总结、例子和互动反馈，让学生更容易把握重点并及时解决学习中的疑问。']
    }
  });
  const TIMING = Object.freeze({ route: 350, open: 260, settle: 140, scroll: 100 });

  const state = {
    open: false,
    drafts: [],
    snapshot: null,
    pageFingerprint: '',
    busy: false,
    routeTimer: 0,
    operationToken: 0,
    historyPatched: false,
    observer: null,
    diagnostics: {
      recognized: false,
      keywordHits: [],
      selectTotal: 0,
      selectVisible: 0,
      ratingCandidates: 0,
      textareaTotal: 0,
      textareaVisible: 0,
      textareaFillable: 0,
      lastScanAt: '尚未扫描',
      lastErrorType: '无'
    },
    lastResult: null
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

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function isRenderable(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (const char of String(value || '')) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function setNativeValue(element, value) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function reveal(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    await sleep(TIMING.scroll);
  }

  function markError(type, error) {
    state.diagnostics.lastErrorType = type || '未知错误';
    if (error) console.warn(`[${SCRIPT.id}] ${type}:`, error);
  }

  function nowText() {
    return new Date().toLocaleString('zh-CN', { hour12: false });
  }

  function getSchoolPageText() {
    const text = document.body?.innerText || '';
    const ownText = [document.getElementById(IDS.button), document.getElementById(IDS.panel)]
      .map((node) => node?.innerText || '').filter(Boolean);
    return ownText.reduce((result, part) => result.replace(part, ''), text);
  }

  // ---------------------------------------------------------------------------
  // page detection
  // ---------------------------------------------------------------------------

  function getPageSignals() {
    const text = getSchoolPageText();
    const keywordHits = PAGE_KEYWORDS.filter((word) => text.includes(word));
    const recognized = ALLOWED_HOSTS.has(location.hostname) && (
      (location.pathname.includes('/teaching/evaluation') && text.includes('评价')) ||
      ['评价详情', '课程名称', '教师'].every((word) => text.includes(word)) ||
      (text.includes('设置分值') && Boolean(document.querySelector('textarea, .el-select')))
    );
    return { recognized, keywordHits };
  }

  function extractInternalIdentity() {
    const labels = Array.from(document.querySelectorAll('label, th, dt, .el-form-item__label'));
    const values = [];
    for (const label of labels) {
      const text = normalizeText(label.textContent);
      if (!/^(课程名称|课程|教师姓名|授课教师|教师)[：:]?$/.test(text)) continue;
      const container = label.closest('.el-form-item, tr, dl') || label.parentElement;
      const value = normalizeText(container?.innerText || '').replace(text, '').replace(/^[:：]/, '').trim();
      if (value) values.push(value.slice(0, 100));
    }
    return values.join('|');
  }

  function makePageFingerprint() {
    return `${location.hostname}${location.pathname}${location.search}${location.hash}:${stableHash(extractInternalIdentity())}`;
  }

  // ---------------------------------------------------------------------------
  // form detection
  // ---------------------------------------------------------------------------

  function belongsToSchoolForm(element) {
    return element instanceof Element && !element.closest(`#${IDS.panel}`) && !element.closest(`#${IDS.button}`);
  }

  function getSelectValue(select) {
    const input = select.querySelector('input.el-input__inner, input[role="combobox"]');
    return normalizeText(input?.value || select.querySelector('.el-select__tags-text')?.textContent || '');
  }

  function getNearbyText(element) {
    const container = element.closest('.el-form-item, .form-item, [class*="question"], tr, li') || element.parentElement;
    return normalizeText(container?.innerText || '').slice(0, 260);
  }

  function findRatingCandidates() {
    return Array.from(document.querySelectorAll('.el-select')).filter((select) => {
      if (!belongsToSchoolForm(select) || !isRenderable(select)) return false;
      if (select.classList.contains('is-disabled') || select.getAttribute('aria-disabled') === 'true') return false;
      return RATING_CONTEXT_PATTERN.test(getNearbyText(select));
    });
  }

  function findSchoolTextareas() {
    return Array.from(document.querySelectorAll('textarea')).filter((textarea) => {
      return textarea instanceof HTMLTextAreaElement && belongsToSchoolForm(textarea) && isRenderable(textarea);
    });
  }

  function refreshDiagnosticCounts() {
    const selects = Array.from(document.querySelectorAll('.el-select')).filter(belongsToSchoolForm);
    const textareas = Array.from(document.querySelectorAll('textarea')).filter(belongsToSchoolForm);
    state.diagnostics.selectTotal = selects.length;
    state.diagnostics.selectVisible = selects.filter(isRenderable).length;
    state.diagnostics.ratingCandidates = findRatingCandidates().length;
    state.diagnostics.textareaTotal = textareas.length;
    state.diagnostics.textareaVisible = textareas.filter(isRenderable).length;
    state.diagnostics.textareaFillable = textareas.filter((item) => isRenderable(item) && !item.disabled && !item.readOnly && !item.value.trim()).length;
  }

  // ---------------------------------------------------------------------------
  // Element UI select handling
  // ---------------------------------------------------------------------------

  function canonicalRating(text) {
    const value = normalizeText(text).replace(/\s/g, '');
    const patterns = [
      ['verySatisfied', /^非常满意(?:[（(]?5分[）)]?)?$/],
      ['satisfied', /^满意(?:[（(]?4分[）)]?)?$/],
      ['general', /^(?:一般|一般满意)(?:[（(]?3分[）)]?)?$/],
      ['dissatisfied', /^不满意(?:[（(]?2分[）)]?)?$/],
      ['veryDissatisfied', /^非常不满意(?:[（(]?1分[）)]?)?$/]
    ];
    return patterns.find(([, pattern]) => pattern.test(value))?.[0] || '';
  }

  function visibleDropdowns() {
    return Array.from(document.querySelectorAll('.el-select-dropdown')).filter(isRenderable);
  }

  function resolveCurrentDropdown(select, before) {
    const after = visibleDropdowns();
    const newDropdowns = after.filter((item) => !before.has(item));
    if (newDropdowns.length === 1) return newDropdowns[0];
    const trigger = select.querySelector('[aria-controls], [aria-owns]');
    const controlledId = trigger?.getAttribute('aria-controls') || trigger?.getAttribute('aria-owns');
    const controlled = controlledId ? document.getElementById(controlledId) : null;
    if (controlled && isRenderable(controlled) && controlled.matches('.el-select-dropdown, .el-select-dropdown *')) {
      return controlled.closest('.el-select-dropdown') || controlled;
    }
    return after.length === 1 ? after[0] : null;
  }

  function closeCurrentSelect(trigger) {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  }

  async function fillOneRating(select, rating, token) {
    if (token !== state.operationToken || !select.isConnected) return { status: 'failed', reason: '页面已变化' };
    if (getSelectValue(select)) return { status: 'existing' };
    await reveal(select);
    if (getSelectValue(select)) return { status: 'existing' };

    const trigger = select.querySelector('input.el-input__inner, [role="combobox"]') || select;
    const beforeDropdowns = new Set(visibleDropdowns());
    trigger.click();
    await sleep(TIMING.open);
    const dropdown = resolveCurrentDropdown(select, beforeDropdowns);
    if (!dropdown) {
      closeCurrentSelect(trigger);
      return { status: 'unsafe', reason: '无法唯一识别当前下拉层' };
    }

    const items = Array.from(dropdown.querySelectorAll('.el-select-dropdown__item')).filter((item) => {
      return isRenderable(item) && !item.classList.contains('is-disabled') && item.getAttribute('aria-disabled') !== 'true';
    });
    const kinds = new Set(items.map((item) => canonicalRating(item.innerText)).filter(Boolean));
    if (kinds.size < 3) {
      closeCurrentSelect(trigger);
      return { status: 'unsafe', reason: '评分选项不足三个' };
    }

    const targets = items.filter((item) => canonicalRating(item.innerText) === rating);
    if (targets.length !== 1) {
      closeCurrentSelect(trigger);
      return { status: 'unsafe', reason: '目标评分不存在或不唯一' };
    }
    if (getSelectValue(select)) {
      closeCurrentSelect(trigger);
      return { status: 'existing' };
    }

    targets[0].click();
    await sleep(TIMING.settle);
    const afterValue = getSelectValue(select);
    if (canonicalRating(afterValue) !== rating) return { status: 'failed', reason: '选择后未能验证评分' };
    return { status: 'filled', afterValue };
  }

  async function clearRatingEntry(entry) {
    if (!entry.element?.isConnected || normalizeText(getSelectValue(entry.element)) !== normalizeText(entry.after)) return 'changed';
    entry.element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(80);
    const clear = entry.element.querySelector('.el-icon-circle-close, .is-show-close, [class*="circle-close"]');
    if (!clear || !isRenderable(clear)) return 'manual';
    clear.click();
    await sleep(TIMING.settle);
    return getSelectValue(entry.element) ? 'manual' : 'restored';
  }

  // ---------------------------------------------------------------------------
  // textarea question extraction
  // ---------------------------------------------------------------------------

  function cleanQuestionText(value, textarea) {
    let text = String(value || '');
    if (textarea?.value) text = text.replace(textarea.value, ' ');
    text = text
      .replace(/(?:^|\s)[（(]?\d+[）).、．]\s*/g, ' ')
      .replace(/[＊*]+/g, ' ')
      .replace(/请输入|最多\s*\d+\s*字|还可输入\s*\d+\s*字|\d+\s*\/\s*\d+/g, ' ')
      .replace(/校验失败|不能为空|必填项?|字数统计|清空|取消/g, ' ');
    return normalizeText(text).replace(/^[:：\-—]+|[:：\-—]+$/g, '').trim();
  }

  function collectQuestionContext(textarea) {
    const candidates = [];
    const labelledBy = textarea.getAttribute('aria-labelledby');
    if (labelledBy) {
      candidates.push(labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.innerText || '').join(' '));
    }
    if (textarea.id) {
      const label = Array.from(document.querySelectorAll('label[for]')).find((item) => item.htmlFor === textarea.id);
      if (label) candidates.push(label.innerText);
    }
    const formItem = textarea.closest('.el-form-item');
    candidates.push(formItem?.querySelector('.el-form-item__label')?.innerText || '');
    const row = textarea.closest('tr');
    if (row) {
      candidates.push(row.querySelector('th')?.innerText || '');
      const cell = textarea.closest('td');
      if (cell?.previousElementSibling) candidates.push(cell.previousElementSibling.innerText || '');
    }
    const questionContainer = textarea.closest('.form-item, [class*="question"], li, fieldset, .el-form-item');
    const title = questionContainer?.querySelector('legend, label, [class*="title"], [class*="label"]');
    candidates.push(title?.innerText || '');
    let sibling = textarea.previousElementSibling;
    while (sibling && candidates.length < 9) {
      candidates.push(sibling.innerText || sibling.textContent || '');
      sibling = sibling.previousElementSibling;
    }
    candidates.push(questionContainer?.innerText || textarea.parentElement?.innerText || '');

    for (const candidate of candidates) {
      const cleaned = cleanQuestionText(candidate, textarea);
      if (cleaned.length >= 2 && cleaned.length <= 180) return { text: cleaned, recognized: true };
    }
    return { text: '未识别到明确题目', recognized: false };
  }

  // ---------------------------------------------------------------------------
  // local draft generation
  // ---------------------------------------------------------------------------

  function inferQuestionType(questionText) {
    const text = normalizeText(questionText);
    let best = { type: 'general', score: 0, priority: TYPE_RULES.length };
    TYPE_RULES.forEach(([type, keywords], priority) => {
      let score = 0;
      for (const keyword of keywords) {
        const index = text.indexOf(keyword);
        if (index >= 0) score += 10 + Math.max(0, 5 - Math.floor(index / 12));
      }
      if (score > best.score || (score === best.score && score > 0 && priority < best.priority)) {
        best = { type, score, priority };
      }
    });
    return best.type;
  }

  function generateLocalDraft(questionType, style, questionText) {
    const collection = DRAFTS[style]?.[questionType] || DRAFTS[style]?.general || DRAFTS.natural.general;
    return collection[stableHash(`${questionType}|${style}|${questionText}`) % collection.length];
  }

  function captureDraftEdits() {
    const panel = document.getElementById(IDS.panel);
    if (!panel) return;
    for (const draft of state.drafts) {
      const editor = panel.querySelector(`[data-draft-editor="${draft.id}"]`);
      const skip = panel.querySelector(`[data-draft-skip="${draft.id}"]`);
      if (editor) draft.draft = editor.value;
      if (skip) draft.skip = skip.checked;
    }
  }

  function scanAndGenerate() {
    captureDraftEdits();
    const style = document.querySelector(`#${IDS.panel} [data-field="style"]`)?.value || 'natural';
    const textareas = findSchoolTextareas();
    const unknown = [];
    state.drafts = textareas.map((textarea, index) => {
      const question = collectQuestionContext(textarea);
      const type = question.recognized ? inferQuestionType(question.text) : 'general';
      if (!question.recognized) unknown.push(index + 1);
      const existing = Boolean(textarea.value.trim()) || textarea.disabled || textarea.readOnly;
      return {
        id: `q${index}-${stableHash(question.text)}`,
        element: textarea,
        question: question.text,
        recognized: question.recognized,
        type,
        draft: generateLocalDraft(type, style, question.text),
        skip: existing,
        existing
      };
    });
    state.diagnostics.lastScanAt = nowText();
    state.diagnostics.lastErrorType = unknown.length ? '部分题目文本识别失败' : '无';
    refreshDiagnosticCounts();
    renderDraftCards();
    setStatus(textareas.length ? `已生成 ${textareas.length} 份本地草稿，请逐题检查和修改。` : '没有找到可见文本框，请确认已进入具体课程评价页面。', textareas.length ? 'success' : 'error');
  }

  // ---------------------------------------------------------------------------
  // snapshot / undo
  // ---------------------------------------------------------------------------

  async function applyDrafts() {
    if (state.busy) return;
    captureDraftEdits();
    if (!state.drafts.length) {
      setStatus('请先点击“扫描并生成草稿”。', 'error');
      return;
    }
    const rating = document.querySelector(`#${IDS.panel} [data-field="rating"]`)?.value || 'none';
    const selectedDrafts = state.drafts.filter((item) => !item.skip && item.draft.trim());
    const approved = window.confirm(
      `即将预填 ${selectedDrafts.length} 个开放题，并${rating === 'none' ? '不填写评分' : `尝试为评分空白项选择“${rating === 'verySatisfied' ? '非常满意' : '满意'}”`}。\n\n只填写空白项；不会自动保存或提交。是否继续？`
    );
    if (!approved) return;

    state.busy = true;
    state.operationToken += 1;
    const token = state.operationToken;
    const fingerprint = makePageFingerprint();
    const snapshot = { pageFingerprint: fingerprint, createdAt: Date.now(), entries: [] };
    const result = {
      ratingCandidates: 0, ratingFilled: 0, ratingExisting: 0, ratingUnsafe: 0, ratingFailed: 0,
      textFilled: 0, textExisting: 0, textSkipped: state.drafts.filter((item) => item.skip).length
    };
    setBusy(true, '正在安全预填，请稍候…');

    try {
      if (rating !== 'none') {
        const candidates = findRatingCandidates();
        result.ratingCandidates = candidates.length;
        for (const select of candidates) {
          const outcome = await fillOneRating(select, rating, token);
          if (outcome.status === 'filled') {
            result.ratingFilled += 1;
            snapshot.entries.push({ type: 'rating', element: select, before: '', after: outcome.afterValue });
          } else if (outcome.status === 'existing') result.ratingExisting += 1;
          else if (outcome.status === 'unsafe') result.ratingUnsafe += 1;
          else result.ratingFailed += 1;
          if (outcome.reason) state.diagnostics.lastErrorType = outcome.reason;
        }
      }

      for (const draft of selectedDrafts) {
        const textarea = draft.element;
        if (token !== state.operationToken || makePageFingerprint() !== fingerprint) throw new Error('页面已变化，操作已停止');
        if (!textarea?.isConnected || textarea.disabled || textarea.readOnly || !belongsToSchoolForm(textarea)) {
          result.textExisting += 1;
          continue;
        }
        if (textarea.value.trim()) {
          result.textExisting += 1;
          continue;
        }
        await reveal(textarea);
        if (textarea.value.trim()) {
          result.textExisting += 1;
          continue;
        }
        const nextValue = draft.draft.trim();
        setNativeValue(textarea, nextValue);
        snapshot.entries.push({ type: 'textarea', element: textarea, before: '', after: nextValue });
        result.textFilled += 1;
      }

      state.snapshot = snapshot.entries.length ? snapshot : null;
      state.lastResult = result;
      refreshDiagnosticCounts();
      setStatus(`预填完成：评分 ${result.ratingFilled} 项，文本 ${result.textFilled} 项。请逐项检查后手动保存。`, 'success');
      window.alert(
        `辅助预填完成：\n\n疑似评分控件：${result.ratingCandidates}\n成功填写评分：${result.ratingFilled}\n已有评分跳过：${result.ratingExisting}\n安全原因跳过：${result.ratingUnsafe}\n评分失败：${result.ratingFailed}\n填写文本框：${result.textFilled}\n已有文本跳过：${result.textExisting}\n\n本工具没有保存或提交，请检查后手动操作。`
      );
    } catch (error) {
      markError('预填过程失败', error);
      state.snapshot = snapshot.entries.length ? snapshot : null;
      setStatus(`操作已停止：${error.message}`, 'error');
    } finally {
      state.busy = false;
      setBusy(false);
    }
  }

  async function undoLastApply() {
    if (state.busy) return;
    const snapshot = state.snapshot;
    if (!snapshot) {
      setStatus('当前没有可撤销的填写记录。', 'error');
      return;
    }
    if (makePageFingerprint() !== snapshot.pageFingerprint) {
      state.snapshot = null;
      setStatus('页面已经变化，旧撤销记录已失效。', 'error');
      return;
    }
    state.busy = true;
    setBusy(true, '正在撤销最近一次填写…');
    const stats = { text: 0, rating: 0, changed: 0, manual: 0 };
    try {
      for (const entry of [...snapshot.entries].reverse()) {
        if (entry.type === 'textarea') {
          if (!entry.element?.isConnected || entry.element.value !== entry.after) {
            stats.changed += 1;
            continue;
          }
          setNativeValue(entry.element, entry.before);
          stats.text += 1;
        } else {
          const result = await clearRatingEntry(entry);
          if (result === 'restored') stats.rating += 1;
          else if (result === 'changed') stats.changed += 1;
          else stats.manual += 1;
        }
      }
      state.snapshot = null;
      refreshDiagnosticCounts();
      setStatus(`撤销完成：文本 ${stats.text} 项，评分 ${stats.rating} 项；${stats.manual} 项评分需手动检查。`, stats.manual ? 'info' : 'success');
      window.alert(`撤销完成：\n\n已恢复文本框：${stats.text}\n已恢复评分：${stats.rating}\n因用户修改而跳过：${stats.changed}\n需要手动检查：${stats.manual}`);
    } finally {
      state.busy = false;
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------------------
  // diagnostics
  // ---------------------------------------------------------------------------

  function diagnosticPayload() {
    refreshDiagnosticCounts();
    const signals = getPageSignals();
    return {
      scriptName: SCRIPT.name,
      version: SCRIPT.version,
      hostname: location.hostname,
      pathname: location.pathname,
      evaluationPageRecognized: signals.recognized,
      pageKeywordHits: signals.keywordHits,
      selectTotal: state.diagnostics.selectTotal,
      selectVisible: state.diagnostics.selectVisible,
      suspectedRatingSelects: state.diagnostics.ratingCandidates,
      textareaTotal: state.diagnostics.textareaTotal,
      textareaVisible: state.diagnostics.textareaVisible,
      textareaFillable: state.diagnostics.textareaFillable,
      lastScanAt: state.diagnostics.lastScanAt,
      lastErrorType: state.diagnostics.lastErrorType
    };
  }

  function showDiagnostics() {
    const box = document.querySelector(`#${IDS.panel} [data-role="diagnostics"]`);
    if (!box) return;
    const data = diagnosticPayload();
    const hints = [];
    if (!data.suspectedRatingSelects || !data.textareaVisible) {
      hints.push('可能还没进入具体课程评价页面', '页面可能还没加载完成', '当前课程可能已评价完成', '页面结构可能变化');
    }
    box.hidden = false;
    box.innerHTML = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>${hints.length ? `<p>${escapeHtml(hints.join('；'))}。</p>` : ''}<button type="button" data-action="copy-diagnostics">复制诊断信息</button>`;
    box.querySelector('[data-action="copy-diagnostics"]').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setStatus('诊断信息已复制，不包含课程名、教师名或评价内容。', 'success');
      } catch (error) {
        markError('复制诊断信息失败', error);
        setStatus('复制失败，请手动选中诊断文本复制。', 'error');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // UI panel
  // ---------------------------------------------------------------------------

  function injectStyles() {
    if (document.getElementById(IDS.style)) return;
    const style = document.createElement('style');
    style.id = IDS.style;
    style.textContent = `
      #${IDS.button}, #${IDS.panel}, #${IDS.panel} * { box-sizing: border-box; }
      #${IDS.button} { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; border: 0; border-radius: 999px; padding: 11px 17px; color: #fff; background: #1769e0; box-shadow: 0 8px 28px rgba(23,105,224,.32); font: 600 14px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; cursor: pointer; }
      #${IDS.panel} { position: fixed; right: 20px; bottom: 74px; z-index: 2147483000; width: min(430px, calc(100vw - 28px)); max-height: calc(100vh - 94px); overflow: auto; padding: 16px; border: 1px solid #d9e2f0; border-radius: 15px; color: #172033; background: #fff; box-shadow: 0 16px 46px rgba(23,32,51,.25); font: 14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      #${IDS.panel}[hidden] { display: none !important; }
      #${IDS.panel} h2 { margin: 0 0 6px; font-size: 18px; }
      #${IDS.panel} .suat-note { margin: 4px 0; color: #526078; font-size: 12px; }
      #${IDS.panel} .suat-safe { margin: 12px 0; padding: 9px 11px; border-radius: 9px; background: #eef7f2; color: #245c43; font-size: 12px; }
      #${IDS.panel} .suat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      #${IDS.panel} label { display: block; margin: 8px 0 4px; font-size: 12px; font-weight: 650; color: #3c465a; }
      #${IDS.panel} select, #${IDS.panel} textarea { width: 100%; border: 1px solid #cbd5e3; border-radius: 8px; padding: 8px 9px; color: #172033; background: #fff; font: inherit; }
      #${IDS.panel} textarea { min-height: 82px; resize: vertical; }
      #${IDS.panel} .suat-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
      #${IDS.panel} button { min-height: 36px; border: 0; border-radius: 8px; padding: 8px 10px; color: #fff; background: #1769e0; font: 600 13px/1.25 inherit; cursor: pointer; }
      #${IDS.panel} button[data-action="apply"] { background: #127a4b; }
      #${IDS.panel} button[data-action="undo"], #${IDS.panel} button[data-action="diagnostics"] { color: #29405e; background: #eaf1fa; }
      #${IDS.panel} button[data-action="close"] { color: #5f2930; background: #f9e9eb; }
      #${IDS.panel} button:disabled { opacity: .55; cursor: wait; }
      #${IDS.panel} .suat-card { margin: 10px 0; padding: 11px; border: 1px solid #dce4ef; border-radius: 10px; background: #fbfcfe; }
      #${IDS.panel} .suat-question { margin: 0 0 6px; font-weight: 650; }
      #${IDS.panel} .suat-tag { display: inline-block; margin-bottom: 5px; padding: 2px 7px; border-radius: 999px; color: #17549b; background: #e8f2ff; font-size: 11px; }
      #${IDS.panel} .suat-check { display: flex; align-items: center; gap: 6px; font-weight: 500; }
      #${IDS.panel} .suat-check input { margin: 0; }
      #${IDS.panel} .suat-existing { color: #96630a; font-size: 12px; }
      #${IDS.panel} [data-role="status"] { padding: 8px 10px; border-radius: 8px; background: #f1f4f8; font-size: 12px; }
      #${IDS.panel} [data-role="status"][data-type="success"] { color: #12613f; background: #e9f7ef; }
      #${IDS.panel} [data-role="status"][data-type="error"] { color: #962f2f; background: #fff0f0; }
      #${IDS.panel} [data-role="diagnostics"] { margin-top: 10px; padding: 10px; border-radius: 9px; background: #f6f8fb; }
      #${IDS.panel} [data-role="diagnostics"][hidden] { display: none; }
      #${IDS.panel} pre { max-height: 240px; overflow: auto; margin: 0 0 8px; white-space: pre-wrap; font: 11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace; }
    `;
    document.head.appendChild(style);
  }

  function setStatus(message, type = 'info') {
    const status = document.querySelector(`#${IDS.panel} [data-role="status"]`);
    if (!status) return;
    status.textContent = message;
    status.dataset.type = type;
  }

  function setBusy(busy, message = '') {
    const panel = document.getElementById(IDS.panel);
    panel?.querySelectorAll('button, select').forEach((control) => { control.disabled = busy; });
    if (message) setStatus(message);
  }

  function renderDraftCards() {
    const container = document.querySelector(`#${IDS.panel} [data-role="drafts"]`);
    if (!container) return;
    container.innerHTML = state.drafts.length ? state.drafts.map((item) => `
      <article class="suat-card">
        <p class="suat-question">${escapeHtml(item.question)}</p>
        <span class="suat-tag">${TYPE_LABELS[item.type]}</span>
        ${item.existing ? '<p class="suat-existing">此题已有内容或不可编辑，已自动跳过。</p>' : ''}
        <textarea data-draft-editor="${escapeHtml(item.id)}" ${item.existing ? 'disabled' : ''}>${escapeHtml(item.draft)}</textarea>
        <label class="suat-check"><input type="checkbox" data-draft-skip="${escapeHtml(item.id)}" ${item.skip ? 'checked' : ''} ${item.existing ? 'disabled' : ''}> 本题不填写</label>
      </article>
    `).join('') : '<p class="suat-note">点击“扫描并生成草稿”后，可在这里逐题预览和修改。</p>';
    for (const item of state.drafts) {
      container.querySelector(`[data-draft-editor="${item.id}"]`)?.addEventListener('input', (event) => { item.draft = event.target.value; });
      container.querySelector(`[data-draft-skip="${item.id}"]`)?.addEventListener('change', (event) => { item.skip = event.target.checked; });
    }
  }

  function mountUI() {
    injectStyles();
    if (!document.getElementById(IDS.button)) {
      const button = document.createElement('button');
      button.id = IDS.button;
      button.type = 'button';
      button.textContent = '教评辅助';
      button.addEventListener('click', () => {
        state.open = !state.open;
        const panel = document.getElementById(IDS.panel);
        if (panel) panel.hidden = !state.open;
      });
      document.body.appendChild(button);
    }
    if (document.getElementById(IDS.panel)) return;
    const panel = document.createElement('section');
    panel.id = IDS.panel;
    panel.hidden = !state.open;
    panel.setAttribute('aria-label', '离线教评辅助面板');
    panel.innerHTML = `
      <h2>教评辅助 · Lite</h2>
      <p class="suat-note">Lite 版完全离线，不联网。</p>
      <p class="suat-note">本工具不会自动保存或提交，请检查后手动保存。</p>
      <div class="suat-grid">
        <div><label>评分选择</label><select data-field="rating"><option value="verySatisfied">非常满意</option><option value="satisfied">满意</option><option value="none">不填写评分</option></select></div>
        <div><label>文本风格</label><select data-field="style"><option value="natural">自然正式</option><option value="concise">简洁</option><option value="constructive">具体建设性</option></select></div>
      </div>
      <div class="suat-safe">默认只填写空白项；已有评分和文本不会覆盖。如需修改，请先在学校页面手动清空。</div>
      <div class="suat-actions">
        <button type="button" data-action="scan">扫描并生成草稿</button>
        <button type="button" data-action="apply">采用并预填</button>
        <button type="button" data-action="undo">撤销本次填写</button>
        <button type="button" data-action="diagnostics">查看诊断信息</button>
        <button type="button" data-action="close">关闭</button>
      </div>
      <div data-role="status" data-type="info" aria-live="polite">请先扫描页面，再逐题检查草稿。</div>
      <div data-role="drafts"></div>
      <div data-role="diagnostics" hidden></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('[data-action="scan"]').addEventListener('click', scanAndGenerate);
    panel.querySelector('[data-action="apply"]').addEventListener('click', applyDrafts);
    panel.querySelector('[data-action="undo"]').addEventListener('click', undoLastApply);
    panel.querySelector('[data-action="diagnostics"]').addEventListener('click', showDiagnostics);
    panel.querySelector('[data-action="close"]').addEventListener('click', () => {
      state.open = false;
      panel.hidden = true;
    });
    panel.querySelector('[data-field="style"]').addEventListener('change', () => {
      if (state.drafts.length) scanAndGenerate();
    });
    renderDraftCards();
  }

  function unmountUI() {
    document.getElementById(IDS.button)?.remove();
    document.getElementById(IDS.panel)?.remove();
    state.open = false;
  }

  // ---------------------------------------------------------------------------
  // SPA lifecycle
  // ---------------------------------------------------------------------------

  function resetPageState(fingerprint = '') {
    state.operationToken += 1;
    state.drafts = [];
    state.snapshot = null;
    state.pageFingerprint = fingerprint;
    state.lastResult = null;
    state.diagnostics.lastScanAt = '尚未扫描';
    state.diagnostics.lastErrorType = '无';
  }

  function syncWithPage() {
    const signals = getPageSignals();
    state.diagnostics.recognized = signals.recognized;
    state.diagnostics.keywordHits = signals.keywordHits;
    if (!signals.recognized) {
      if (state.pageFingerprint) resetPageState('');
      unmountUI();
      return;
    }
    const fingerprint = makePageFingerprint();
    if (fingerprint !== state.pageFingerprint) {
      resetPageState(fingerprint);
      document.getElementById(IDS.panel)?.remove();
      document.getElementById(IDS.button)?.remove();
    }
    refreshDiagnosticCounts();
    mountUI();
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

  // ---------------------------------------------------------------------------
  // bootstrap
  // ---------------------------------------------------------------------------

  function bootstrap() {
    patchHistory();
    if (!state.observer) {
      state.observer = new MutationObserver((mutations) => {
        const relevant = mutations.some((mutation) => {
          const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
          return !target?.closest?.(`#${IDS.panel}`) && !target?.closest?.(`#${IDS.button}`);
        });
        if (relevant) scheduleSync();
      });
      state.observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    }
    syncWithPage();
  }

  bootstrap();
})();
