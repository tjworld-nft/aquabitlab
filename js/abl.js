/* AquaBit LAB — サイト共通の動き
 * ヘッダー／メニュー／出現アニメ／実績の絞り込み／3分診断／お問い合わせ送信
 * どれも JS が無くてもページは読める（JS は“あると便利”の役）。
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------------------------------------------------------- ヘッダー
  const header = $('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-solid', window.scrollY > 24);
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
  }

  // ---------------------------------------------------------- スマホのメニュー
  const menuBtn = $('[data-menu]');
  const mnav = $('[data-mnav]');
  if (menuBtn && mnav) {
    const open = () => {
      mnav.hidden = false;
      requestAnimationFrame(() => document.body.classList.add('menu-open'));
      menuBtn.setAttribute('aria-expanded', 'true');
      menuBtn.setAttribute('aria-label', 'メニューを閉じる');
      const first = mnav.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    };
    const close = (focusBtn = true) => {
      document.body.classList.remove('menu-open');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.setAttribute('aria-label', 'メニューを開く');
      setTimeout(() => { if (!document.body.classList.contains('menu-open')) mnav.hidden = true; }, 320);
      if (focusBtn) menuBtn.focus({ preventScroll: true });
    };
    menuBtn.addEventListener('click', () => (document.body.classList.contains('menu-open') ? close() : open()));
    mnav.addEventListener('click', (e) => { if (e.target.closest('a')) close(false); });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('menu-open')) close();
      if (e.key === 'Tab' && document.body.classList.contains('menu-open')) {
        const items = [menuBtn, ...$$('a, button', mnav)];
        const i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    });
    matchMedia('(min-width: 1081px)').addEventListener('change', (m) => { if (m.matches) close(false); });
  }

  // ---------------------------------------------------------- 出現アニメ
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  // ---------------------------------------------------------- 実績の絞り込み
  const chips = $$('[data-filter]');
  if (chips.length) {
    const cards = $$('[data-cat]');
    const apply = (cat) => {
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === cat)));
      cards.forEach((card) => {
        const show = cat === 'all' || card.dataset.cat.split(' ').includes(cat);
        card.hidden = !show;
        if (show) card.classList.add('is-in');
      });
      // 中身が全部隠れたグループは、余白ごと隠す
      $$('.works').forEach((g) => { g.hidden = !$$('[data-cat]', g).some((c) => !c.hidden); });
      const live = $('[data-filter-live]');
      if (live) live.textContent = `${cards.filter((c) => !c.hidden).length}件を表示しています`;
    };
    chips.forEach((c) => c.addEventListener('click', () => {
      apply(c.dataset.filter);
      history.replaceState(null, '', c.dataset.filter === 'all' ? location.pathname : `#${c.dataset.filter}`);
    }));
    const fromHash = () => {
      const h = location.hash.slice(1);
      if (h && chips.some((c) => c.dataset.filter === h)) apply(h);
    };
    fromHash();
    addEventListener('hashchange', fromHash);
  }

  // ---------------------------------------------------------- 3分診断
  const diag = $('[data-diag]');
  if (diag) initDiag(diag);

  function initDiag(root) {
    const steps = $$('[data-step]', root);
    const result = $('[data-result]', root);
    const bars = $$('[data-progress] i', root);
    const counter = $('[data-counter]', root);
    let idx = 0;

    const INDUSTRY = {
      food: { name: '飲食店・小売店', post: '今日のおすすめや入荷の知らせ', ask: '営業時間・予約・在庫' },
      school: { name: '教室・スクール・サロン', post: '教室の様子や、上達のコツ', ask: '体験の申し込み・持ち物・日程' },
      leisure: { name: '観光・レジャー・宿泊', post: '季節の見どころや当日の様子', ask: '空き状況・集合場所・雨の日の扱い' },
      office: { name: '士業・事務所・コンサル', post: '制度の変更点のやさしい解説', ask: '必要書類・料金・進め方' },
      craft: { name: '製造・建設・専門工事', post: '施工事例や技術の紹介', ask: '見積もり依頼・納期・対応エリア' },
      solo: { name: '個人事業・フリーランス', post: '制作事例や日々の考え', ask: '依頼方法・料金・納期' },
      other: { name: 'その他', post: '日々の取り組み', ask: 'よくある質問' },
    };
    const PAIN = {
      post: { name: '発信（SNS・ブログ）が続かない', track: 'build',
        title: (i) => '発信を「週1本・30分」の仕組みに',
        body: (i) => `スマホの写真と短いメモをAIに渡して、ブログやSNSの下書きまで作る流れを決めます。たとえば「${i.post}」を、考え込まずに出せるようにします。三浦 海の学校のブログも、この流れで続けています。`,
        link: ['/works#web', '実例を見る'] },
      inquiry: { name: '問い合わせ・予約の対応に追われる', track: 'build',
        title: () => 'よくある質問を「AIの案内役」に',
        body: (i) => `「${i.ask}」のような、毎回同じ答えになる質問を整理して、返信の下書き・サイトのFAQ・AIに正しく紹介されるための案内（llms.txt）を整えます。`,
        link: ['https://miura-diving.com/llms.txt', 'AI向けの案内の例'] },
      docs: { name: '書類・事務作業が多い', track: 'consult',
        title: () => '書類づくりを「ひな形＋AIの下書き」に',
        body: () => '見積書・報告書・議事録など、毎回ゼロから作っている書類をひな形にして、AIが下書きする流れにします。まずは一番時間を取られている1種類から。',
        link: null },
      web: { name: 'Webサイトが古い・集客につながらない', track: 'build',
        title: () => 'サイトを「速く・直せる・AIに読まれる」形に',
        body: () => 'スマホで速く開けて、自分たちで直せて、ChatGPTなどのAIにも正しく読まれるサイトへ。三浦 海の学校のサイトは作り直しで、スマホの表示速度スコアが55から93になりました（自社計測）。',
        link: ['/works#web', 'サイトの実例を見る'] },
      team: { name: '社内でAIが使われていない', track: 'teach',
        title: () => '社内に「使い方の型」を配る',
        body: () => 'よく使う頼み方（プロンプト）と、AIに入れてはいけない情報のルールを1枚にまとめて、30分の勉強会から始めます。使う人が1人増えるごとに、効果が広がります。',
        link: null },
      make: { name: '作りたいもの（アプリ・動画など）がある', track: 'build',
        title: () => '作りたいものを「小さな試作」から',
        body: () => 'アプリや動画は、まず動く小さな試作を作って、実際に使ってから広げます。コードが書けなくても、AIといっしょなら形にできます（Vibe Coding）。',
        link: ['/works#apps', 'アプリの実例を見る'] },
      unsure: { name: '何から始めればいいかわからない', track: 'consult',
        title: () => 'まずは「仕事の棚卸し」から',
        body: () => '1日の仕事を書き出して、AIに任せられそうな作業に印をつけます。最初に効果が出やすいのは、文章づくりと調べものです。',
        link: null },
    };
    const USE = {
      none: { name: 'まだ使っていない', title: 'ChatGPT・Claude・Geminiのどれか1つを、まず1か月', body: 'ツール選びで迷う時間がもったいないので、1つに決めて毎日1回使うところから。どれを選ぶかも、相談で一緒に決められます。' },
      free: { name: '無料版を少し使っている', title: '有料版に切り替えるかを、使い方から判断', body: '無料版で足りる使い方もあります。1週間の使い方を見て、月額料金に見合うかを一緒に判断します。' },
      paid: { name: '有料版を使っている', title: '「上手い人のやり方」を、社内の標準に', body: '人によって使い方がばらばらになりがちです。うまくいった頼み方を集めて、誰でも同じ結果が出せる形に揃えます。' },
    };
    const TRACK = {
      consult: ['01 相談する', 'まずはスポット相談で、あなたの仕事に合う「導入プラン」を作るところからがおすすめです。'],
      build: ['02 いっしょに作る', '仕組みを作って、毎日回るところまでいっしょに作る進め方がおすすめです。'],
      teach: ['03 自分たちで回す', '研修や勉強会で、社内に「使える人」を増やす進め方がおすすめです。'],
    };

    const show = (n) => {
      idx = n;
      steps.forEach((s, i) => { s.hidden = i !== n; });
      result.hidden = true;
      bars.forEach((b, i) => b.classList.toggle('on', i <= n));
      if (counter) counter.textContent = `Q${n + 1} / ${steps.length}`;
      const q = $('.diag__q', steps[n]);
      if (q && root.dataset.started) q.focus({ preventScroll: false });
      root.dataset.started = '1';
    };
    const values = (name) => $$(`input[name="${name}"]:checked`, root).map((i) => i.value);

    // 困りごとは3つまで
    $$('input[name="pain"]', root).forEach((cb) => cb.addEventListener('change', () => {
      const on = values('pain');
      $$('input[name="pain"]', root).forEach((x) => { x.disabled = !x.checked && on.length >= 3; });
    }));

    steps.forEach((s, i) => {
      const next = $('[data-next]', s);
      const back = $('[data-back]', s);
      const err = $('[data-err]', s);
      if (next) next.addEventListener('click', () => {
        const name = s.dataset.step;
        if (!values(name).length) { err.hidden = false; return; }
        err.hidden = true;
        if (i < steps.length - 1) show(i + 1); else finish();
      });
      if (back) back.addEventListener('click', () => show(i - 1));
    });

    function finish() {
      const ind = INDUSTRY[values('industry')[0]] || INDUSTRY.other;
      const pains = values('pain');
      const use = USE[values('use')[0]] || USE.none;
      const size = values('size')[0] || 'solo';

      // 提案はいつも3つ：困りごと（最大3）＋AIの使い方の一歩、足りなければ定番で埋める
      const toPlan = (p) => ({ title: p.title(ind), body: p.body(ind), link: p.link });
      const useStep = { title: use.title, body: use.body, link: null };
      let plan;
      if (pains.length >= 3) {
        plan = pains.slice(0, 3).map((p) => toPlan(PAIN[p]));
      } else {
        plan = pains.map((p) => toPlan(PAIN[p]));
        plan.push(useStep);
        for (const f of ['unsure', 'post', 'inquiry', 'team']) {
          if (plan.length >= 3) break;
          if (!pains.includes(f)) plan.push(toPlan(PAIN[f]));
        }
      }

      // おすすめの進め方
      const tally = { consult: 0, build: 0, teach: 0 };
      pains.forEach((p) => { tally[PAIN[p].track] += 1; });
      if (size === 'large') tally.teach += 1.5;
      if (size === 'solo') tally.build += 0.5;
      let track = 'consult';
      if (tally.build > tally.consult && tally.build >= tally.teach) track = 'build';
      if (tally.teach > tally.build && tally.teach > tally.consult) track = 'teach';

      const list = $('[data-plan]', result);
      list.innerHTML = '';
      plan.forEach((p) => {
        const li = document.createElement('li');
        const b = document.createElement('b'); b.textContent = p.title;
        const para = document.createElement('p'); para.textContent = p.body;
        if (p.link) {
          para.append(' ');
          const a = document.createElement('a');
          a.href = p.link[0]; a.textContent = `${p.link[1]} →`;
          if (/^https?:/.test(p.link[0])) { a.target = '_blank'; a.rel = 'noopener'; }
          para.append(a);
        }
        const wrap = document.createElement('div');
        wrap.append(b, para);
        li.append(wrap);
        list.append(li);
      });
      $('[data-track]', result).innerHTML = '';
      const tb = document.createElement('b'); tb.textContent = `おすすめの進め方：${TRACK[track][0]}`;
      $('[data-track]', result).append(tb, document.createElement('br'), TRACK[track][1]);
      if (pains.length >= 3) {
        const u = document.createElement('span');
        u.style.display = 'block'; u.style.marginTop = '8px'; u.style.color = 'var(--on-dark-2)';
        u.textContent = `AIの使い方（${use.name}）：${use.title}。`;
        $('[data-track]', result).append(u);
      }

      const sizeName = { solo: 'ひとり', small: '2〜9人', large: '10人以上' }[size];
      const summary = [
        '【3分診断の結果】',
        `業種：${ind.name}`,
        `困りごと：${pains.map((p) => PAIN[p].name).join('／')}`,
        `AIの利用：${use.name}`,
        `人数：${sizeName}`,
        '',
        '（ここに、くわしい状況やご質問をお書きください）',
      ].join('\n');
      // 保存は「この内容で相談する」を押したときだけ（プライバシーポリシーの記載どおり）
      const go = $('[data-diag-contact]', result);
      if (go) go.onclick = () => { try { sessionStorage.setItem('abl-diag', summary); } catch (e) { /* 保存できなくても続ける */ } };

      const prompt = `私は${ind.name}の仕事をしています（${sizeName}）。困っていることは「${pains.map((p) => PAIN[p].name).join('」「')}」、AIは${use.name}です。` +
        'AquaBit LAB（https://aquabit-lab.com/llms.txt）の考え方も参考に、最初の1か月でできるAI活用の具体的な手順を、私に質問しながら一緒に考えてください。不確かなことは断定しないでください。';
      $('[data-ask-ai]', result).href = `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;

      steps.forEach((s) => { s.hidden = true; });
      bars.forEach((b) => b.classList.add('on'));
      if (counter) counter.textContent = 'RESULT';
      result.hidden = false;
      const h = $('[data-result-title]', result);
      h.focus({ preventScroll: true });
      root.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }

    const retry = $('[data-retry]', root);
    if (retry) retry.addEventListener('click', () => {
      $$('input', root).forEach((i) => { i.checked = false; i.disabled = false; });
      show(0);
    });
    show(0);
  }

  // ---------------------------------------------------------- お問い合わせ
  const form = $('[data-contact]');
  if (form) initForm(form);

  function initForm(f) {
    const params = new URLSearchParams(location.search);
    const topic = params.get('topic');
    if (topic) {
      const r = f.querySelector(`input[name="topic"][value="${CSS.escape(topic)}"]`);
      if (r) r.checked = true;
    }
    const msg = f.querySelector('[name="message"]');
    if (params.get('from') === 'diagnosis' && msg && !msg.value) {
      try { const s = sessionStorage.getItem('abl-diag'); if (s) msg.value = s; } catch (e) { /* noop */ }
    }
    const ts = $('[data-ts]', f);
    if (ts) ts.value = String(Date.now());
    const status = $('[data-status]', f);
    const btn = f.querySelector('button[type="submit"]');

    const setErr = (el, text) => {
      const box = f.querySelector(`[data-err-for="${el.name}"]`);
      el.setAttribute('aria-invalid', text ? 'true' : 'false');
      if (box) { box.textContent = text || ''; box.hidden = !text; }
    };
    const check = () => {
      let first = null;
      const el = (n) => f.elements.namedItem(n);   // f.name はフォーム自身の name 属性なので使わない
      const need = [
        [el('name'), (v) => v.trim() ? '' : 'お名前を入力してください。'],
        [el('email'), (v) => !v.trim() ? 'メールアドレスを入力してください。' : (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'メールアドレスの形式をご確認ください。')],
        [el('message'), (v) => v.trim() ? '' : 'ご相談内容を入力してください。'],
      ];
      need.forEach(([el, rule]) => { const t = rule(el.value); setErr(el, t); if (t && !first) first = el; });
      const agree = f.querySelector('[name="agree"]');
      const agreeErr = f.querySelector('[data-err-for="agree"]');
      if (agree && !agree.checked) { agreeErr.hidden = false; agreeErr.textContent = 'プライバシーポリシーへの同意が必要です。'; if (!first) first = agree; }
      else if (agreeErr) agreeErr.hidden = true;
      return first;
    };

    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bad = check();
      if (bad) { bad.focus(); return; }
      btn.disabled = true;
      const label = btn.innerHTML;
      btn.textContent = '送信しています…';
      status.hidden = true;
      try {
        const res = await fetch(f.action, { method: 'POST', body: new FormData(f), headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          status.className = 'form__status is-ok';
          status.textContent = data.message || '送信しました。確認メールをお送りしました。';
          f.reset();
          if (ts) ts.value = String(Date.now());
          try { sessionStorage.removeItem('abl-diag'); } catch (err) { /* noop */ }
        } else {
          status.className = 'form__status is-err';
          status.textContent = data.message || '送信できませんでした。時間をおいてお試しいただくか、メールでご連絡ください。';
        }
      } catch (err) {
        status.className = 'form__status is-err';
        status.textContent = '通信できませんでした。時間をおいてお試しいただくか、info@aquabit-lab.com へメールでご連絡ください。';
      }
      status.hidden = false;
      status.focus();
      btn.disabled = false;
      btn.innerHTML = label;
    });
    ['name', 'email', 'message'].forEach((n) => {
      const el = f.querySelector(`[name="${n}"]`);
      if (el) el.addEventListener('blur', () => { if (el.getAttribute('aria-invalid') === 'true') check(); });
    });
  }
})();
