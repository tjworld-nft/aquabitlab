/* AquaBit LAB — 共通のUI挙動（ナビ・スクロール出現・描画バックエンド表示） */
(function () {
  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var links = document.getElementById('navlinks');

  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('scrolled', window.scrollY > 24);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  if (links && nav && burger) {
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  var targets = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    targets.forEach(function (t) { io.observe(t); });
  } else {
    targets.forEach(function (t) { t.classList.add('in'); });
  }

  // FAQ アコーディオン（開けるのは常にひとつ）
  var faqButtons = document.querySelectorAll('.faq-q');
  faqButtons.forEach(function (q) {
    q.addEventListener('click', function () {
      var item = q.closest('.faq-item');
      var wasOpen = item.classList.contains('open');

      document.querySelectorAll('.faq-item.open').forEach(function (other) {
        other.classList.remove('open');
        other.querySelector('.faq-a').style.maxHeight = '0px';
        other.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      });

      if (!wasOpen) {
        var answer = item.querySelector('.faq-a');
        item.classList.add('open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
        q.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // お問い合わせフォーム（send-mail.php へ Ajax 送信）
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    var formMessage = document.getElementById('form-message');
    var submitBtn = document.getElementById('submit-btn');

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = '送信中...';

      formMessage.className = 'form-message';
      formMessage.textContent = '';

      fetch('/send-mail.php', { method: 'POST', body: new FormData(contactForm) })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data.success) {
            formMessage.className = 'form-message success';
            formMessage.textContent = result.data.message;
            contactForm.reset();
          } else {
            formMessage.className = 'form-message error';
            formMessage.textContent = result.data.message || '送信に失敗しました。';
          }
          formMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        })
        .catch(function () {
          formMessage.className = 'form-message error';
          formMessage.textContent = '通信エラーが発生しました。お手数ですが、直接メールにてお問い合わせください。';
          formMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        });
    });
  }

  // WebGPU / WebGL のどちらで描画しているかをバッジに反映
  var tag = document.getElementById('gpu-tag');
  if (tag) {
    var obs = new MutationObserver(function () {
      var backend = document.documentElement.dataset.heroBackend;
      if (!backend) return;
      tag.textContent = backend === 'webgpu' ? 'WebGPU' : 'WebGL';
      obs.disconnect();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-hero-backend'] });
  }
})();
