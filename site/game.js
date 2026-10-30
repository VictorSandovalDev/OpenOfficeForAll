/* A playable corner of the Studio map: walk with the arrows, WASD or a click, meet whoever is nearby and cross the
   street at the zebra crossing. Collision data comes from the real map (assets/world/studio.json). */
(() => {
  const root = document.querySelector('.game');
  if (!root) return;
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const strip = root.querySelector('.video-strip');
  const roomToast = root.querySelector('.toast-room');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lang = () => document.body.dataset.lang === 'es' ? 'es' : 'en';
  const YOU = { en: 'You', es: 'Tú' };

  const T = 32, CELL = 92, FOOT_Y = 69, STEP_MS = 190, FRAME_MS = 110;
  const DIRS = { south: 0, north: 1, east: 2, west: 3 };
  const KEYS = { arrowup: [0, -1, 'north'], w: [0, -1, 'north'], arrowdown: [0, 1, 'south'], s: [0, 1, 'south'], arrowleft: [-1, 0, 'west'], a: [-1, 0, 'west'], arrowright: [1, 0, 'east'], d: [1, 0, 'east'] };
  const VEHICLE_SIZE = { 'car-red': [72, 44], 'car-blue': [76, 44], 'car-taxi': [76, 46], 'car-green': [64, 42], 'van-white': [84, 52], 'city-bus': [140, 64] };
  const LINES = {
    es: ['¡Hola! 👋', '¿Café? ☕', '¿Daily en 5?', 'Mira este diseño 👀', '¡Deploy listo! 🚀', 'jajaja 😂', '¿Almorzamos?', 'Te paso el link', '¡Buen finde!'],
    en: ['Hi! 👋', 'Coffee? ☕', 'Daily in 5?', 'Check this design 👀', 'Deploy done! 🚀', 'lol 😂', 'Lunch?', "I'll send you the link", 'Have a good weekend!'],
  };
  const PEOPLE = [
    { name: 'Ana', sheet: 'f-teal', color: '#3a9fd6' }, { name: 'Leo', sheet: 'm-lime', color: '#3f9a4b' },
    { name: 'Mar', sheet: 'f-pink', color: '#e5603f' }, { name: 'Sofi', sheet: 'f-sun', color: '#f0ac22' },
    { name: 'Teo', sheet: 'm-violet', color: '#5a4fcf' },
  ];

  const load = src => new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = src; });
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = list => list[Math.floor(Math.random() * list.length)];

  Promise.all([fetch('assets/world/studio.json').then(r => r.json()), load('assets/world/studio.webp')]).then(async ([world, map]) => {
    const sheets = {};
    await Promise.all(['m-coral', ...PEOPLE.map(p => p.sheet)].map(async name => { sheets[name] = await load(`assets/avatars/${name}.png`); }));
    const vehicleImages = {};
    await Promise.all(Object.keys(VEHICLE_SIZE).map(async kind => { vehicleImages[kind] = await load(`assets/world/vehicles/${kind}.png`); }));

    const W = world.cols * T, H = world.rows * T;
    const blocked = new Set(world.blocked);
    const edges = new Set(world.edges.flatMap(e => { const [a, b] = e.split(':'); return [`${a}:${b}`, `${b}:${a}`]; }));
    const key = (x, y) => `${x}/${y}`;
    const inside = (x, y) => x >= 0 && y >= 0 && x < world.cols && y < world.rows;
    const lanes = world.traffic.map(lane => ({ ...lane, top: (lane.row - 1) * T, bottom: (lane.row + 1) * T }));
    const vehicles = [];
    const MARGIN = 300, DIST = W + MARGIN * 2;
    lanes.forEach((lane, li) => lane.vehicles.forEach((kind, i) => {
      const [w, h] = VEHICLE_SIZE[kind] ?? [72, 44];
      const travelled = (i * DIST / lane.vehicles.length + li * 260) % DIST;
      vehicles.push({ kind, lane: li, dir: lane.direction, cruise: lane.speed, speed: lane.speed, w, h, x: lane.direction > 0 ? -MARGIN + travelled : W + MARGIN - travelled, y: (lane.row + 1) * T - h - 9 });
    }));
    const vehicleOn = (tx, ty) => vehicles.some(v => { const lane = lanes[v.lane]; return v.x + v.w / 2 > tx * T + 2 && v.x - v.w / 2 < tx * T + T - 2 && lane.bottom > ty * T && lane.top < ty * T + T; });
    const canStep = (fx, fy, tx, ty) => inside(tx, ty) && !blocked.has(key(tx, ty)) && !edges.has(`${key(fx, fy)}:${key(tx, ty)}`) && !vehicleOn(tx, ty);
    const staticStep = (fx, fy, tx, ty) => inside(tx, ty) && !blocked.has(key(tx, ty)) && !edges.has(`${key(fx, fy)}:${key(tx, ty)}`);

    // Every tile reachable from the lobby: where people may wander.
    const reachable = [];
    { const seen = new Set([key(world.spawn.tx, world.spawn.ty)]), queue = [[world.spawn.tx, world.spawn.ty]];
      while (queue.length) { const [x, y] = queue.shift(); reachable.push([x, y]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!seen.has(key(nx, ny)) && staticStep(x, y, nx, ny)) { seen.add(key(nx, ny)); queue.push([nx, ny]); } } } }
    const offRoad = reachable.filter(([, y]) => !lanes.some(l => y * T >= l.top && y * T < l.bottom));
    const path = (from, to) => {
      const start = key(from[0], from[1]), goal = key(to[0], to[1]); if (start === goal) return [];
      const prev = new Map([[start, null]]), queue = [from];
      while (queue.length) {
        const [x, y] = queue.shift();
        if (key(x, y) === goal) break;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = key(nx, ny); if (!prev.has(k) && staticStep(x, y, nx, ny)) { prev.set(k, [x, y]); queue.push([nx, ny]); } }
      }
      if (!prev.has(goal)) return [];
      const out = []; let at = to;
      while (at && key(at[0], at[1]) !== start) { out.unshift(at); at = prev.get(key(at[0], at[1])); }
      return out;
    };

    const makeAvatar = (spec, tx, ty) => ({ ...spec, tx, ty, px: tx * T + T / 2, py: ty * T + T / 2, from: null, to: null, start: 0, facing: 'south', route: [], wait: rand(500, 2500), line: '', lineUntil: 0 });
    const spawn = world.spawn;
    const me = makeAvatar({ name: YOU[lang()], sheet: 'm-coral', color: '#ff7a59', me: true }, spawn.tx, spawn.ty);
    const npcStarts = [[6, 18], [17, 24], [24, 12], [26, 35], [8, 47]];
    const npcs = PEOPLE.map((p, i) => makeAvatar(p, ...npcStarts[i]));
    const everyone = [me, ...npcs];

    let active = false, demo = true, held = [], last = performance.now(), visible = true, camX = me.px, camY = me.py;
    let scale = 1.5, cssW = 0, cssH = 0;
    const resize = () => {
      const rect = root.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      cssW = rect.width; cssH = rect.height;
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
      scale = Math.max(1, Math.min(2, cssW / 420)) * dpr;
      ctx.imageSmoothingEnabled = false;
    };
    new ResizeObserver(resize).observe(root); resize();
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(root);

    const startStep = (a, nx, ny, time) => {
      a.facing = nx > a.tx ? 'east' : nx < a.tx ? 'west' : ny > a.ty ? 'south' : 'north';
      a.from = [a.px, a.py]; a.to = [nx * T + T / 2, ny * T + T / 2]; a.start = time; a.tx = nx; a.ty = ny;
    };
    const near = (a, b) => Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty)) <= 2;
    const occupied = (a, x, y) => everyone.some(o => o !== a && o.tx === x && o.ty === y);

    const think = (a, time, dt) => {
      if (a.to) return;
      if (a.me && !demo) {
        const k = held[held.length - 1];
        if (k) { const [dx, dy, facing] = KEYS[k]; a.facing = facing; if (canStep(a.tx, a.ty, a.tx + dx, a.ty + dy) && !occupied(a, a.tx + dx, a.ty + dy)) startStep(a, a.tx + dx, a.ty + dy, time); a.route = []; return; }
      }
      if (!a.me && near(a, me)) { // stop and face whoever came to talk
        const dx = me.tx - a.tx, dy = me.ty - a.ty;
        a.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
        if (time > a.lineUntil) { a.line = pick(LINES[lang()]); a.lineUntil = time + rand(2600, 4200); }
        return;
      }
      if (a.route.length) {
        const [nx, ny] = a.route[0];
        if (vehicleOn(nx, ny) || occupied(a, nx, ny)) return; // wait for the car (or the person) to move
        if (canStep(a.tx, a.ty, nx, ny)) { a.route.shift(); startStep(a, nx, ny, time); } else a.route = [];
        return;
      }
      a.wait -= dt;
      if (a.wait > 0) return;
      a.wait = a.me ? rand(600, 1400) : rand(1500, 5000);
      if (a.me && demo) { const target = pick(npcs); a.route = path([a.tx, a.ty], [target.tx, target.ty + 1]).slice(0, -1); if (!a.route.length) a.route = path([a.tx, a.ty], pick(offRoad)).slice(0, 14); return; }
      const nearby = offRoad.filter(([x, y]) => Math.abs(x - a.tx) + Math.abs(y - a.ty) < 12);
      a.route = path([a.tx, a.ty], pick(nearby.length ? nearby : offRoad));
    };

    const moveAvatar = (a, time) => {
      if (!a.to) return;
      const t = Math.min(1, (time - a.start) / STEP_MS);
      a.px = a.from[0] + (a.to[0] - a.from[0]) * t; a.py = a.from[1] + (a.to[1] - a.from[1]) * t;
      if (t >= 1) { a.to = null; a.px = a.tx * T + T / 2; a.py = a.ty * T + T / 2; }
    };

    const stepTraffic = dt => {
      const s = Math.min(dt / 1000, .1);
      for (const v of vehicles) {
        const lane = lanes[v.lane]; let gap = Infinity;
        for (const a of everyone) for (const [x, y] of [[a.px, a.py], [a.tx * T + T / 2, a.ty * T + T / 2]]) {
          if (y < lane.top || y >= lane.bottom) continue;
          const d = (x - v.x) * v.dir - v.w / 2 - T / 2; if (d > -v.w) gap = Math.min(gap, Math.max(0, d));
        }
        for (const o of vehicles) { if (o === v || o.lane !== v.lane) continue; const d = (o.x - v.x) * v.dir - v.w / 2 - o.w / 2; if (d >= -4) gap = Math.min(gap, Math.max(0, d)); }
        const wanted = v.cruise * Math.min(1, Math.max(0, (gap - 10) / 150));
        v.speed += (wanted - v.speed) * Math.min(1, s * (wanted < v.speed ? 8 : 1.5));
        v.x += Math.min(v.speed * s, Math.max(0, gap - 10)) * v.dir;
        if (v.dir > 0 ? v.x > W + MARGIN : v.x < -MARGIN) { const start = v.dir > 0 ? -MARGIN : W + MARGIN; if (!vehicles.some(o => o !== v && o.lane === v.lane && Math.abs(o.x - start) < (o.w + v.w) / 2 + 40)) v.x = start; }
      }
    };

    // Video tiles for whoever is close, like the bar at the top of the real app.
    let stripKey = '';
    const updateStrip = () => {
      const talking = npcs.filter(n => near(n, me));
      const k = talking.map(n => n.name).join();
      if (k === stripKey) return; stripKey = k;
      strip.innerHTML = (talking.length ? [me, ...talking] : []).map(a => `<div class="vtile" style="--c:${a.color}55"><div class="face" style="background-image:url(assets/avatars/${a.sheet}.png)"></div><span class="tag"><span class="bars"><i></i><i></i><i></i></span>${a.me ? YOU[lang()] : a.name}</span></div>`).join('');
    };
    let roomName = '';
    const updateRoom = () => {
      const room = world.rooms.find(r => r.type === 'MeetingRoom' && me.tx >= r.x && me.tx < r.x + r.w && me.ty >= r.y && me.ty < r.y + r.h);
      const name = room ? room.name : '';
      if (name === roomName) return; roomName = name;
      roomToast.textContent = room ? { en: `You're in ${room.name} · the doors close 🔒`, es: `Entraste a ${room.name} · se cierran las puertas 🔒` }[lang()] : '';
      roomToast.classList.toggle('show', !!room);
    };

    const pill = (text, x, y, bg, fg) => {
      ctx.font = `700 ${11 * scale / 1.5}px "Bricolage Grotesque", system-ui, sans-serif`;
      const w = ctx.measureText(text).width + 14 * scale / 1.5, h = 17 * scale / 1.5;
      ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h, w, h, 6 * scale / 1.5); ctx.fill();
      ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - h / 2 + .5);
    };
    const bubble = (text, x, y) => {
      ctx.font = `700 ${13 * scale / 1.5}px "Bricolage Grotesque", system-ui, sans-serif`;
      const k = scale / 1.5, w = ctx.measureText(text).width + 18 * k, h = 24 * k;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h - 6 * k, w, h, 10 * k); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 6 * k, y - 6.5 * k); ctx.lineTo(x, y); ctx.lineTo(x + 6 * k, y - 6.5 * k); ctx.fill();
      ctx.fillStyle = '#16131f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - h / 2 - 6 * k);
    };

    const draw = time => {
      const vw = canvas.width / scale, vh = canvas.height / scale;
      const tx = Math.max(vw / 2, Math.min(W - vw / 2, me.px)), ty = Math.max(vh / 2, Math.min(H - vh / 2, me.py - 20));
      camX += (tx - camX) * .12; camY += (ty - camY) * .12;
      const ox = Math.round((vw / 2 - camX) * scale) / scale, oy = Math.round((vh / 2 - camY) * scale) / scale;
      ctx.setTransform(scale, 0, 0, scale, ox * scale, oy * scale);
      ctx.fillStyle = '#3d7a3a'; ctx.fillRect(-W, -H, W * 3, H * 3);
      if (map) ctx.drawImage(map, 0, 0);
      // proximity ring around you when someone is close
      if (npcs.some(n => near(n, me))) { ctx.strokeStyle = '#ffd23f'; ctx.globalAlpha = .55 + .25 * Math.sin(time / 300); ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(me.px, me.py + 8, 2.5 * T, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
      for (const v of vehicles) { const img = vehicleImages[v.kind]; if (!img) continue; ctx.save(); ctx.translate(Math.round(v.x), v.y); if (v.dir < 0) ctx.scale(-1, 1); ctx.drawImage(img, -v.w / 2, 0, v.w, v.h); ctx.restore(); }
      const sorted = [...everyone].sort((a, b) => a.py - b.py);
      for (const a of sorted) {
        const sheet = sheets[a.sheet]; if (!sheet) continue;
        const walking = !!a.to || (a.me && held.length && !demo);
        const col = walking ? 1 + Math.floor(time / FRAME_MS) % 6 : 0;
        ctx.fillStyle = '#0000002e'; ctx.beginPath(); ctx.ellipse(a.px, a.py + 10, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.drawImage(sheet, col * CELL, DIRS[a.facing] * CELL, CELL, CELL, Math.round(a.px - CELL / 2), Math.round(a.py + 10 - FOOT_Y), CELL, CELL);
      }
      for (const a of sorted) {
        pill(a.me ? YOU[lang()] : a.name, a.px, a.py - 44, a.me ? '#5a4fcf' : '#16131fdd', '#fff');
        if (!a.me && near(a, me) && a.line && time < a.lineUntil) bubble(a.line, a.px, a.py - 66);
      }
    };

    const tick = time => {
      const dt = Math.min(time - last, 100); last = time;
      if (visible) {
        if (!reduced) stepTraffic(dt);
        for (const a of everyone) { moveAvatar(a, time); think(a, time, dt); moveAvatar(a, time); }
        updateStrip(); updateRoom(); draw(time);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // Controls: the game only takes the keyboard once you click into it.
    const activate = () => { if (!active) { active = true; demo = false; me.route = []; root.classList.add('active'); root.closest('.window')?.classList.add('playing'); root.focus({ preventScroll: true }); } };
    const deactivate = () => { active = false; held = []; root.classList.remove('active'); root.closest('.window')?.classList.remove('playing'); };
    root.querySelector('.game-exit').addEventListener('click', e => { e.stopPropagation(); deactivate(); root.blur(); });
    root.addEventListener('pointerdown', e => {
      if (e.target.closest('.game-exit')) return;
      const wasActive = active; activate();
      if (!wasActive && e.pointerType === 'mouse') return; // the first click only starts the game
      const rect = canvas.getBoundingClientRect(), dpr = canvas.width / rect.width;
      const vw = canvas.width / scale, vh = canvas.height / scale;
      const wx = (e.clientX - rect.left) * dpr / scale - (vw / 2 - camX), wy = (e.clientY - rect.top) * dpr / scale - (vh / 2 - camY);
      const goal = [Math.floor(wx / T), Math.floor(wy / T)];
      if (reachable.some(([x, y]) => x === goal[0] && y === goal[1])) me.route = path([me.tx, me.ty], goal);
    });
    root.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (k === 'escape') { deactivate(); root.blur(); return; }
      if (!KEYS[k]) return;
      if (!active) activate();
      e.preventDefault(); if (!held.includes(k)) held.push(k); me.route = [];
    });
    root.addEventListener('keyup', e => { const k = e.key.toLowerCase(); held = held.filter(h => h !== k); });
    root.addEventListener('blur', () => { held = []; });
    document.addEventListener('pointerdown', e => { if (active && !root.contains(e.target)) deactivate(); });
  });
})();
