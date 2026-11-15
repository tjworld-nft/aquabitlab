/* AquaBit LAB — サイト共通の動き
 * ヘッダー／メニュー／出現アニメ／よくある質問を番号つきリンクで開く／実績の絞り込み／3分診断／お問い合わせ送信
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

  // ---------------------------------------------------------- よくある質問：番号つきリンク（#faq-…）で答えを開く
  // ページをひらいた時と、ページの中のリンクで # が変わった時の両方。<details> のときだけ開いて、そこへ送る。
  const openFaq = (atLoad) => {
    const d = document.getElementById(location.hash.slice(1));
    if (!d || d.tagName !== 'DETAILS') return;
    d.open = true;
    if (atLoad !== true) { d.scrollIntoView(); return; }
    // ページをひらいた時は、上から流さずに、すぐその答えへ着く（なめらかな動きを、この1回だけ切る）
    const root = document.documentElement;
    root.style.scrollBehavior = 'auto';
    d.scrollIntoView();
    requestAnimationFrame(() => requestAnimationFrame(() => { root.style.scrollBehavior = ''; }));
  };
  openFaq(true);
  addEventListener('hashchange', () => openFaq());
  // 同じリンクをもう一度押した時（# が変わらない時）も、閉じていたら開く
  document.addEventListener('click', (e) => {
    const a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    const d = a ? document.getElementById(a.getAttribute('href').slice(1)) : null;
    if (d && d.tagName === 'DETAILS') d.open = true;
  });

  // ---------------------------------------------------------- アプリの画面の帯：横に送れる幅のときだけ、キーボードで入れるようにする
  const shots = $$('.shots[tabindex]');
  if (shots.length) {
    const wide = matchMedia('(min-width: 1000px)');   // css/abl.css の .shots と同じ幅。PC は5枚が並ぶので送らない
    const setTab = () => shots.forEach((b) => {
      if (!b.dataset.label) b.dataset.label = b.getAttribute('aria-label') || '';
      if (wide.matches) { b.removeAttribute('tabindex'); b.setAttribute('aria-label', b.dataset.label.replace(/（.*?）$/, '')); }
      else { b.setAttribute('tabindex', '0'); b.setAttribute('aria-label', b.dataset.label); }
    });
    setTab();
    wide.addEventListener('change', setTab);
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
    // アプリの案内ページから来たとき（/contact?topic=app&app=…）：アプリ向けの見た目にして、本文にひな形を入れる。
    // ?topic=app でないときは、見た目を変えない（「アプリのこと」を手でえらんだ時に、どのアプリかをたずねる1行が出るだけ）。
    // app の値は、下の一覧にある物だけ受けつける。URL の文字は、そのまま画面に入れない。
    const APPS = {
      'gyoji-album': 'うちの行事アルバム',
      'umi-himekuri': '海の日めくり',
      hotoke: '仏のたとえ',
      ryumyaku: '龍脈マップ',
    };
    const appRadio = f.querySelector('input[name="topic"][value="app"]');
    let appTemplate = '';   // 本文に入れたひな形。これだけのまま送ろうとしたら、空と同じにあつかう
    // ふつうの /contact で「アプリのこと」を手でえらんだときは、どのアプリの話かをたずねる1行を出す（ほかの種類では出さない）
    // そのあいだ、お店の相談の例文（アプリの話には合わない）は隠す
    const appAsk = $('[data-app-ask]', f);
    const appEx = $('[data-app-ex]', f);
    if (appAsk && appRadio && topic !== 'app') {
      const askApp = () => { appAsk.hidden = !appRadio.checked; if (appEx) appEx.hidden = appRadio.checked; };
      f.addEventListener('change', (e) => { if (e.target && e.target.name === 'topic') askApp(); });
      f.addEventListener('reset', () => setTimeout(askApp, 0));
      // 「戻る」で帰ってきた時は、えらんだ種類だけがブラウザに戻されるので、もう一度合わせる
      addEventListener('pageshow', askApp);
      askApp();
    }
    if (topic === 'app' && appRadio) {
      appRadio.checked = true;
      // 送ったあとの reset() でも「アプリのこと」がえらばれたままになるように、はじめの値も替える
      $$('input[name="topic"]', f).forEach((r) => {
        r.defaultChecked = r === appRadio;
        if (r !== appRadio) r.closest('label').hidden = true;
      });
      $$('[data-biz]').forEach((el) => { el.hidden = true; });
      // 隠した欄は、送る中身にも入れない（自動入力が見えない欄に入れても、届かないように）
      $$('[data-biz] input, [data-biz] textarea, [data-biz] select').forEach((i) => { i.disabled = true; });
      const lead = $('[data-contact-lead]');
      if (lead) lead.textContent = 'アプリの使い方・不具合は、こちらから。通常2〜3営業日以内にお返事します。';
      const hint = $('[data-contact-hint]', f);
      const key = params.get('app') || '';
      const appName = Object.prototype.hasOwnProperty.call(APPS, key) ? APPS[key] : '';
      // どのアプリか決まらないとき（app が無い・一覧に無い）は、はじめにたずねる。入れるのは決まった文だけ
      if (hint) hint.textContent = (appName ? '' : 'どのアプリのことかを、はじめにお書きください。') + '写真やお子さまの情報など、ここに書かなくてよい情報は書かないでください。';
      if (appName && msg && !msg.value) {
        appTemplate = `【${appName}】\niPhone の機種：\niOS のバージョン：\nどの画面で、何が起きたか：\n`;
        msg.value = appTemplate;
      }
    }
    let tokenField = $('[name="form_token"]', f);
    // 更新直後に古いHTMLが残っている場合も、送信に必要な欄を補う。
    if (!tokenField) {
      tokenField = document.createElement('input');
      tokenField.type = 'hidden';
      tokenField.name = 'form_token';
      f.appendChild(tokenField);
    }
    const status = $('[data-status]', f);
    const btn = f.querySelector('button[type="submit"]');
    let tokenReadyAt = 0;
    let tokenExpiresAt = 0;
    let tokenRequest = null;
    let submitting = false;

    const clearToken = () => {
      tokenField.value = '';
      tokenReadyAt = 0;
      tokenExpiresAt = 0;
    };
    const loadToken = () => {
      if (tokenRequest) return tokenRequest;
      clearToken();
      tokenRequest = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const url = new URL(f.action, location.href);
          url.searchParams.set('action', 'token');
          const res = await fetch(url, {
            credentials: 'same-origin', cache: 'no-store',
            headers: { Accept: 'application/json' }, signal: controller.signal,
          });
          const data = await res.json();
          if (!res.ok || data.success !== true || !/^[a-f0-9]{64}$/i.test(data.token || '')) {
            throw new Error('Token unavailable');
          }
          tokenField.value = data.token;
          tokenReadyAt = Date.now() + Math.max(3, Number(data.min_wait) || 3) * 1000;
          tokenExpiresAt = Date.now() + Math.max(0, (Number(data.expires_in) || 7200) - 10) * 1000;
        } finally {
          clearTimeout(timeout);
        }
      })().finally(() => { tokenRequest = null; });
      return tokenRequest;
    };
    // 入力中に送信の準備を済ませる。失敗時は送信ボタンを押したときに再試行する。
    loadToken().catch(() => {});

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
        [el('message'), (v) => !v.trim() ? 'ご相談内容を入力してください。' : (appTemplate && v.trim() === appTemplate.trim() ? 'どの画面で、何が起きたかをお書きください。' : '')],
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
      if (submitting) return;
      const bad = check();
      if (bad) { bad.focus(); return; }
      submitting = true;
      btn.disabled = true;
      const label = btn.innerHTML;
      btn.textContent = '送信の準備をしています…';
      status.hidden = true;
      let postStarted = false;
      try {
        if (!tokenField.value || Date.now() >= tokenExpiresAt) await loadToken();
        const wait = tokenReadyAt - Date.now();
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        btn.textContent = '送信しています…';
        postStarted = true;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        let res;
        let data;
        try {
          res = await fetch(f.action, {
            method: 'POST', body: new FormData(f), credentials: 'same-origin',
            headers: { Accept: 'application/json' }, signal: controller.signal,
          });
          data = await res.json().catch(() => ({}));
        } finally {
          clearTimeout(timeout);
        }
        if (res.ok && data.success) {
          status.className = 'form__status is-ok';
          status.textContent = data.message || '送信しました。確認メールをお送りしました。';
          f.reset();
          try { sessionStorage.removeItem('abl-diag'); } catch (err) { /* noop */ }
        } else {
          status.className = 'form__status is-err';
          status.textContent = data.message || '送信できませんでした。時間をおいてお試しいただくか、メールでご連絡ください。';
        }
      } catch (err) {
        status.className = 'form__status is-err';
        status.textContent = postStarted
          ? '送信結果を確認できませんでした。確認メールが届いていない場合は、時間をおいて再度お試しいただくか、info@aquabit-lab.com へメールでご連絡ください。'
          : '送信の準備ができませんでした。Cookieを有効にして再度お試しいただくか、info@aquabit-lab.com へメールでご連絡ください。';
      } finally {
        // 送信結果が不明な場合も古いトークンを再使用しない。入力内容の自動再送はしない。
        if (postStarted) loadToken().catch(() => {});
        status.hidden = false;
        status.focus();
        submitting = false;
        btn.disabled = false;
        btn.innerHTML = label;
      }
    });
    ['name', 'email', 'message'].forEach((n) => {
      const el = f.querySelector(`[name="${n}"]`);
      if (el) el.addEventListener('blur', () => { if (el.getAttribute('aria-invalid') === 'true') check(); });
    });
  }
})();

