/* =========================================================================
   ЭОР «Возобновляемая энергетика» — общие скрипты сайта
   Подключается на всех страницах.
   ========================================================================= */
(function () {
  'use strict';

  /* =======================================================================
     1. ТЕМА (светлая / тёмная)
     ======================================================================= */

  const THEME_KEY = 'theme';
  const root = document.documentElement;

  function getSavedTheme() {
    try { return localStorage.getItem(THEME_KEY); }
    catch (e) { return null; }
  }

  function saveTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); }
    catch (e) { /* приватный режим — игнорируем */ }
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      root.dataset.theme = 'dark';
    } else {
      delete root.dataset.theme; // = светлая по умолчанию
    }
    updateToggleButton(theme);
  }

  function currentTheme() {
    return root.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function updateToggleButton(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const isDark = theme === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.setAttribute(
      'aria-label',
      isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'
    );
    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  }

  function initTheme() {
    // 1) сохранённый выбор
    const saved = getSavedTheme();
    // 2) системная настройка, если выбора нет
    const prefersDark = window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    const initial = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(initial);

    // Вешаем обработчик на кнопку, когда DOM готов
    document.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById('theme-toggle');
      if (!btn) return;

      btn.addEventListener('click', () => {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        saveTheme(next);
      });
    });

    // Реакция на смену системной темы (только если пользователь не выбрал вручную)
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = e => {
        if (getSavedTheme()) return;
        applyTheme(e.matches ? 'dark' : 'light');
      };
      if (mq.addEventListener) mq.addEventListener('change', listener);
      else if (mq.addListener) mq.addListener(listener); // Safari < 14
    }
  }

  // Применяем тему как можно раньше, чтобы не было «мигания»
  initTheme();

  /* =======================================================================
     2. АКТИВНЫЙ ПУНКТ МЕНЮ
     ======================================================================= */

  function normalizePath(p) {
    try {
      return decodeURI(p)
        .replace(/\/index\.html?$/i, '/')
        .replace(/\/+$/, '')
        .toLowerCase();
    } catch (e) {
      return (p || '').toLowerCase();
    }
  }

  function initActiveNav() {
    const links = document.querySelectorAll('.site-header nav a[href]');
    if (!links.length) return;

    const current = normalizePath(location.pathname);

    links.forEach(a => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      let url;
      try { url = new URL(a.href, location.href); } catch (e) { return; }
      if (url.origin !== location.origin) return;

      const target = normalizePath(url.pathname);

      // Точное совпадение или текущая страница лежит внутри раздела
      const isMatch =
        target === current ||
        (target !== '/' && current.startsWith(target + '/'));

      if (isMatch) {
        // Не перебиваем уже выставленный вручную aria-current
        if (!a.hasAttribute('aria-current')) {
          a.setAttribute('aria-current', 'page');
        }
      } else if (a.getAttribute('aria-current') === 'page' && !a.dataset.manual) {
        // если разметка была неверной — снимаем
        a.removeAttribute('aria-current');
      }
    });
  }

  /* =======================================================================
     3. ПЛАВНАЯ ПРОКРУТКА К ЯКОРЯМ (#...)
     ======================================================================= */

  function initSmoothAnchors() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (!id || id === '#') return;

      const target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      const headerH = document.querySelector('.site-header')?.offsetHeight || 0;
      const top = target.getBoundingClientRect().top + window.scrollY - headerH - 12;

      window.scrollTo({ top, behavior: 'smooth' });
      history.replaceState(null, '', id);

      // Ставим фокус для доступности
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  /* =======================================================================
     4. МЕЛКИЕ УЛУЧШЕНИЯ
     ======================================================================= */

  function initExtras() {
    // Год в подвале, если есть .js-year
    document.querySelectorAll('.js-year').forEach(el => {
      el.textContent = new Date().getFullYear();
    });

    // Пометка «страница загружена» — можно стилизовать
    document.body.classList.add('js-loaded');

    // Внешние ссылки — добавляем rel и иконку
    document.querySelectorAll('a[href^="http"]').forEach(a => {
      try {
        const url = new URL(a.href);
        if (url.origin !== location.origin) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
      } catch (e) { /* ignore */ }
    });
  }

  /* =======================================================================
     5. ЗАПУСК
     ======================================================================= */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initActiveNav();
      initSmoothAnchors();
      initExtras();
    });
  } else {
    initActiveNav();
    initSmoothAnchors();
    initExtras();
  }

})();