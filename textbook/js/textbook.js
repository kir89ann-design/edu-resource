/* =========================================================================
   Учебник: лайтбокс, навигация по темам, прогресс, статусы в оглавлении
   Подключается на textbook/index.html и textbook/chNN.html
   ========================================================================= */
(function () {
  'use strict';

  /* =======================================================================
     0. ХРАНИЛИЩЕ ПРОГРЕССА
     Ключ: "chapter:<id>" → { progress: 0..100, done: bool, ... }
     ======================================================================= */

  const PROGRESS_PREFIX = 'chapter:';

  function readChapter(chapter) {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_PREFIX + chapter) || '{}');
    } catch (e) {
      return {};
    }
  }

  function writeChapter(chapter, data) {
    try {
      localStorage.setItem(PROGRESS_PREFIX + chapter, JSON.stringify(data));
    } catch (e) { /* quota / приватный режим */ }
  }

  function setChapterProgress(chapter, percent) {
    if (!chapter) return;
    const data = readChapter(chapter);
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    if (!data.done) {
      data.progress = Math.max(data.progress || 0, p);
      writeChapter(chapter, data);
    }
  }

  // Публичный API для quiz.js
  window.setChapterDone = function (chapter, isDone) {
    if (!chapter) return;
    const data = readChapter(chapter);
    data.done = !!isDone;
    if (isDone) data.progress = 100;
    data.updatedAt = new Date().toISOString();
    writeChapter(chapter, data);
  };

  /* =======================================================================
     1. ЛАЙТБОКС (УВЕЛИЧЕНИЕ КАРТИНОК)
     ======================================================================= */

  function initLightbox() {
    const zoomables = document.querySelectorAll('img.zoomable');
    if (!zoomables.length) return;

    let overlay = document.querySelector('.lightbox');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'lightbox';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Просмотр изображения');
      overlay.innerHTML = '<img alt="">';
      document.body.appendChild(overlay);

      // Закрытие: клик по фону
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeLightbox();
      });

      // Закрытие: ESC
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && overlay.classList.contains('open')) {
          closeLightbox();
        }
      });
    }

    const big = overlay.querySelector('img');
    let lastFocused = null;

    function openLightbox(src, alt) {
      lastFocused = document.activeElement;
      big.src = src;
      big.alt = alt || '';
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      // Фокус на оверлей для доступности
      overlay.setAttribute('tabindex', '-1');
      overlay.focus();
    }

    function closeLightbox() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      big.removeAttribute('src');
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    // Делаем экспорт наружу (для случаев, если картинки добавляются динамически)
    window.openLightbox = openLightbox;
    window.closeLightbox = closeLightbox;

    zoomables.forEach(img => {
      img.style.cursor = 'zoom-in';
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', (img.alt || 'Изображение') + ' — увеличить');

      img.addEventListener('click', () => openLightbox(img.src, img.alt));
      img.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(img.src, img.alt);
        }
      });
    });
  }

  /* =======================================================================
     2. НАВИГАЦИЯ ПО ТЕМАМ (ПОДСВЕТКА АКТИВНОЙ СЕКЦИИ)
     ======================================================================= */

  function initTopicNav() {
    const nav = document.getElementById('topic-nav');
    if (!nav) return;

    const links = [...nav.querySelectorAll('a[href^="#"]')];
    if (!links.length) return;

    const sections = links
      .map(a => {
        const id = a.getAttribute('href').slice(1);
        return { link: a, section: document.getElementById(id) };
      })
      .filter(x => x.section);

    if (!sections.length) return;

    // ---------- Плавная прокрутка ----------
    links.forEach(a => {
      a.addEventListener('click', e => {
        const id = a.getAttribute('href');
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        const headerH = document.querySelector('.site-header')?.offsetHeight || 0;
        const top = target.getBoundingClientRect().top + window.scrollY - headerH - 16;
        window.scrollTo({ top, behavior: 'smooth' });
        history.replaceState(null, '', id);
        // Фокус на секцию
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
    });

    // ---------- IntersectionObserver для активной темы ----------
    let activeLink = null;
    function setActive(link) {
      if (activeLink === link) return;
      if (activeLink) activeLink.classList.remove('active');
      activeLink = link;
      if (activeLink) activeLink.classList.add('active');
    }

    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(entries => {
        // Берём самую «верхнюю» пересекающуюся секцию
        const visible = entries
          .filter(en => en.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) {
          const id = visible[0].target.id;
          const found = sections.find(s => s.section.id === id);
          if (found) setActive(found.link);
        }
      }, {
        rootMargin: '-25% 0px -60% 0px',
        threshold: 0,
      });

      sections.forEach(s => obs.observe(s.section));
    } else {
      // Fallback: scroll
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const headerH = document.querySelector('.site-header')?.offsetHeight || 0;
          const fromTop = window.scrollY + headerH + 40;
          let current = sections[0];
          sections.forEach(s => {
            if (s.section.offsetTop <= fromTop) current = s;
          });
          if (current) setActive(current.link);
          ticking = false;
        });
      }, { passive: true });
    }
  }

  /* =======================================================================
     3. ПРОГРЕСС ПО ГЛАВЕ (ПРИ ПРОКРУТКЕ)
     ======================================================================= */

  function initChapterProgress() {
    const bar = document.getElementById('chapter-progress');
    const main = document.querySelector('.chapter-content');
    if (!bar || !main) return;

    const chapter = main.dataset.chapter;
    if (!chapter) return;

    // Восстанавливаем прогресс
    const saved = readChapter(chapter);
    if (typeof saved.progress === 'number') {
      bar.value = saved.progress;
    }
    if (saved.done) {
      bar.value = 100;
      return; // если уже пройдено, не дёргаем дальше
    }

    let ticking = false;
    function update() {
      const rect = main.getBoundingClientRect();
      const total = main.offsetHeight - window.innerHeight;
      const passed = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      const pct = total > 0 ? Math.round(passed / total * 100) : 0;

      bar.value = pct;
      if (pct > 10) setChapterProgress(chapter, pct);
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  /* =======================================================================
     4. СТАТУСЫ В ОГЛАВЛЕНИИ И ОБЩИЙ ПРОГРЕСС
     ======================================================================= */

  function initTocStatuses() {
    // 4.1. Статусы отдельных глав
    const statuses = document.querySelectorAll('.status[data-status]');
    statuses.forEach(sp => {
      const chapter = sp.dataset.status;
      const data = readChapter(chapter);
      if (data.done) {
        sp.textContent = '✓ пройдено';
        sp.dataset.state = 'done';
        sp.title = 'Глава пройдена';
      } else if (data.progress && data.progress > 5) {
        sp.textContent = `◐ ${Math.round(data.progress)}%`;
        sp.dataset.state = 'progress';
        sp.title = 'Глава в процессе изучения';
      } else {
        sp.textContent = '○';
        sp.dataset.state = 'none';
        sp.title = 'Глава не начата';
      }
    });

    // 4.2. Общий прогресс
    const totalEl = document.getElementById('total-progress');
    if (!totalEl) return;

    const listItems = document.querySelectorAll('.toc-list li');
    if (!listItems.length) {
      totalEl.textContent = '0%';
      return;
    }

    let done = 0;
    let counted = 0;
    listItems.forEach(li => {
      const link = li.querySelector('a');
      if (!link) return;
      const m = link.getAttribute('href')?.match(/ch(\d+)/);
      if (!m) return;
      counted++;
      const data = readChapter('ch' + m[1]);
      if (data.done) done++;
    });

    const pct = counted ? Math.round(done / counted * 100) : 0;
    totalEl.textContent = pct + '%';
  }

  /* =======================================================================
     5. МЕЛОЧИ
     ======================================================================= */

  function initExtras() {
    // Если в адресе есть хеш — прокрутить к секции с учётом шапки
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) {
        setTimeout(() => {
          const headerH = document.querySelector('.site-header')?.offsetHeight || 0;
          const top = target.getBoundingClientRect().top + window.scrollY - headerH - 12;
          window.scrollTo({ top, behavior: 'auto' });
        }, 50);
      }
    }

    // Пометить ссылки на текущую главу в оглавлении
    if (document.querySelector('.toc-list')) {
      const here = location.pathname.split('/').pop();
      document.querySelectorAll('.toc-list a').forEach(a => {
        if (a.getAttribute('href') === here) {
          a.setAttribute('aria-current', 'page');
          a.closest('li')?.classList.add('toc-current');
        }
      });
    }
  }

  /* =======================================================================
     6. ЗАПУСК
     ======================================================================= */

  function init() {
    initLightbox();
    initTopicNav();
    initChapterProgress();
    initTocStatuses();
    initExtras();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Если контент подгружается позже — можно вызвать вручную
  window.initTextbook = init;

})();