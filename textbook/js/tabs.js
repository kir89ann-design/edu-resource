/* =========================================================================
   Переключение вкладок в блоке «Проверка знаний»
   Разметка:
     <div class="tab-controls" role="tablist">
       <button role="tab" data-tab="test">Тест</button>
       <button role="tab" data-tab="case">Кейс-задание</button>
       <button role="tab" data-tab="questions">Вопросы для самопроверки</button>
     </div>
     <div id="tab-test" role="tabpanel">…</div>
     <div id="tab-case" role="tabpanel" hidden>…</div>
     <div id="tab-questions" role="tabpanel" hidden>…</div>
   ========================================================================= */
(function () {
  'use strict';

  function initTabs(root) {
    const scope = root || document;
    const controls = scope.querySelector('.tab-controls');
    if (!controls) return;

    const buttons = [...controls.querySelectorAll('button[role="tab"]')];
    if (!buttons.length) return;

    // Панели ищем по data-tab → id = "tab-<name>"
    const panels = {};
    buttons.forEach(btn => {
      const name = btn.dataset.tab;
      if (!name) return;
      const panel = scope.querySelector('#tab-' + name);
      if (panel) panels[name] = panel;
    });

    if (!Object.keys(panels).length) return;

    // Индексы для клавиатурной навигации
    const tabs = buttons.filter(b => panels[b.dataset.tab]);

    function activate(name, focus) {
      tabs.forEach(btn => {
        const isActive = btn.dataset.tab === name;
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        btn.setAttribute('tabindex', isActive ? '0' : '-1');
        if (isActive && focus) btn.focus();
      });
      Object.entries(panels).forEach(([k, p]) => {
        if (k === name) {
          p.hidden = false;
          p.removeAttribute('aria-hidden');
        } else {
          p.hidden = true;
          p.setAttribute('aria-hidden', 'true');
        }
      });

      // Сохраняем выбор в localStorage (по главе)
      const chapter = document.querySelector('.chapter-content')?.dataset.chapter;
      if (chapter) {
        try { localStorage.setItem('tab:' + chapter, name); } catch (e) {}
      }
    }

    // Клик
    tabs.forEach(btn => {
      btn.addEventListener('click', () => activate(btn.dataset.tab, false));
    });

    // Клавиатура: ←/→/Home/End
    controls.addEventListener('keydown', e => {
      const current = document.activeElement;
      if (!current || current.getAttribute('role') !== 'tab') return;
      const i = tabs.indexOf(current);
      if (i < 0) return;

      let next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];

      if (next) {
        e.preventDefault();
        activate(next.dataset.tab, true);
      }
    });

    // Стартовое состояние: из localStorage или первая вкладка
    const chapter = document.querySelector('.chapter-content')?.dataset.chapter;
    let initial = null;
    if (chapter) {
      try { initial = localStorage.getItem('tab:' + chapter); } catch (e) {}
    }
    if (!initial || !panels[initial]) {
      initial = tabs[0].dataset.tab;
    }
    activate(initial, false);
  }

  // Запуск
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initTabs(document));
  } else {
    initTabs(document);
  }

  // Экспорт для повторной инициализации (если понадобится)
  window.initTabs = initTabs;
})();