/* =========================================================================
   Движок кейс-заданий для ЭОР
   Разметка:
     <div id="cases" data-src="data/ch01-cases.json" data-chapter="ch01"></div>
   Формат JSON:
     { "title": "...", "cases": [ { id, type, title, situation, task, ... } ] }
   ========================================================================= */
(function () {
  'use strict';

  /* =======================================================================
     1. УТИЛИТЫ
     ======================================================================= */

  function norm(s) {
    return (s == null ? '' : String(s))
      .trim().toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/ё/g, 'е');
  }

  function el(tag, attrs, html) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(k => {
        const v = attrs[k];
        if (v == null) return;
        if (k === 'className') node.className = v;
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else node.setAttribute(k, v);
      });
    }
    if (html != null) node.innerHTML = html;
    return node;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* =======================================================================
     2. ХРАНИЛИЩЕ ОТВЕТОВ И САМООЦЕНКИ
     ======================================================================= */

  const KEY_CASE = (chapter, id) => `case:${chapter}:${id}`;
  const KEY_SELF = (chapter, id) => `case:${chapter}:${id}:self`;

  function saveAnswer(chapter, id, value) {
    try {
      localStorage.setItem(KEY_CASE(chapter, id), JSON.stringify({
        value,
        savedAt: new Date().toISOString(),
      }));
    } catch (e) { /* quota / приватный режим */ }
  }

  function loadAnswer(chapter, id) {
    try {
      const raw = localStorage.getItem(KEY_CASE(chapter, id));
      return raw ? JSON.parse(raw).value : null;
    } catch (e) { return null; }
  }

  function saveSelf(chapter, id, value) {
    try { localStorage.setItem(KEY_SELF(chapter, id), value); }
    catch (e) {}
  }

  function loadSelf(chapter, id) {
    try { return localStorage.getItem(KEY_SELF(chapter, id)); }
    catch (e) { return null; }
  }

  /* =======================================================================
     3. РЕНДЕР КЕЙСА
     ======================================================================= */

  function renderCase(c, chapter, index, total) {
    const card = el('article', {
      className: 'case-card',
      dataset: { id: c.id, type: c.type },
    });

    // ---------- Шапка ----------
    const header = el('div', { className: 'case-header' });
    const comp = (c.competencies && c.competencies.length)
      ? `<div class="case-comp">Компетенции: ${c.competencies.map(escapeHtml).join(', ')}</div>`
      : '';
    header.innerHTML =
      `<h3><span class="case-num">${index + 1}/${total}.</span> ` +
      `${escapeHtml(c.title || 'Кейс')}</h3>${comp}`;
    card.appendChild(header);

    // ---------- Ситуация и задание ----------
    card.appendChild(el('div', { className: 'case-situation' },
      `<strong>Ситуация.</strong> ${escapeHtml(c.situation || '')}`));
    card.appendChild(el('div', { className: 'case-task' },
      `<strong>Задание.</strong> ${escapeHtml(c.task || '')}`));

    // ---------- Тело кейса ----------
    const body = el('div', { className: 'case-body' });
    card.appendChild(body);

    if (c.type === 'open') {
      const ta = el('textarea', {
        placeholder: 'Введите ваш ответ…',
        rows: '4',
        name: 'answer_' + c.id,
      });
      const saved = loadAnswer(chapter, c.id);
      if (saved != null) ta.value = saved;
      ta.addEventListener('input', () => saveAnswer(chapter, c.id, ta.value));
      body.appendChild(ta);
    }

    if (c.type === 'choice') {
      (c.options || []).forEach((opt, j) => {
        const label = el('label', { className: 'case-option' });
        const inp = el('input', {
          type: 'radio',
          name: 'case_' + c.id,
          value: String(j),
        });
        // Восстановление выбора
        const saved = loadAnswer(chapter, c.id);
        if (saved != null && Number(saved) === j) inp.checked = true;
        inp.addEventListener('change', () => {
          if (inp.checked) saveAnswer(chapter, c.id, String(j));
        });
        label.appendChild(inp);
        label.appendChild(document.createTextNode(' ' + opt));
        body.appendChild(label);
      });
    }

    if (c.type === 'number') {
      const wrap = el('div', { className: 'case-number-wrap' });
      const inp = el('input', {
        type: 'number',
        step: 'any',
        name: 'case_' + c.id,
        placeholder: 'Введите число…',
      });
      const saved = loadAnswer(chapter, c.id);
      if (saved != null && saved !== '') inp.value = saved;
      inp.addEventListener('input', () => saveAnswer(chapter, c.id, inp.value));
      wrap.appendChild(inp);
      if (c.unit) wrap.appendChild(el('span', { className: 'case-unit' }, ' ' + c.unit));
      body.appendChild(wrap);
    }

    if (c.type === 'multi') {
      (c.subtasks || []).forEach((st, j) => {
        const sub = el('div', { className: 'case-subtask', dataset: { id: st.id } });
        sub.appendChild(el('div', { className: 'subtask-text' },
          `<strong>${j + 1}.</strong> ${escapeHtml(st.text || '')}`));

        const ta = el('textarea', {
          placeholder: 'Ваш ответ…',
          rows: '3',
          name: 'sub_' + st.id,
        });
        const saved = loadAnswer(chapter, st.id);
        if (saved != null) ta.value = saved;
        ta.addEventListener('input', () => saveAnswer(chapter, st.id, ta.value));
        sub.appendChild(ta);

        if (st.hint) {
          const hintBtn = el('button',
            { type: 'button', className: 'btn-link' }, 'Подсказка');
          const hintBox = el('div', { className: 'case-hint', hidden: 'hidden' });
          hintBox.innerHTML = `<em>${escapeHtml(st.hint)}</em>`;
          hintBtn.addEventListener('click', () => {
            hintBox.hidden = !hintBox.hidden;
            hintBtn.textContent = hintBox.hidden ? 'Подсказка' : 'Скрыть подсказку';
          });
          sub.appendChild(hintBtn);
          sub.appendChild(hintBox);
        }

        body.appendChild(sub);
      });
    }

    // ---------- Кнопки действий ----------
    const actions = el('div', { className: 'case-actions' });

    // Подсказка (общая)
    let hintBlock = null;
    if (c.hint) {
      const hintBtn = el('button',
        { type: 'button', className: 'btn-ghost' }, 'Подсказка');
      hintBlock = el('div', { className: 'case-hint-block', hidden: 'hidden' });
      hintBlock.innerHTML =
        `<strong>Подсказка.</strong> ${escapeHtml(c.hint)}`;
      hintBtn.addEventListener('click', () => {
        hintBlock.hidden = !hintBlock.hidden;
        hintBtn.textContent = hintBlock.hidden ? 'Подсказка' : 'Скрыть подсказку';
      });
      actions.appendChild(hintBtn);
    }

    // Проверка (choice / number)
    if (c.type === 'choice' || c.type === 'number') {
      const checkBtn = el('button',
        { type: 'button', className: 'btn-primary' }, 'Проверить');
      checkBtn.addEventListener('click', () => checkCase(c, card));
      actions.appendChild(checkBtn);
    }

    // Показать решение
    const solutionText = c.solution || c.answer ||
      (c.type === 'choice' ? c.explanation : '') || '';
    const solBtn = el('button',
      { type: 'button', className: 'btn-ghost' }, 'Показать решение');
    const solBox = el('div', { className: 'case-solution', hidden: 'hidden' });
    solBox.innerHTML =
      `<strong>Эталонное решение.</strong> ${escapeHtml(solutionText || '—')}`;
    solBtn.addEventListener('click', () => {
      solBox.hidden = !solBox.hidden;
      solBtn.textContent = solBox.hidden ? 'Показать решение' : 'Скрыть решение';
    });
    actions.appendChild(solBtn);

    // Печать
    const printBtn = el('button',
      { type: 'button', className: 'btn-ghost' }, 'Печать');
    printBtn.addEventListener('click', () => printCase(c, chapter));
    actions.appendChild(printBtn);

    card.appendChild(actions);

    // ---------- Блок подсказки (скрытый) ----------
    if (hintBlock) card.appendChild(hintBlock);

    // ---------- Блок решения (скрытый) ----------
    card.appendChild(solBox);

    // ---------- Самооценка ----------
    card.appendChild(renderSelfAssess(c, chapter));

    return card;
  }

  /* =======================================================================
     4. САМООЦЕНКА
     ======================================================================= */

  function renderSelfAssess(c, chapter) {
    const wrap = el('div', { className: 'case-self-assess' });
    wrap.appendChild(el('span', null, 'Самооценка:'));

    const btnOk = el('button',
      { type: 'button', className: 'btn-ghost' }, '✅ Понятно');
    const btnNo = el('button',
      { type: 'button', className: 'btn-ghost' }, '🤔 Нужно разобраться');
    const note = el('div', { className: 'case-self-note', hidden: 'hidden' });

    const current = loadSelf(chapter, c.id);
    if (current === 'ok') {
      btnOk.classList.add('btn-primary');
      btnOk.classList.remove('btn-ghost');
      note.hidden = false;
      note.textContent = 'Отмечено: понятно';
    } else if (current === 'rework') {
      btnNo.classList.add('btn-primary');
      btnNo.classList.remove('btn-ghost');
      note.hidden = false;
      note.textContent = 'Отмечено: нужно разобраться';
    }

    btnOk.addEventListener('click', () => {
      saveSelf(chapter, c.id, 'ok');
      note.hidden = false;
      note.textContent = 'Отмечено: понятно';
      btnOk.classList.add('btn-primary');
      btnOk.classList.remove('btn-ghost');
      btnNo.classList.add('btn-ghost');
      btnNo.classList.remove('btn-primary');
    });

    btnNo.addEventListener('click', () => {
      saveSelf(chapter, c.id, 'rework');
      note.hidden = false;
      note.textContent = 'Отмечено: нужно разобраться';
      btnNo.classList.add('btn-primary');
      btnNo.classList.remove('btn-ghost');
      btnOk.classList.add('btn-ghost');
      btnOk.classList.remove('btn-primary');
    });

    wrap.appendChild(btnOk);
    wrap.appendChild(btnNo);
    wrap.appendChild(note);
    return wrap;
  }

  /* =======================================================================
     5. ПРОВЕРКА choice / number
     ======================================================================= */

  function checkCase(c, card) {
    // Удаляем прошлый фидбек
    card.querySelectorAll('.case-feedback').forEach(n => n.remove());

    const feedback = el('div', { className: 'case-feedback' });

    if (c.type === 'choice') {
      const sel = card.querySelector(`input[name="case_${c.id}"]:checked`);
      if (!sel) {
        feedback.className = 'case-feedback warn';
        feedback.textContent = 'Выберите вариант ответа.';
        card.appendChild(feedback);
        return;
      }
      const ok = Number(sel.value) === c.correct;
      feedback.className = 'case-feedback ' + (ok ? 'ok' : 'fail');
      feedback.innerHTML = ok
        ? '✅ Верно. ' + escapeHtml(c.explanation || '')
        : '❌ Неверно. Правильный вариант: <b>' +
          escapeHtml((c.options || [])[c.correct] || '') + '</b>. ' +
          escapeHtml(c.explanation || '');
      card.appendChild(feedback);
      return;
    }

    if (c.type === 'number') {
      const inp = card.querySelector(`input[name="case_${c.id}"]`);
      const val = parseFloat(inp.value);
      const tol = Number.isFinite(c.tolerance) ? c.tolerance : 0;
      if (!Number.isFinite(val)) {
        feedback.className = 'case-feedback warn';
        feedback.textContent = 'Введите числовой ответ.';
        card.appendChild(feedback);
        return;
      }
      const ok = Math.abs(val - c.answer) <= tol;
      const unit = c.unit ? ' ' + c.unit : '';
      feedback.className = 'case-feedback ' + (ok ? 'ok' : 'fail');
      feedback.innerHTML = ok
        ? `✅ Верно (${escapeHtml(c.answer)}${escapeHtml(unit)}).`
        : `❌ Неверно. Правильный ответ: <b>${escapeHtml(c.answer)}${escapeHtml(unit)}</b>.`;
      card.appendChild(feedback);
      return;
    }
  }

  /* =======================================================================
     6. ПЕЧАТЬ КЕЙСА
     ======================================================================= */

  function printCase(c, chapter) {
    const win = window.open('', '_blank');
    if (!win) return;

    // Собираем ответы пользователя
    let answerText = '';
    if (c.type === 'open') {
      answerText = loadAnswer(chapter, c.id) || '—';
    } else if (c.type === 'choice') {
      const raw = loadAnswer(chapter, c.id);
      answerText = (raw != null && (c.options || [])[Number(raw)] != null)
        ? c.options[Number(raw)]
        : '—';
    } else if (c.type === 'number') {
      const v = loadAnswer(chapter, c.id);
      answerText = (v != null && v !== '')
        ? v + (c.unit ? ' ' + c.unit : '')
        : '—';
    } else if (c.type === 'multi') {
      answerText = (c.subtasks || []).map((st, i) => {
        const v = loadAnswer(chapter, st.id) || '—';
        return `${i + 1}. ${st.text}\n   Ответ: ${v}`;
      }).join('\n\n');
    }

    const solution = c.solution || c.answer || c.explanation || '—';

    win.document.write(`<!DOCTYPE html><html lang="ru"><head>
      <meta charset="utf-8">
      <title>Кейс — ${escapeHtml(c.title || '')}</title>
      <style>
        body{font-family:sans-serif;padding:24px;color:#222;line-height:1.55}
        h1{font-size:18px;margin:0 0 8px}
        .meta{font-size:12px;color:#666;margin-bottom:18px}
        .block{margin-bottom:14px;padding:10px 12px;border:1px solid #ddd;border-radius:8px}
        .block h2{font-size:14px;margin:0 0 6px}
        pre{white-space:pre-wrap;font-family:inherit;margin:0}
        @media print{body{padding:0}}
      </style></head><body>
      <h1>${escapeHtml(c.title || 'Кейс')}</h1>
      <div class="meta">Глава: ${escapeHtml(chapter || '')} • Кейс ID: ${escapeHtml(c.id)} • ${new Date().toLocaleString('ru-RU')}</div>
      <div class="block"><h2>Ситуация</h2><pre>${escapeHtml(c.situation || '')}</pre></div>
      <div class="block"><h2>Задание</h2><pre>${escapeHtml(c.task || '')}</pre></div>
      <div class="block"><h2>Мой ответ</h2><pre>${escapeHtml(answerText)}</pre></div>
      <div class="block"><h2>Эталонное решение</h2><pre>${escapeHtml(solution)}</pre></div>
      <script>window.onload=()=>setTimeout(()=>window.print(),150);<\/script>
      </body></html>`);
    win.document.close();
  }

  /* =======================================================================
     7. ИНИЦИАЛИЗАЦИЯ
     ======================================================================= */

  async function initCases() {
    const box = document.getElementById('cases');
    if (!box) return;

    const src = box.dataset.src;
    const chapter = box.dataset.chapter || 'ch00';

    let data;
    try {
      const res = await fetch(src, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      data = await res.json();
    } catch (e) {
      box.innerHTML =
        '<p class="q-error">Не удалось загрузить кейсы. Проверьте путь к JSON ' +
        'и запустите локальный сервер.</p>';
      console.error('[cases]', e);
      return;
    }

    const cases = Array.isArray(data) ? data : (data.cases || []);
    if (!cases.length) {
      box.innerHTML = '<p class="q-error">Кейсы отсутствуют.</p>';
      return;
    }

    box.innerHTML = '';
    if (data.title) {
      box.appendChild(el('h3', { className: 'cases-title' },
        escapeHtml(data.title)));
    }

    cases.forEach((c, i) =>
      box.appendChild(renderCase(c, chapter, i, cases.length)));
  }

  /* =======================================================================
     8. ЗАПУСК
     ======================================================================= */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCases);
  } else {
    initCases();
  }

  // Экспорт для динамической переинициализации
  window.initCases = initCases;

})();