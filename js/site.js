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
