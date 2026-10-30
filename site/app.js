(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // Language --------------------------------------------------------------------------------------------------
  const setLang = lang => {
    document.body.dataset.lang = lang; document.documentElement.lang = lang;
    $$('[data-set-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)));
    try { localStorage.setItem('oofa-lang', lang); } catch {}
    window.dispatchEvent(new Event('langchange'));
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  };
  let saved = null; try { saved = localStorage.getItem('oofa-lang'); } catch {}
  setLang(['en', 'es', 'pt'].includes(saved) ? saved : 'en'); // English first; the selector remembers the choice
  $$('[data-set-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.setLang)));

  // GitHub stars ----------------------------------------------------------------------------------------------
  fetch('https://api.github.com/repos/VictorSandovalDev/OpenOfficeForAll').then(r => r.ok ? r.json() : null).then(repo => {
    if (repo && repo.stargazers_count > 0) $('.star-count').textContent = `★ ${repo.stargazers_count}`;
  }).catch(() => {});

  // Parade of walkers and decorator objects (built here to keep the HTML short) --------------------------------
  const sheets = ['m-teal', 'f-coral', 'm-violet', 'f-lime', 'm-sun', 'f-pink', 'm-lime', 'f-violet', 'm-pink', 'f-teal'];
  $('.parade').innerHTML = sheets.map((s, i) => `<i class="walker" style="--sheet:url(assets/avatars/${s}.png); --d:${14 + (i % 4) * 3}s; --delay:${-i * 2.1}s"></i>`).join('');
  const objects = ['arcade-machine', 'fiddle-leaf-fig', 'gamer-chair', 'espresso-machine', 'mid-century-leather-couch-brown-down', 'globe', 'koi-pond', 'palm-tree-green', 'beach-umbrella-red', 'food-cart-red', 'small-fishtank', 'space-chair-red-down', 'fountain-stone', 'laptop-computer-white-down', 'bus-stop-glass', 'rubber-ducky-yellow-left'];
  $('.deco-grid').innerHTML = objects.map(o => `<img src="assets/objects/${o}.png" alt="" loading="lazy" />`).join('');

  // Clock ticks
  const ticks = $('.clock .ticks');
  if (ticks) ticks.innerHTML = Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<line x1="${60 + Math.sin(a) * 46}" y1="${60 - Math.cos(a) * 46}" x2="${60 + Math.sin(a) * 51}" y2="${60 - Math.cos(a) * 51}" />`; }).join('');

  // Team badges with lanyards (verlet physics) ----------------------------------------------------------------
  const TEAM = [
    { name: 'Ana', es: 'Diseño', en: 'Design', pt: 'Design', sheet: 'f-teal', c: '#3a9fd6', s: '#3ac07a', st: ['Disponible', 'Available', 'Disponível'], n: '0001' },
    { name: 'Leo', es: 'Backend', en: 'Backend', pt: 'Backend', sheet: 'm-lime', c: '#3f9a4b', s: '#ff4d5e', st: ['No molestar', 'Do not disturb', 'Não perturbe'], n: '0002' },
    { name: 'Mar', es: 'Producto', en: 'Product', pt: 'Produto', sheet: 'f-pink', c: '#e5603f', s: '#8f73ff', st: ['En reunión', 'In a meeting', 'Em reunião'], n: '0003' },
    { name: 'Sofi', es: 'Marketing', en: 'Marketing', pt: 'Marketing', sheet: 'f-sun', c: '#f0ac22', s: '#3ac07a', st: ['Disponible', 'Available', 'Disponível'], n: '0004' },
    { name: 'Teo', es: 'Soporte', en: 'Support', pt: 'Suporte', sheet: 'm-violet', c: '#5a4fcf', s: '#a8a2b8', st: ['Ausente', 'Away', 'Ausente'], n: '0005' },
  ];
  const stage = $('.badges'), strapSvg = $('.straps');
  if (stage) {
    stage.insertAdjacentHTML('beforeend', TEAM.map(t => `
      <div class="badge" style="--c:${t.c}; --s:${t.s}; --sheet:url(assets/avatars/${t.sheet}.png)">
        <div class="head"><b>OPEN OFFICE</b><span>Nº ${t.n}</span></div>
        <div class="pic"><i></i></div>
        <p class="name">${t.name}</p>
        <p class="role"><span lang="es">${t.es}</span><span lang="en">${t.en}</span><span lang="pt">${t.pt}</span></p>
        <span class="status"><i></i><span lang="es">${t.st[0]}</span><span lang="en">${t.st[1]}</span><span lang="pt">${t.st[2]}</span></span>
        <div class="barcode"></div>
      </div>`).join(''));
    const cards = $$('.badge', stage);
    const SEG = 9, ANCHOR_Y = 44; // the nails sit on a wooden rail near the top of the stage
    let topZ = 1;
    let bodies = [];
    const layout = () => {
      const w = stage.clientWidth, narrow = w < 700;
      const count = narrow ? 3 : cards.length;
      cards.forEach((c, i) => c.style.display = i < count ? '' : 'none');
      bodies = cards.slice(0, count).map((card, i) => {
        const ax = w * (i + .5) / count, len = (narrow ? 110 : 130) + (i % 2) * 60 + (i === 2 ? 30 : 0);
        const pts = Array.from({ length: SEG + 1 }, (_, k) => ({ x: ax, y: ANCHOR_Y + len * k / SEG, px: ax + (k ? rand(-4, 4) * k / SEG : 0), py: ANCHOR_Y + len * k / SEG }));
        return { card, pts, len: len / SEG, ax, drag: null, angle: 0 };
      });
      // A wooden rail with one nail per badge; each strap loops over its nail.
      strapSvg.innerHTML = `<defs><radialGradient id="nail" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#f4f1ea"/><stop offset=".45" stop-color="#b9b4c2"/><stop offset="1" stop-color="#5d566b"/></radialGradient></defs>
        <rect class="rail" x="${w * .03}" y="${ANCHOR_Y - 11}" width="${w * .94}" height="22" rx="6" />
        <rect class="rail-shade" x="${w * .03}" y="${ANCHOR_Y + 5}" width="${w * .94}" height="6" rx="3" />
        <g class="strap-paths">${bodies.map((b, i) => `<path stroke="${TEAM[i].c}" />`).join('')}</g>
        ${bodies.map(b => `<g class="nail" transform="translate(${b.ax} ${ANCHOR_Y})"><ellipse cx="2" cy="4" rx="9" ry="5" fill="#00000033"/><circle r="8" fill="url(#nail)" stroke="#4a4458" stroke-width="1"/><circle cx="-2.5" cy="-2.5" r="2.2" fill="#fff" opacity=".8"/></g>`).join('')}`;
    };
    function rand(a, b) { return a + Math.random() * (b - a); }
    layout(); addEventListener('resize', layout);

    const step = () => {
      for (const b of bodies) {
        const p = b.pts;
        // Heavy air and a speed limit: badges swing, they do not fly around.
        for (let k = 1; k < p.length; k++) {
          const q = p[k];
          let vx = (q.x - q.px) * .93, vy = (q.y - q.py) * .93;
          const speed = Math.hypot(vx, vy); if (speed > 9) { vx *= 9 / speed; vy *= 9 / speed; }
          q.px = q.x; q.py = q.y; q.x += vx; q.y += vy + .45;
        }
        const reach = b.len * SEG * 1.05;
        if (b.drag) { // the hand pulls the badge gently, and never further than the strap allows
          let tx = b.drag.x - b.ax, ty = b.drag.y - ANCHOR_Y; const d = Math.hypot(tx, ty);
          if (d > reach) { tx *= reach / d; ty *= reach / d; }
          const last = p[p.length - 1]; b.hold = { x: last.x + (b.ax + tx - last.x) * .18, y: last.y + (ANCHOR_Y + ty - last.y) * .18 };
          last.x = b.hold.x; last.y = b.hold.y;
        }
        for (let it = 0; it < 14; it++) {
          p[0].x = b.ax; p[0].y = ANCHOR_Y;
          for (let k = 0; k < p.length - 1; k++) {
            const a = p[k], c = p[k + 1], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1, diff = (d - b.len) / d;
            if (d < b.len) continue; // a strap goes slack, it does not push
            if (k === 0) { c.x -= dx * diff; c.y -= dy * diff; }
            else { a.x += dx * diff * .5; a.y += dy * diff * .5; c.x -= dx * diff * .5; c.y -= dy * diff * .5; }
          }
          if (b.drag) { const last = p[p.length - 1]; last.x = b.hold.x; last.y = b.hold.y; }
        }
        const last = p[p.length - 1], prev = p[p.length - 3];
        const target = Math.max(-.6, Math.min(.6, -Math.atan2(last.x - prev.x, last.y - prev.y))); // hang from the strap
        b.angle += (target - b.angle) * .12;
        b.card.style.transform = `translate(${last.x - b.card.offsetWidth / 2}px, ${last.y - 6}px) rotate(${b.angle}rad)`;
      }
      const paths = strapSvg.querySelector('.strap-paths')?.children ?? [];
      bodies.forEach((b, i) => { const p = b.pts; let d = `M${p[0].x},${p[0].y}`; for (let k = 1; k < p.length - 1; k++) { const mx = (p[k].x + p[k + 1].x) / 2, my = (p[k].y + p[k + 1].y) / 2; d += ` Q${p[k].x},${p[k].y} ${mx},${my}`; } d += ` L${p[p.length - 1].x},${p[p.length - 1].y}`; paths[i]?.setAttribute('d', d); });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    bodies.length && cards.forEach(card => card.addEventListener('pointerdown', e => {
      const body = bodies.find(b => b.card === card); if (!body) return;
      e.preventDefault(); card.setPointerCapture(e.pointerId); card.style.zIndex = String(++topZ);
      const move = ev => { const r = stage.getBoundingClientRect(); body.drag = { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
      const up = () => { body.drag = null; card.removeEventListener('pointermove', move); card.removeEventListener('pointerup', up); card.removeEventListener('pointercancel', up); };
      move(e); card.addEventListener('pointermove', move); card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up);
    }));
    // A little swing as the section scrolls into view.
    new IntersectionObserver(([entry]) => { if (entry.isIntersecting) bodies.forEach((b, i) => { const last = b.pts[b.pts.length - 1]; last.px = last.x + (i % 2 ? 8 : -8); }); }, { threshold: .4 }).observe(stage);
  }

  // Terminal typing --------------------------------------------------------------------------------------------
  const term = $('.term code');
  const script = [
    ['c', { es: '# pruébala en tu computador', en: '# try it on your computer', pt: '# experimente no seu computador' }],
    ['p', 'git clone https://github.com/VictorSandovalDev/OpenOfficeForAll'],
    ['p', 'cd OpenOfficeForAll && npm install'],
    ['ok', { es: '✓ listo en 14 s', en: '✓ done in 14 s', pt: '✓ pronto em 14 s' }],
    ['p', 'npm run dev'],
    ['ok', '➜ http://127.0.0.1:5173'],
    ['c', { es: '# ¿y en tu servidor? Docker y listo', en: '# on your server? Docker and done', pt: '# e no seu servidor? Docker e pronto' }],
    ['p', 'docker compose up -d'],
    ['ok', { es: '✓ tu oficina está en línea 🎉', en: '✓ your office is online 🎉', pt: '✓ seu escritório está no ar 🎉' }],
  ];
  let typed = false;
  const typeTerm = async () => {
    if (typed || !term) return; typed = true;
    const lang = () => document.body.dataset.lang || 'en';
    for (const [kind, text] of script) {
      const line = typeof text === 'string' ? text : text[lang()];
      const span = document.createElement('span'); span.className = kind;
      term.appendChild(document.createTextNode(kind === 'p' ? '' : '')); term.appendChild(span);
      const prefix = kind === 'p' ? '$ ' : '';
      if (kind === 'p' && !reduced) { span.textContent = prefix; for (const ch of line) { span.textContent += ch; await new Promise(r => setTimeout(r, 18 + Math.random() * 30)); } }
      else { await new Promise(r => setTimeout(r, reduced ? 0 : 380)); span.textContent = prefix + line; }
      term.appendChild(document.createTextNode('\n'));
    }
  };
  if (term) new IntersectionObserver(([entry], obs) => { if (entry.isIntersecting) { typeTerm(); obs.disconnect(); } }, { threshold: .4 }).observe(term);

  // Confetti ---------------------------------------------------------------------------------------------------
  $('.confetti-btn')?.addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    const origin = { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight };
    const colors = ['#5a4fcf', '#3f9a4b', '#e5603f', '#f0ac22', '#3a9fd6'];
    if (window.confetti) { confetti({ particleCount: 140, spread: 90, startVelocity: 45, origin, colors }); setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: .8 }, colors }), 200); setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: .8 }, colors }), 350); }
    setTimeout(() => { location.href = 'https://github.com/VictorSandovalDev/OpenOfficeForAll#-quick-start'; }, 1400);
  });

  // Nav hides while scrolling down -----------------------------------------------------------------------------
  let lastY = scrollY;
  // On phones the menu stays put.
  addEventListener('scroll', () => { const y = scrollY; $('.nav').classList.toggle('hide', innerWidth > 700 && y > 200 && y > lastY); lastY = y; }, { passive: true });

  if (reduced || !window.gsap) return;

  // Smooth scroll ----------------------------------------------------------------------------------------------
  gsap.registerPlugin(ScrollTrigger);
  let lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: .11, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => { const id = a.getAttribute('href'); if (id.length > 1 && $(id)) { e.preventDefault(); lenis.scrollTo(id === '#top' ? 0 : $(id), { offset: -20 }); } }));
  }

  // Hero intro --------------------------------------------------------------------------------------------------
  const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
  intro.from('.nav', { y: -80, opacity: 0, duration: 1 })
    .from('.hero-title .line > span', { yPercent: 110, duration: 1.1, stagger: .08 }, .1)
    .from('.hero .reveal', { y: 30, opacity: 0, duration: 1, stagger: .1 }, .35)
    .to('.marker path', { strokeDashoffset: 0, duration: .9, ease: 'power2.inOut' }, .8)
    .from('.cursor', { scale: 0, opacity: 0, duration: .6, stagger: .15, ease: 'back.out(3)' }, 1);
  // Cursors drift around like teammates moving their mouse.
  $$('.cursor').forEach((c, i) => {
    const wander = () => gsap.to(c, { x: gsap.utils.random(-140, 140), y: gsap.utils.random(-90, 90), duration: gsap.utils.random(1.6, 3), ease: 'sine.inOut', onComplete: wander, delay: i * .2 });
    wander();
  });

  // Marquee speeds up with scroll velocity ------------------------------------------------------------------------
  const track = $('.marquee-track');
  if (track) {
    track.innerHTML += track.innerHTML; // seamless loop
    let x = 0, boost = 0;
    gsap.ticker.add(() => {
      const v = lenis ? Math.abs(lenis.velocity) : 0; boost += (v * .35 - boost) * .1;
      x -= 1.1 + boost; const half = track.scrollWidth / 2; if (-x > half) x += half;
      track.style.transform = `translate3d(${x}px,0,0)`;
    });
  }

  // Section headings rise in ----------------------------------------------------------------------------------
  $$('.section-head').forEach(head => gsap.from(head.children, { y: 50, opacity: 0, duration: 1, stagger: .1, ease: 'expo.out', scrollTrigger: { trigger: head, start: 'top 82%' } }));

  // Stacked cards shrink as the next one covers them ----------------------------------------------------------
  const stackCards = $$('.stack .card');
  stackCards.forEach((card, i) => {
    if (i === stackCards.length - 1) return;
    gsap.to(card, { scale: .92 + i * .015, filter: 'brightness(.9) saturate(.8)', ease: 'none', scrollTrigger: { trigger: stackCards[i + 1], start: 'top 75%', end: 'top 25%', scrub: true } });
  });
  gsap.from('.deco-grid img', { scale: 0, rotate: () => gsap.utils.random(-40, 40), duration: .7, ease: 'back.out(2.2)', stagger: { each: .06, from: 'random' }, scrollTrigger: { trigger: '.art-deco', start: 'top 75%' } });

  // A day: pinned horizontal scroll and a clock -----------------------------------------------------------------
  const mm = gsap.matchMedia();
  mm.add('(min-width: 981px)', () => {
    const dayTrack = $('.day-track'), moments = $$('.moment');
    const times = moments.map(m => { const [h, mi] = m.dataset.time.split(':').map(Number); return h * 60 + mi; });
    const clockTime = $('.clock-time'), hour = $('.clock .hour'), minute = $('.clock .minute');
    const setClock = p => {
      const f = p * (times.length - 1), i = Math.min(times.length - 2, Math.floor(f));
      const t = times[i] + (times[i + 1] - times[i]) * (f - i);
      const h = Math.floor(t / 60), m = Math.floor(t % 60);
      clockTime.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      gsap.set(hour, { rotation: (h % 12) * 30 + m / 2, svgOrigin: '60 60' }); gsap.set(minute, { rotation: m * 6, svgOrigin: '60 60' });
      moments.forEach((el, k) => el.classList.toggle('now', Math.round(f) === k));
    };
    setClock(0);
    const tween = gsap.to(dayTrack, { x: () => -(dayTrack.scrollWidth - innerWidth * .62), ease: 'none', scrollTrigger: { trigger: '.day', pin: '.day-pin', start: 'top top', end: () => `+=${dayTrack.scrollWidth}`, scrub: .6, invalidateOnRefresh: true, onUpdate: s => setClock(s.progress) } });
    gsap.from(moments, { y: 80, opacity: 0, rotate: () => gsap.utils.random(-6, 6), duration: .8, stagger: .08, ease: 'back.out(1.6)', scrollTrigger: { trigger: '.day', start: 'top 60%' } });
    return () => tween.kill();
  });

  // Map cards: 3D tilt that follows the pointer ----------------------------------------------------------------
  $$('.tilt').forEach(card => {
    const rx = gsap.quickTo(card, 'rotationX', { duration: .5, ease: 'power3' }), ry = gsap.quickTo(card, 'rotationY', { duration: .5, ease: 'power3' });
    card.addEventListener('pointermove', e => { const r = card.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - .5) * 16); rx(-((e.clientY - r.top) / r.height - .5) * 16); });
    card.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });
  gsap.from('.map-card', { y: 120, opacity: 0, rotate: (i) => [-5, 0, 5][i], duration: 1.1, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: '.map-cards', start: 'top 80%' } });

  // Stats pop, final headline scales up -------------------------------------------------------------------------
  gsap.from('.stat', { y: 60, opacity: 0, scale: .9, duration: .9, stagger: .1, ease: 'back.out(1.8)', scrollTrigger: { trigger: '.stats', start: 'top 85%' } });
  gsap.from('.huge', { scale: .7, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.final', start: 'top 90%', end: 'top 30%', scrub: true } });

  // Magnetic buttons ---------------------------------------------------------------------------------------------
  $$('.magnetic').forEach(btn => {
    const xTo = gsap.quickTo(btn, 'x', { duration: .4, ease: 'power3' }), yTo = gsap.quickTo(btn, 'y', { duration: .4, ease: 'power3' });
    btn.addEventListener('pointermove', e => { const r = btn.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * .3); yTo((e.clientY - r.top - r.height / 2) * .4); });
    btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
})();
