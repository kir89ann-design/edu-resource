/* =========================================================================
   Всплывающие определения терминов
   Разметка: <span class="term" data-term="energy-saving">Энергосбережение</span>
   Источник: data/terms.json → { "energy-saving": { "title": "...", "text": "..." } }
   ========================================================================= */
(function () {
  'use strict';

  /* =======================================================================
     1. СОСТОЯНИЕ
     ======================================================================= */

  let TERMS = {};        // кэш словаря
  let loaded = false;    // флаг загрузки
  let loadPromise = null;// промис загрузки (чтобы не дёргать fetch дважды)
  let popup = null;      // текущий DOM-элемент окна
  let activeTerm = null; // текущий термин

  const TERMS_SRC = 'data/terms.json';

  /* =======================================================================
     2. ЗАГРУЗКА СЛОВАРЯ
     ======================================================================= */

  async function loadTerms() {
    if (loaded) return TERMS;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        const res = await fetch(TERMS_SRC, { cache: 'no-cache' });
        if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
        TERMS = await res.json();
        loaded = true;
        return TERMS;
      } catch (e) {
        console.warn('[terms] Не удалось загрузить словарь:', e);
        TERMS = {};
        loaded = true;
        return TERMS;
      }
    })();

    return loadPromise;
  }

  /* =======================================================================
     3. УТИЛИТЫ
     ======================================================================= */

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* =======================================================================
     4. ОКНО ОПРЕДЕЛЕНИЯ
     ======================================================================= */

  function createPopup(termEl, data) {
    const el = document.createElement('div');
    el.className = 'term-popup';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Определение термина');
    el.innerHTML = `
      <button class="close" type="button" aria-label="Закрыть">×</button>
      <h4>${escapeHtml(data.title || '')}</h4>
      <p>${escapeHtml(data.text || '')}</p>
    `;

    el.querySelector('.close').addEventListener('click', closePopup);

    document.body.appendChild(el);
    positionPopup(el, termEl);

    // Фокус на кнопку закрытия для доступности
    el.querySelector('.close').focus({ preventScroll: true });

    return el;
  }

  function positionPopup(el, termEl) {
    const margin = 8;
    const r = termEl.getBoundingClientRect();
    const pw = el.offsetWidth;
    const ph = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // По горизонтали: по центру под термином
    let left = r.left + r.width / 2 - pw / 2;
    left = Math.max(margin, Math.min(left, vw - pw - margin));

    // По вертикали: сначала под, если не хватает места — над
    let top = r.bottom + margin;
    let placement = 'bottom';

    if (top + ph > vh - margin) {
      const above = r.top - ph - margin;
      if (above >= margin) {
        top = above;
        placement = 'top';
      } else {
        // Ни сверху, ни снизу — прижимаем к нижнему краю
        top = Math.max(margin, vh - ph - margin);
        placement = 'bottom';
      }
    }

    el.style.position = 'absolute';
    el.style.top = (top + window.scrollY) + 'px';
    el.style.left = (left + window.scrollX) + 'px';
    el.dataset.placement = placement;
  }

  function closePopup() {
    if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
    popup = null;
    if (activeTerm) {
      activeTerm.setAttribute('aria-expanded', 'false');
      activeTerm = null;
    }
  }

  /* =======================================================================
     5. ОТКРЫТИЕ ТЕРМИНА
     ======================================================================= */

  async function openTerm(termEl) {
    // Повторный клик по тому же термину — закрыть
    if (activeTerm === termEl && popup) {
      closePopup();
      return;
    }

    const dict = await loadTerms();
    const key = termEl.dataset.term;
    const data = dict[key];

    if (!data) {
      console.warn('[terms] Нет определения для ключа:', key);
      // Ненавязчиво подсветим, что определения нет
      termEl.classList.add('term-missing');
      return;
    }

    closePopup();

    activeTerm = termEl;
    termEl.setAttribute('aria-expanded', 'true');
    popup = createPopup(termEl, data);
  }

  /* =======================================================================
     6. ПРИВЯЗКА ТЕРМИНОВ
     ======================================================================= */

  function bindTerms() {
    const terms = document.querySelectorAll('.term[data-term]');
    if (!terms.length) return;

    terms.forEach(termEl => {
      // Доступность
      termEl.setAttribute('tabindex', '0');
      termEl.setAttribute('role', 'button');
      termEl.setAttribute('aria-haspopup', 'dialog');
      termEl.setAttribute('aria-expanded', 'false');
      if (!termEl.getAttribute('aria-label')) {
        termEl.setAttribute('aria-label',
          (termEl.textContent || 'Термин').trim() + ' — определение');
      }

      termEl.addEventListener('click', e => {
        e.stopPropagation();
        openTerm(termEl);
      });

      termEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          openTerm(termEl);
        }
      });
    });
  }

  /* =======================================================================
     7. ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ
     ======================================================================= */

  // Клик мимо окна — закрыть
  document.addEventListener('click', e => {
    if (!popup) return;
    if (popup.contains(e.target)) return;
    if (activeTerm && activeTerm.contains(e.target)) return;
    closePopup();
  });

  // ESC — закрыть
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && popup) {
      const prev = activeTerm;
      closePopup();
      // Вернуть фокус на термин
      if (prev && prev.focus) prev.focus({ preventScroll: true });
    }
  });

  // Прокрутка / ресайз — перепозиционировать (или закрыть, если ушёл за экран)
  let rafId = null;
  function reposition() {
    if (!popup || !activeTerm) return;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (!popup || !activeTerm) return;
      const r = activeTerm.getBoundingClientRect();
      // Если термин ушёл за пределы экрана — закрыть
      if (r.bottom < 0 || r.top > window.innerHeight) {
        closePopup();
        return;
      }
      positionPopup(popup, activeTerm);
    });
  }

  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition);

  /* =======================================================================
     8. МЕЛОЧИ
     ======================================================================= */

  // Немного визуальной подсказки для «нет определения»
  const style = document.createElement('style');
  style.textContent = `
    .term.term-missing {
      border-bottom-style: solid;
      border-bottom-color: var(--err);
      color: var(--err);
    }
  `;
  document.head.appendChild(style);

  /* =======================================================================
     9. ЗАПУСК
     ======================================================================= */

  function init() {
    bindTerms();
    // Предзагрузка словаря, чтобы первый клик был мгновенным
    loadTerms();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Экспорт — если нужно перепривязать после динамической вставки
  window.initTerms = init;
  window.closeTermPopup = closePopup;

})();