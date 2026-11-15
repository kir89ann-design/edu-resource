/* =========================================================================
   Валидация формы обратной связи (contacts.html)
   Подключается только на странице контактов.
   ========================================================================= */
(function () {
  'use strict';

  const form = document.getElementById('contact-form');
  if (!form) return;

  /* =======================================================================
     1. ОПИСАНИЕ ПОЛЕЙ И ПРАВИЛ
     ======================================================================= */

  const fields = {
    name: {
      el: form.querySelector('[name=name]'),
      err: form.querySelector('[data-err=name]'),
      validate: v => {
        const s = (v || '').trim();
        if (s.length < 2) return 'Укажите имя (минимум 2 символа)';
        if (s.length > 80) return 'Слишком длинное имя (до 80 символов)';
        return true;
      },
    },
    email: {
      el: form.querySelector('[name=email]'),
      err: form.querySelector('[data-err=email]'),
      validate: v => {
        const s = (v || '').trim();
        if (!s) return 'Укажите email';
        // простая, но рабочая проверка
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return 'Неверный адрес email';
        if (s.length > 120) return 'Слишком длинный email';
        return true;
      },
    },
    subject: {
      el: form.querySelector('[name=subject]'),
      err: form.querySelector('[data-err=subject]'),
      validate: v => {
        const s = (v || '').trim();
        if (s.length > 120) return 'Тема слишком длинная (до 120 символов)';
        return true; // тема необязательна
      },
    },
    message: {
      el: form.querySelector('[name=message]'),
      err: form.querySelector('[data-err=message]'),
      validate: v => {
        const s = (v || '').trim();
        if (s.length < 10) return 'Сообщение — минимум 10 символов';
        if (s.length > 5000) return 'Слишком длинное сообщение (до 5000 символов)';
        return true;
      },
    },
    consent: {
      el: form.querySelector('[name=consent]'),
      err: form.querySelector('[data-err=consent]'),
      validate: (_, el) => el.checked || 'Необходимо согласие на обработку данных',
    },
  };

  /* =======================================================================
     2. СООБЩЕНИЕ ОБ УСПЕХЕ (создаём один раз)
     ======================================================================= */

  let okMsg = form.querySelector('.ok-msg');
  if (!okMsg) {
    okMsg = document.createElement('div');
    okMsg.className = 'ok-msg';
    okMsg.setAttribute('role', 'status');
    okMsg.setAttribute('aria-live', 'polite');
    form.appendChild(okMsg);
  }

  /* =======================================================================
     3. ПРОВЕРКА ОДНОГО ПОЛЯ
     ======================================================================= */

  function checkField(name) {
    const f = fields[name];
    if (!f || !f.el) return true;

    const res = f.validate(f.el.value, f.el);

    if (res === true) {
      f.el.classList.remove('invalid');
      f.el.removeAttribute('aria-invalid');
      if (f.err) f.err.textContent = '';
      return true;
    }

    f.el.classList.add('invalid');
    f.el.setAttribute('aria-invalid', 'true');
    if (f.err) f.err.textContent = res;
    return false;
  }

  /* =======================================================================
     4. ЖИВАЯ ВАЛИДАЦИЯ
     ======================================================================= */

  Object.entries(fields).forEach(([name, f]) => {
    if (!f.el) return;

    // при уходе из поля — проверить
    f.el.addEventListener('blur', () => checkField(name));

    // при вводе — гасим ошибку, если она уже показана
    const evt = f.el.type === 'checkbox' ? 'change' : 'input';
    f.el.addEventListener(evt, () => {
      if (f.err && f.err.textContent) checkField(name);
      if (okMsg.textContent) okMsg.textContent = '';
    });

    // чекбокс проверяем сразу при переключении
    if (f.el.type === 'checkbox') {
      f.el.addEventListener('change', () => checkField(name));
    }
  });

  /* =======================================================================
     5. ОТПРАВКА
     ======================================================================= */

  form.addEventListener('submit', e => {
    // Проверяем все поля
    const allOk = Object.keys(fields).every(checkField);

    if (!allOk) {
      e.preventDefault();
      // фокус на первое ошибочное поле
      const first = Object.entries(fields).find(([, f]) => f.err && f.err.textContent);
      first?.[1].el?.focus();
      okMsg.textContent = '';
      return;
    }

    // Определяем режим работы
    const action = (form.getAttribute('action') || '').trim();
    const isDemo = !action || action === '#' || action.startsWith('mailto:');
    const isFormspree = /formspree\.io/i.test(action);

    // Демо-режим: показываем сообщение и сбрасываем
    if (isDemo) {
      e.preventDefault();
      okMsg.textContent = 'Спасибо! Сообщение готово к отправке.';
      form.reset();
      Object.values(fields).forEach(f => {
        f.el?.classList.remove('invalid');
        f.el?.removeAttribute('aria-invalid');
        if (f.err) f.err.textContent = '';
      });
      return;
    }

    // Formspree / свой бэкенд — отправляем обычным submit.
    // Показываем промежуточное состояние.
    if (isFormspree) {
      const btn = form.querySelector('button[type=submit]');
      if (btn) {
        btn.disabled = true;
        btn.dataset.originalText = btn.textContent;
        btn.textContent = 'Отправка…';
      }
      // Если сервер ответит ошибкой — Formspree обычно перезагружает страницу;
      // для надёжности через 15 секунд возвращаем кнопку в исходное состояние.
      setTimeout(() => {
        if (btn) {
          btn.disabled = false;
          btn.textContent = btn.dataset.originalText || 'Отправить';
        }
      }, 15000);
    }

    // Если хотим отправлять через fetch и показывать сообщение без перезагрузки:
    // (раскомментируйте, если нужен именно AJAX-режим)
    //
    // e.preventDefault();
    // fetch(action, {
    //   method: 'POST',
    //   body: new FormData(form),
    //   headers: { 'Accept': 'application/json' }
    // })
    //   .then(r => {
    //     if (!r.ok) throw new Error('HTTP ' + r.status);
    //     okMsg.textContent = 'Спасибо! Сообщение отправлено.';
    //     form.reset();
    //   })
    //   .catch(err => {
    //     okMsg.style.color = 'var(--err)';
    //     okMsg.textContent = 'Не удалось отправить. Попробуйте позже.';
    //     console.error('[contact]', err);
    //   });
  });

  /* =======================================================================
     6. СБРОС ОШИБОК ПРИ RESET
     ======================================================================= */

  form.addEventListener('reset', () => {
    setTimeout(() => {
      Object.values(fields).forEach(f => {
        f.el?.classList.remove('invalid');
        f.el?.removeAttribute('aria-invalid');
        if (f.err) f.err.textContent = '';
      });
      okMsg.textContent = '';
    }, 0);
  });

})();