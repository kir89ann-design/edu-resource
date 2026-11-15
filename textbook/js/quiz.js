/* =========================================================================
   Движок тестов для ЭОР
   Разметка:
     <div id="quiz" data-src="data/ch01-questions.json" data-chapter="ch01"></div>
   Формат JSON:
     { "title": "...", "passScore": 70, "shuffle": false, "timeLimitSec": 0,
       "questions": [ { "id", "type", "weight", "text", ... } ] }
   ========================================================================= */
(function () {
  'use strict';

  /* =======================================================================
     1. УТИЛИТЫ
     ======================================================================= */

  function norm(s) {
    return (s == null ? '' : String(s))
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/ё/g, 'е');
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
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
     2. ПРОГРЕСС (совместимо с textbook.js)
     ======================================================================= */

  function saveProgress(chapter, percent, passed) {
    if (!chapter) return;
    // Основной путь — через API textbook.js
    if (passed && typeof window.setChapterDone === 'function') {
      window.setChapterDone(chapter, true);
      return;
    }
    // Резервная запись — если textbook.js не подключён
    try {
      const key = 'chapter:' + chapter;
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      data.progress = Math.max(data.progress || 0, percent);
      data.lastQuizPercent = percent;
      data.lastQuizAt = new Date().toISOString();
      if (passed) { data.done = true; data.progress = 100; }
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  /* =======================================================================
     3. РЕНДЕР ВОПРОСА
     ======================================================================= */

  function renderQuestion(q, index, total) {
    const fs = el('fieldset', {
      className: 'question',
      dataset: { id: q.id, type: q.type },
    });

    const weight = (q.weight && q.weight !== 1)
      ? ` <span class="q-weight">(${q.weight} б.)</span>`
      : '';

    const legend = el('legend');
    legend.innerHTML =
      `<span class="q-num">${index + 1}/${total}.</span> ` +
      `<span class="q-text">${escapeHtml(q.text)}</span>${weight}`;
    fs.appendChild(legend);

    if (q.type === 'single' || q.type === 'multiple') {
      const groupName = 'q_' + q.id + '_' + Math.random().toString(36).slice(2, 8);
      (q.options || []).forEach((opt, j) => {
        const label = el('label', { className: 'q-option' });
        const input = el('input', {
          type: q.type === 'single' ? 'radio' : 'checkbox',
          name: groupName,
          value: String(j),
        });
        label.appendChild(input);
        label.appendChild(document.createTextNode(' ' + opt));
        fs.appendChild(label);
      });
    } else if (q.type === 'text') {
      const input = el('input', {
        type: 'text',
        name: 'q_' + q.id,
        placeholder: 'Введите ответ…',
        autocomplete: 'off',
      });
      fs.appendChild(input);
    } else if (q.type === 'number') {
      const input = el('input', {
        type: 'number',
        name: 'q_' + q.id,
        placeholder: 'Введите число…',
        step: 'any',
      });
      fs.appendChild(input);
    } else {
      fs.appendChild(el('p', { className: 'q-error' },
        'Неизвестный тип вопроса: ' + escapeHtml(q.type)));
    }

    return fs;
  }

  /* =======================================================================
     4. ПРОВЕРКА ВОПРОСА
     ======================================================================= */

  function checkQuestion(q, fieldset) {
    if (q.type === 'single') {
      const sel = fieldset.querySelector('input[type=radio]:checked');
      const ok = !!sel && Number(sel.value) === q.correct;
      return { ok, correctText: (q.options || [])[q.correct] ?? '' };
    }
    if (q.type === 'multiple') {
      const checked = [...fieldset.querySelectorAll('input[type=checkbox]:checked')]
        .map(i => Number(i.value)).sort((a, b) => a - b);
      const correct = [...(q.correct || [])].sort((a, b) => a - b);
      const ok = checked.length === correct.length &&
                 checked.every((v, k) => v === correct[k]);
      return {
        ok,
        correctText: (q.correct || []).map(i => q.options[i]).join('; '),
      };
    }
    if (q.type === 'text') {
      const inp = fieldset.querySelector('input[type=text]');
      const ok = norm(inp.value) === norm(q.answer);
      return { ok, correctText: q.answer };
    }
    if (q.type === 'number') {
      const inp = fieldset.querySelector('input[type=number]');
      const val = parseFloat(inp.value);
      const tol = Number.isFinite(q.tolerance) ? q.tolerance : 0;
      const ok = Number.isFinite(val) && Math.abs(val - q.answer) <= tol;
      return {
        ok,
        correctText: String(q.answer) + (tol ? ` ± ${tol}` : ''),
      };
    }
    return { ok: false, correctText: '' };
  }

  /* =======================================================================
     5. ИТОГ
     ======================================================================= */

  function computeScore(questions, results) {
    const totalWeight = questions.reduce((s, q) => s + (q.weight || 1), 0);
    const scoreWeight = questions.reduce(
      (s, q, i) => s + (results[i].ok ? (q.weight || 1) : 0), 0);
    const percent = totalWeight ? Math.round(scoreWeight / totalWeight * 100) : 0;
    return { totalWeight, scoreWeight, percent };
  }

  function renderResult(container, questions, results, passScore) {
    const { totalWeight, scoreWeight, percent } = computeScore(questions, results);
    const passed = percent >= passScore;

    let box = container.querySelector('.quiz-result');
    if (box) box.remove();

    box = el('div', {
      className: 'quiz-result ' + (passed ? 'ok' : 'fail'),
      role: 'status',
    });
    box.innerHTML =
      `<div class="res-line"><strong>Результат:</strong> ` +
      `${scoreWeight} из ${totalWeight} баллов — ${percent}% ` +
      `(порог ${passScore}%)</div>` +
      `<div class="res-line">` +
      (passed ? '✅ Тест пройден' : '❌ Тест не пройден — попробуйте ещё раз') +
      `</div>`;
    container.appendChild(box);
    return { passed, percent };
  }

  /* =======================================================================
     6. ТАЙМЕР
     ======================================================================= */

  function formatTime(sec) {
    const s = Math.max(0, sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `⏱ ${m}:${String(r).padStart(2, '0')}`;
  }

  function startTimer(seconds, onTimeUp) {
    const node = el('div', { className: 'quiz-timer', role: 'timer' });
    node.textContent = formatTime(seconds);
    let left = seconds;
    const id = setInterval(() => {
      left--;
      node.textContent = formatTime(left);
      if (left <= 30) node.classList.add('warn');
      if (left <= 0) {
        clearInterval(id);
        onTimeUp();
      }
    }, 1000);
    return { node, stop: () => clearInterval(id) };
  }

  /* =======================================================================
     7. ПЕЧАТЬ РЕЗУЛЬТАТА
     ======================================================================= */

  function printResult(questions, results, passScore, title) {
    const { totalWeight, scoreWeight, percent } = computeScore(questions, results);
    const win = window.open('', '_blank');
    if (!win) return;

    const rows = questions.map((q, i) => {
      const r = results[i];
      return `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(q.text)}</td>
        <td>${r.ok ? '✅' : '❌'}</td>
        <td>${escapeHtml(r.correctText || '')}</td>
      </tr>`;
    }).join('');

    win.document.write(`<!DOCTYPE html><html lang="ru"><head>
      <meta charset="utf-8">
      <title>Результат теста</title>
      <style>
        body{font-family:sans-serif;padding:24px;color:#222;line-height:1.5}
        h1{font-size:20px;margin:0 0 12px}
        .summary{margin:0 0 20px;padding:12px;background:#f4f6fa;border-radius:8px}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #ccc;padding:8px;text-align:left;vertical-align:top}
        th{background:#eef2f8}
        @media print{body{padding:0}}
      </style></head><body>
      <h1>${escapeHtml(title || 'Результат теста')}</h1>
      <div class="summary">
        Баллов: <b>${scoreWeight}</b> из ${totalWeight} — <b>${percent}%</b>
        (порог ${passScore}%) — ${percent >= passScore ? 'зачёт' : 'незачёт'}<br>
        Дата: ${new Date().toLocaleString('ru-RU')}
      </div>
      <table>
        <thead><tr><th>№</th><th>Вопрос</th><th>Ответ</th>
        <th>Правильный ответ</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <script>window.onload=()=>setTimeout(()=>window.print(),150);<\/script>
      </body></html>`);
    win.document.close();
  }

  /* =======================================================================
     8. ИНИЦИАЛИЗАЦИЯ ОДНОГО ТЕСТА
     ======================================================================= */

  async function initQuiz() {
    const container = document.getElementById('quiz');
    if (!container) return;

    const src = container.dataset.src;
    const chapter = container.dataset.chapter || '';

    let data;
    try {
      const res = await fetch(src, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      data = await res.json();
    } catch (e) {
      container.innerHTML =
        '<p class="q-error">Не удалось загрузить тест. Проверьте путь к JSON ' +
        'и запустите локальный сервер.</p>';
      console.error('[quiz]', e);
      return;
    }

    const config = Array.isArray(data) ? { questions: data } : data;
    let questions = config.questions || [];
    const passScore = Number.isFinite(config.passScore) ? config.passScore : 70;
    const timeLimit = Number(config.timeLimitSec) || 0;

    if (!questions.length) {
      container.innerHTML = '<p class="q-error">В тесте нет вопросов.</p>';
      return;
    }

    // Перемешивание с пересчётом правильных индексов
    if (config.shuffle) {
      questions = shuffle(questions).map(q => {
        if ((q.type === 'single' || q.type === 'multiple') &&
            Array.isArray(q.options)) {
          const pairs = q.options.map((opt, i) => ({ opt, i }));
          const mixed = shuffle(pairs);
          const newOptions = mixed.map(p => p.opt);
          const newCorrect = q.type === 'single'
            ? mixed.findIndex(p => p.i === q.correct)
            : q.correct.map(ci => mixed.findIndex(p => p.i === ci));
          return Object.assign({}, q, { options: newOptions, correct: newCorrect });
        }
        return q;
      });
    }

    // ---------- Шапка ----------
    container.innerHTML = '';
    const header = el('div', { className: 'quiz-header' });
    if (config.title) header.appendChild(el('h3', null, escapeHtml(config.title)));
    container.appendChild(header);

    let timerAPI = null;
    let finished = false;

    // ---------- Вопросы ----------
    const form = el('form', { className: 'quiz-form', novalidate: 'novalidate' });
    questions.forEach((q, i) => form.appendChild(renderQuestion(q, i, questions.length)));
    container.appendChild(form);

    // ---------- Таймер ----------
    if (timeLimit > 0) {
      timerAPI = startTimer(timeLimit, () => { if (!finished) submit(true); });
      header.appendChild(timerAPI.node);
    }

    // ---------- Кнопки ----------
    const actions = el('div', { className: 'quiz-actions' });
    const btnCheck = el('button', { type: 'button', className: 'btn-primary' }, 'Проверить');
    const btnReset = el('button', { type: 'button', className: 'btn-ghost' }, 'Пройти заново');
    const btnPrint = el('button', { type: 'button', className: 'btn-ghost' }, 'Печать результата');
    actions.appendChild(btnCheck);
    actions.appendChild(btnReset);
    actions.appendChild(btnPrint);
    container.appendChild(actions);

    // ---------- Проверка ----------
    let lastResults = null;

    function submit(auto) {
      if (finished && !auto) return;
      finished = true;
      if (timerAPI) timerAPI.stop();

      const results = questions.map(q => {
        const fs = form.querySelector('.question[data-id="' + q.id + '"]');
        if (!fs) return { ok: false, correctText: '' };
        const r = checkQuestion(q, fs);
        fs.classList.remove('correct', 'incorrect');
        fs.classList.add(r.ok ? 'correct' : 'incorrect');

        const oldHint = fs.querySelector('.hint-ans');
        if (oldHint) oldHint.remove();

        const hint = el('div', { className: 'hint-ans' });
        hint.innerHTML = r.ok
          ? '✅ Верно'
          : '❌ Правильный ответ: <b>' + escapeHtml(r.correctText) + '</b>';
        fs.appendChild(hint);
        return r;
      });

      lastResults = results;
      const { passed, percent } = renderResult(container, questions, results, passScore);
      saveProgress(chapter, percent, passed);
      btnCheck.disabled = true;
    }

    btnCheck.addEventListener('click', () => submit(false));

    // ---------- Сброс ----------
    btnReset.addEventListener('click', () => {
      finished = false;
      form.querySelectorAll('.question').forEach(fs => {
        fs.classList.remove('correct', 'incorrect');
        fs.querySelectorAll('input').forEach(i => {
          if (i.type === 'radio' || i.type === 'checkbox') i.checked = false;
          else i.value = '';
        });
        const h = fs.querySelector('.hint-ans');
        if (h) h.remove();
      });
      const r = container.querySelector('.quiz-result');
      if (r) r.remove();
      btnCheck.disabled = false;

      if (timeLimit > 0) {
        if (timerAPI) {
          timerAPI.stop();
          timerAPI.node.remove();
        }
        timerAPI = startTimer(timeLimit, () => { if (!finished) submit(true); });
        header.appendChild(timerAPI.node);
      }

      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // ---------- Печать ----------
    btnPrint.addEventListener('click', () => {
      if (!lastResults) {
        // если ещё не проверяли — подскажем
        const note = container.querySelector('.quiz-print-note');
        if (!note) {
          const n = el('div', { className: 'quiz-print-note q-error' },
            'Сначала нажмите «Проверить», затем «Печать результата».');
          actions.after(n);
          setTimeout(() => n.remove(), 4000);
        }
        return;
      }
      printResult(questions, lastResults, passScore, config.title);
    });
  }

  /* =======================================================================
     9. ЗАПУСК
     ======================================================================= */

  function init() {
    initQuiz();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Для динамической переинициализации
  window.initQuiz = initQuiz;

})();