/* 動画のレントゲン（X-RAY）
 * 縦動画を音なしで流しながら、いまの秒を作っている材料（実データ・AI・実写・人）を光らせる。
 * JS が無いとき・動きを減らす設定・省データでは、静止画と層の一覧がそのまま読める。
 */
(() => {
  'use strict';
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');

  // ---- 動画のレントゲン
  const saveData = navigator.connection && navigator.connection.saveData;
  $$('[data-xray]').forEach((fig) => {
    const v = fig.querySelector('video[data-src]');
    const layers = $$('[data-from]', fig);
    const bar = fig.querySelector('[data-xray-bar] i');
    const tEl = fig.querySelector('[data-xray-t]');
    const nowEl = fig.querySelector('[data-xray-now]');
    let lastKey = '';
    if (!v || reduce || saveData || !('IntersectionObserver' in window)) return;
    let loaded = false;
    const update = () => {
      const t = v.currentTime;
      layers.forEach((li) => li.classList.toggle('is-on', t >= +li.dataset.from && t < +li.dataset.to));
      if (bar && v.duration) bar.style.width = `${(t / v.duration) * 100}%`;
      if (tEl) tEl.textContent = `0:${pad(Math.floor(t))}`;
      if (nowEl) {
        const lit = layers.filter((li) => li.classList.contains('is-on'));
        const key = lit.map((li) => li.dataset.from + li.dataset.to).join();
        if (key !== lastKey) {
          lastKey = key;
          nowEl.replaceChildren(...lit.map((li) => { const s = document.createElement('span'); s.dataset.k = (li.querySelector('em') || {}).textContent || ''; s.textContent = (li.querySelector('b') || li).textContent; return s; }));
        }
      }
    };
    v.addEventListener('timeupdate', update);
    v.addEventListener('playing', () => fig.classList.add('is-playing'));
    new IntersectionObserver((ens) => {
      ens.forEach((en) => {
        if (en.isIntersecting) {
          if (!loaded) { v.src = v.dataset.src; loaded = true; }
          const p = v.play(); if (p && p.catch) p.catch(() => {});
        } else if (loaded) { v.pause(); }
      });
    }, { threshold: 0.3 }).observe(fig);
  });
})();
