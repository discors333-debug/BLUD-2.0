// Game state, rules, input, menus and the main loop.
(function (SS) {
  "use strict";

  const { clamp, lerp, rand, groundY } = SS;
  const $ = id => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");

  // ---------- view / resize ----------
  const view = { w: SS.BASE_W, h: SS.BASE_H, scale: 1, dpr: 1 };
  function resize() {
    view.dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = Math.round(W * view.dpr);
    canvas.height = Math.round(H * view.dpr);
    view.scale = Math.min(H / SS.BASE_H, W / SS.BASE_W);
    view.w = W / view.scale; view.h = H / view.scale;
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- saved settings & best scores ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("sandstrider:" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("sandstrider:" + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  const settings = {
    difficulty: store.get("difficulty", "normal"),
    sound: store.get("sound", true),
    tips: store.get("tips", true)
  };
  if (!SS.DIFFICULTIES[settings.difficulty]) settings.difficulty = "normal";
  const best = store.get("best", { easy: 0, normal: 0, hard: 0 });
  SS.audio.setEnabled(settings.sound);

  // ---------- input ----------
  const keys = {}, pressed = {};
  const GAME_KEYS = ["arrowleft", "arrowright", "arrowdown", "arrowup", " "];
  window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (GAME_KEYS.includes(k) && g.mode === "play") e.preventDefault();
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
    onKeyCommand(k, e);
  });
  window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener("blur", () => {
    for (const k in keys) keys[k] = false;
    if (g.mode === "play") pause();
  });
  function consume(...ks) {
    let hit = false;
    for (const k of ks) if (pressed[k]) { hit = true; pressed[k] = false; }
    return hit;
  }
  function clearInput() { for (const k in pressed) pressed[k] = false; }

  function onKeyCommand(k, e) {
    if (k === "m") toggleSound();
    if (g.mode === "play" && (k === "escape" || k === "p")) { pause(); return; }
    if (g.mode === "pause" && (k === "escape" || k === "p")) { resume(); return; }
    if (g.mode === "traits" && ["1", "2", "3"].includes(k)) {
      const i = Number(k) - 1;
      if (g.traitChoices && g.traitChoices[i]) chooseTrait(g.traitChoices[i].id);
      e.preventDefault();
    }
  }

  // ---------- touch controls ----------
  const touch = $("touch");
  const isTouch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  touch.querySelectorAll("button[data-key]").forEach(btn => {
    const k = btn.dataset.key;
    const down = ev => { ev.preventDefault(); if (!keys[k]) pressed[k] = true; keys[k] = true; btn.classList.add("on"); SS.audio.init(); };
    const up = ev => { ev.preventDefault(); keys[k] = false; btn.classList.remove("on"); };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  });

  // ---------- state ----------
  let g;

  function makeState(diff, mode) {
    return {
      mode, diff,
      time: 0.21, day: 1, weather: SS.WEATHER[0],
      world: SS.createWorld(diff),
      player: { x: 700, facing: 1, walk: 0, moving: false, inBurrow: false, sprint: false, vx: 0 },
      stats: { heat: 37, water: diff.startWater, fat: diff.startFat, health: 100 },
      traits: {},
      storms: [], storm: { active: false, timer: 0, dur: 14 }, streaks: [],
      hawk: { state: "none", x: 0, y: 0, timer: 0 },
      particles: [], floaters: [],
      tip: { queue: [], timer: 0, seen: {} },
      banner: { title: "Day 1", sub: "Clear skies · Survive the desert", timer: 3.5 },
      hurt: 0, shake: 0, camX: 0, air: 25, inShade: false, sleeping: false,
      dangerPulse: false, hint: "", cause: "", beatTimer: 0, dustTimer: 0,
      rec: { dew: 0, food: 0, dist: 0, dodged: 0, hits: 0 },
      traitChoices: null
    };
  }

  function planStorms() {
    g.storms = [];
    if (g.weather.storms >= 2) {
      g.storms.push({ start: rand(0.3, 0.45), done: false }, { start: rand(0.6, 0.75), done: false });
    } else {
      g.storms.push({ start: rand(0.32, 0.74), done: false });
    }
  }

  const lv = id => g.traits[id] || 0;

  function tip(id, title, msg) {
    if (!settings.tips || g.tip.seen[id]) return;
    g.tip.seen[id] = true;
    g.tip.queue.push({ title, text: msg });
  }
  function floater(x, y, str, color) { g.floaters.push({ x, y, text: str, color: color || "#fff", life: 1.4 }); }
  function burst(x, y, color, n, spread) {
    for (let i = 0; i < n; i++) {
      g.particles.push({ x, y, vx: rand(-1, 1) * (spread || 60), vy: rand(-140, -40), r: rand(1.5, 3.5), color, life: rand(0.4, 0.8), max: 0.8, grav: 300 });
    }
  }

  // ---------- day transitions ----------
  function newDay() {
    g.day++;
    g.weather = SS.pickWeather();
    planStorms();
    SS.placeDew(g.world, g.diff);
    g.world.cacti.forEach(c => { c.fruit = Math.random() < 0.75; });
    g.world.oasis.level = g.world.oasis.max;
    if (g.world.food.length < g.diff.food) SS.spawnFood(g.world, g.diff.food - g.world.food.length);
    offerTraits();
  }

  function offerTraits() {
    const pool = SS.TRAITS.filter(t => lv(t.id) < t.max);
    if (!pool.length) { showDayBanner(); return; }
    const choices = [];
    while (choices.length < 3 && pool.length) choices.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    g.traitChoices = choices;
    g.mode = "traits";
    $("traitDay").textContent = g.day;
    const wrap = $("traitCards");
    wrap.innerHTML = "";
    choices.forEach((t, i) => {
      const b = document.createElement("button");
      b.className = "trait-card";
      const level = lv(t.id);
      b.innerHTML = `<span class="key">${i + 1}</span><strong>${t.name}</strong>` +
        `<span class="lvl">${level ? "Level " + (level + 1) + " of " + t.max : "New"}</span><span>${t.desc}</span>`;
      b.addEventListener("click", () => chooseTrait(t.id));
      wrap.appendChild(b);
    });
    showScreen("traitScreen");
    SS.audio.setWind(false);
  }

  function chooseTrait(id) {
    if (g.mode !== "traits") return;
    g.traits[id] = lv(id) + 1;
    g.traitChoices = null;
    SS.audio.sfx.evolve();
    hideScreens();
    g.mode = "play";
    clearInput();
    showDayBanner();
  }

  function showDayBanner() {
    g.banner = { title: "Day " + g.day, sub: g.weather.name + " · " + g.weather.desc, timer: 3.5 };
    SS.audio.sfx.day();
  }

  // ---------- main update ----------
  function update(dt) {
    const d = g.diff, p = g.player, s = g.stats, w = g.world;

    // time of day
    const prevT = g.time;
    g.time += dt / SS.DAY_LEN;
    if (g.time >= 1) g.time -= 1;
    if (prevT < 0.2 && g.time >= 0.2) { newDay(); if (g.mode !== "play") return; }
    if (prevT < 0.38 && g.time >= 0.38 && w.rocks.some(r => r.dew)) {
      w.rocks.forEach(r => { r.dew = false; });
    }

    // sandstorms
    for (const st of g.storms) {
      if (!st.done && g.time >= st.start && g.time < st.start + 0.05) {
        st.done = true;
        g.storm.active = true; g.storm.timer = g.storm.dur;
        SS.audio.setWind(true);
        if (g.hawk.state === "circling") leaveHawk();
      }
    }
    if (g.storm.active) {
      g.storm.timer -= dt;
      if (!p.inBurrow) tip("storm", "ADAPTATION · SEALING NOSTRILS", "Sandstorm! Your nostrils seal shut so the sand can't hurt you, but walking is slower.");
      if (g.storm.timer <= 0) { g.storm.active = false; SS.audio.setWind(false); }
      while (g.streaks.length < 90) g.streaks.push({ x: rand(0, view.w), y: rand(0, view.h), l: rand(20, 70), v: rand(500, 900) });
      for (const st of g.streaks) {
        st.x += st.v * dt; st.y += st.v * 0.12 * dt;
        if (st.x - st.l > view.w) { st.x = rand(-80, 0); st.y = rand(0, view.h); }
      }
    } else g.streaks.length = 0;

    // ----- player input -----
    const left = keys.arrowleft || keys.a, right = keys.arrowright || keys.d;
    p.sprint = !!keys.shift && !p.inBurrow;
    p.moving = false;
    g.sleeping = false;
    const nearBurrow = w.burrows.find(b => Math.abs(b - p.x) < 45);

    if (consume("arrowdown", "s")) {
      if (p.inBurrow) exitBurrow();
      else if (nearBurrow !== undefined) {
        p.inBurrow = true; p.x = nearBurrow; p.vx = 0;
        SS.audio.sfx.burrow();
        tip("burrow", "SHELTER", "Burrows stay a mild 25°C. Hold Space inside to sleep and speed up time.");
      }
    }
    if (consume("arrowup", "w") && p.inBurrow) exitBurrow();

    if (p.inBurrow) {
      if (keys[" "]) g.sleeping = true;
      consume(" ");
    } else {
      let speed = 170 * (1 + 0.12 * lv("legs")) * (p.sprint ? 1.6 : 1);
      if (g.storm.active) speed *= Math.min(0.85, 0.45 + 0.2 * lv("snout"));
      if (left !== right) {
        p.facing = left ? -1 : 1;
        const nx = clamp(p.x + p.facing * speed * dt, 40, SS.WORLD_W - 40);
        g.rec.dist += Math.abs(nx - p.x);
        p.x = nx;
        p.moving = true;
        p.walk += dt * speed / 15;
        g.dustTimer -= dt;
        if (g.dustTimer <= 0) {
          g.dustTimer = p.sprint ? 0.04 : 0.09;
          g.particles.push({ x: p.x - p.facing * 10, y: groundY(p.x) - 2, vx: -p.facing * rand(20, 60), vy: rand(-40, -10), r: rand(2, 4), color: "rgba(220,190,130,0.8)", life: 0.5, max: 0.5, grav: 0 });
        }
      }
      if (Math.abs(p.vx) > 1) { p.x = clamp(p.x + p.vx * dt, 40, SS.WORLD_W - 40); p.vx *= Math.pow(0.02, dt); }
      if (consume(" ")) doAction();
      // hold Space at the oasis to keep drinking
      const o = w.oasis;
      if (keys[" "] && Math.abs(o.x - p.x) < 80 && o.level > 0 && s.water < 100) {
        const amt = Math.min(18 * dt, o.level, 100 - s.water);
        s.water += amt; o.level -= amt;
        if (Math.random() < dt * 8) burst(o.x + rand(-30, 30), groundY(o.x), "#7cc8ff", 1, 30);
        tip("oasis", "OASIS", "Hold Space to drink. The oasis shrinks as you drink and refills each dawn.");
      }
    }

    // ----- food creatures -----
    for (const f of w.food) {
      if (f.type === "seed") continue;
      f.phase += dt;
      const dx = f.x - p.x;
      if (!p.inBurrow && Math.abs(dx) < 120) { f.dir = dx >= 0 ? 1 : -1; f.x += f.dir * (f.type === "scarab" ? 75 : 40) * dt; }
      else {
        f.x += f.dir * 12 * dt;
        if (Math.random() < dt * 0.3) f.dir *= -1;
      }
      if (f.x < 40 || f.x > SS.WORLD_W - 40) { f.dir *= -1; f.x = clamp(f.x, 40, SS.WORLD_W - 40); }
    }

    // ----- body heat -----
    let air = SS.airTemp(g.time, g.weather);
    g.inShade = !p.inBurrow && w.trees.some(t => Math.abs(t.x - p.x) < 60);
    if (p.inBurrow) air = 25;
    else if (g.inShade) air -= 12 * SS.sunHeight(g.time);
    g.air = air;
    if (g.inShade && air > 28) tip("shade", "SHADE", "Acacia shade is 12°C cooler at midday. A good place to wait out the heat.");

    const target = 37 + (air - 25) * 0.6; // metabolism buffers you from the air
    let k = 0.03 * d.heatRate;
    if (s.heat > target) {
      if (!p.inBurrow && SS.lightLevel(g.time) < 0.6) {
        k *= 1.35 * (1 + 0.25 * lv("ears")); // radiator ears
        if (s.heat > 37.5) tip("ears", "ADAPTATION · RADIATOR EARS", "Blood vessels in your tall ears dump heat fast as the air cools. Don't get too cold!");
      }
      if (target < SS.HEAT_LO) k *= 1 - 0.18 * lv("fur");
    } else if (!p.inBurrow && SS.sunHeight(g.time) > 0.3) {
      k *= 1 - 0.08 * lv("ears");
    }
    s.heat += (target - s.heat) * k * dt;
    if (p.moving && air > 28) s.heat += (p.sprint ? 0.9 : 0.45) * dt * d.heatRate;
    if (p.inBurrow && s.heat > 37) s.heat -= 0.3 * dt; // shade + rest cools you down
    s.heat = clamp(s.heat, 28, 46);

    // ----- water and fat -----
    let waterDrain = 0.55;
    if (p.moving && air > 28) waterDrain += 1.1;
    if (p.moving && p.sprint) waterDrain += 0.8;
    if (g.sleeping) waterDrain *= 0.6;
    s.water -= waterDrain * d.drain * (1 - 0.15 * lv("kidneys")) * dt;
    s.fat -= (0.22 + (p.moving && p.sprint ? 0.25 : 0)) * d.drain * (1 - 0.15 * lv("hump")) * dt;
    if (s.water < 30 && s.fat > 1) {
      const c = 1.6 * dt;
      s.fat -= c; s.water += c * 0.8 * (1 + 0.25 * lv("hump"));
      tip("fat", "ADAPTATION · FAT HUMP", "Your hump is turning stored fat into water to keep you going!");
    }
    s.water = clamp(s.water, 0, 100); s.fat = clamp(s.fat, 0, 100);

    // ----- health -----
    let dmg = 0, cause = "", worst = 0;
    const hurt = (amt, why) => { dmg += amt; if (amt > worst) { worst = amt; cause = why; } };
    if (s.heat > SS.HEAT_HI) hurt(7 + (s.heat - SS.HEAT_HI) * 3, "Overheated");
    if (s.heat < SS.HEAT_LO) hurt(7 + (SS.HEAT_LO - s.heat) * 3, "Froze");
    if (s.water < 12) hurt(6, "Dehydrated");
    if (s.fat < 5) hurt(5, "Starved");
    const dmgMult = d.damage * (1 - 0.15 * lv("hide"));
    if (dmg > 0) { s.health -= dmg * dmgMult * dt; g.cause = cause; }
    else s.health = Math.min(100, s.health + (g.sleeping ? 6 : 3) * dt);
    g.dangerPulse = dmg > 0;

    if (s.health < 30) {
      g.beatTimer -= dt;
      if (g.beatTimer <= 0) { g.beatTimer = 1; SS.audio.sfx.beat(); }
    }

    updateHawk(dt, dmgMult);

    // ----- effects -----
    if (g.hurt > 0) g.hurt = Math.max(0, g.hurt - dt);
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 2);
    if (g.tip.timer > 0) { g.tip.timer -= dt; if (g.tip.timer <= 0) g.tip.queue.shift(); }
    else if (g.tip.queue.length) g.tip.timer = 4.5;

    if (s.health <= 0) { s.health = 0; gameOver(); }
  }

  function exitBurrow() {
    g.player.inBurrow = false;
    SS.audio.sfx.burrow();
  }

  function doAction() {
    const p = g.player, s = g.stats, w = g.world;
    const rock = w.rocks.find(r => r.dew && Math.abs(r.x - p.x) < 60);
    if (rock) {
      rock.dew = false;
      const gain = 40 + 15 * lv("spikes");
      s.water = Math.min(100, s.water + gain);
      g.rec.dew++;
      floater(rock.x, groundY(rock.x) - 50, "+" + gain + " water", "#9fe0ff");
      burst(rock.x, groundY(rock.x) - rock.h, "#9fe0ff", 10);
      SS.audio.sfx.dew();
      tip("dew", "ADAPTATION · DEW SPIKES", "Your spikes channel dew down to your mouth! Dew only forms at dawn, so get there early.");
      return;
    }
    const cactus = w.cacti.find(c => c.fruit && Math.abs(c.x - p.x) < 45);
    const mult = 1 + 0.2 * lv("nose");
    if (cactus) {
      cactus.fruit = false;
      s.water = Math.min(100, s.water + 15 * mult);
      s.fat = Math.min(100, s.fat + 5 * mult);
      g.rec.food++;
      floater(cactus.x, groundY(cactus.x) - cactus.h - 20, "+water +fat", "#ff9fc0");
      burst(cactus.x, groundY(cactus.x) - cactus.h, "#E04A7A", 8);
      SS.audio.sfx.eat();
      tip("cactus", "CACTUS FRUIT", "Cactus fruit is juicy: good for both water and fat. It regrows overnight.");
      return;
    }
    let bestI = -1, bestD = 50;
    w.food.forEach((f, i) => { const dd = Math.abs(f.x - p.x); if (dd < bestD) { bestD = dd; bestI = i; } });
    if (bestI >= 0) {
      const f = w.food.splice(bestI, 1)[0];
      let label;
      if (f.type === "scarab") { s.fat = Math.min(100, s.fat + 30 * mult); s.health = Math.min(100, s.health + 15); label = "Golden scarab! +fat +health"; }
      else if (f.type === "beetle") { s.fat = Math.min(100, s.fat + 16 * mult); s.water = Math.min(100, s.water + 4 * mult); label = "+" + Math.round(16 * mult) + " fat"; }
      else { s.fat = Math.min(100, s.fat + 10 * mult); label = "+" + Math.round(10 * mult) + " fat"; }
      g.rec.food++;
      floater(f.x, groundY(f.x) - 30, label, f.type === "scarab" ? "#ffd84a" : "#ffd59a");
      burst(f.x, groundY(f.x) - 4, "#a07040", 6);
      SS.audio.sfx.eat();
      tip("food", "FOOD", "Food is stored as fat in your hump. Watch it grow! Beetles run away, so chase them down.");
    }
  }

  // ----- hawk: warns, locks on, dives -----
  function leaveHawk() {
    const h = g.hawk;
    h.state = "leaving"; h.timer = 2; h.vx = (Math.random() < 0.5 ? -1 : 1) * 320;
  }
  function updateHawk(dt, dmgMult) {
    const h = g.hawk, p = g.player, d = g.diff;
    if (h.state === "none") {
      const canSpawn = g.day >= d.hawkFromDay && !g.storm.active && !p.inBurrow && SS.lightLevel(g.time) > 0.8;
      if (canSpawn && Math.random() < dt * 0.022 * d.hawk) {
        h.state = "circling"; h.timer = 3.2;
        h.x = g.camX + (Math.random() < 0.5 ? -60 : view.w + 60); h.y = 80;
        SS.audio.sfx.hawk();
        tip("hawk", "DANGER · HAWK", "A hawk is hunting you! When it dives, run out of the red ring or hide in a burrow.");
      }
    } else if (h.state === "circling") {
      h.timer -= dt;
      h.x += (p.x + Math.sin(h.timer * 3) * 90 - h.x) * Math.min(1, dt * 2.5);
      h.y = 85 + Math.cos(h.timer * 3) * 18;
      if (p.inBurrow || g.storm.active) leaveHawk();
      else if (h.timer <= 0) {
        h.state = "diving"; h.timer = 0.9; h.tx = p.x; h.sx = h.x; h.sy = h.y;
        SS.audio.sfx.dive();
      }
    } else if (h.state === "diving") {
      h.timer -= dt;
      const f = clamp(1 - h.timer / 0.9, 0, 1);
      h.x = lerp(h.sx, h.tx, f);
      h.y = lerp(h.sy, groundY(h.tx) - 60, f * f);
      if (h.timer <= 0) {
        if (!p.inBurrow && Math.abs(p.x - h.tx) < 55) {
          const dmg = 25 * dmgMult;
          g.stats.health -= dmg;
          g.cause = "Caught by a hawk";
          g.rec.hits++;
          g.hurt = 0.7; g.shake = 0.5;
          p.vx = (p.x >= h.tx ? 1 : -1) * 420;
          floater(p.x, groundY(p.x) - 140, "-" + Math.round(dmg) + " health", "#ff7b7b");
          burst(p.x, groundY(p.x) - 80, "#5c4030", 12, 120);
          SS.audio.sfx.hurt();
        } else {
          g.rec.dodged++;
          floater(h.tx, groundY(h.tx) - 40, "Dodged!", "#b8ff9a");
          SS.audio.sfx.dodge();
        }
        leaveHawk();
      }
    } else if (h.state === "leaving") {
      h.timer -= dt;
      h.x += h.vx * dt; h.y -= 220 * dt;
      if (h.timer <= 0) h.state = "none";
    }
  }

  function updateEffects(dt) {
    for (const pa of g.particles) { pa.x += pa.vx * dt; pa.y += pa.vy * dt; pa.vy += (pa.grav || 0) * dt; pa.life -= dt; }
    g.particles = g.particles.filter(pa => pa.life > 0);
    for (const fl of g.floaters) { fl.y -= 30 * dt; fl.life -= dt; }
    g.floaters = g.floaters.filter(fl => fl.life > 0);
    if (g.banner) g.banner.timer -= dt;
  }

  function updateHint() {
    const p = g.player, w = g.world;
    let hint = "";
    if (p.inBurrow) hint = "Hold Space to sleep · ↓/S to leave";
    else if (w.burrows.some(b => Math.abs(b - p.x) < 45)) hint = "↓ / S to enter burrow";
    else if (w.rocks.some(r => r.dew && Math.abs(r.x - p.x) < 60)) hint = "Space: drink dew";
    else if (w.cacti.some(c => c.fruit && Math.abs(c.x - p.x) < 45)) hint = "Space: eat cactus fruit";
    else if (w.food.some(f => Math.abs(f.x - p.x) < 50)) hint = "Space: eat";
    else if (Math.abs(w.oasis.x - p.x) < 80 && w.oasis.level > 0) hint = "Hold Space: drink";
    g.hint = hint;
  }

  function updateCamera(dt) {
    const target = SS.WORLD_W > view.w ? clamp(g.player.x - view.w / 2, 0, SS.WORLD_W - view.w) : (SS.WORLD_W - view.w) / 2;
    g.camX += (target - g.camX) * Math.min(1, dt * 6);
  }

  // ----- lobby background demo: the animal wanders while time races -----
  function updateDemo(dt) {
    const p = g.player;
    g.time = (g.time + dt / 40) % 1;
    g.air = SS.airTemp(g.time, g.weather);
    if (p.x > 1500) p.facing = -1;
    if (p.x < 500) p.facing = 1;
    p.x += p.facing * 80 * dt;
    p.moving = true;
    p.walk += dt * 6;
    for (const f of g.world.food) if (f.type !== "seed") { f.phase += dt; f.x += f.dir * 12 * dt; if (Math.random() < dt * 0.3) f.dir *= -1; }
  }

  // ---------- screens ----------
  const SCREENS = ["lobby", "traitScreen", "pauseScreen", "overScreen"];
  function showScreen(id) { SCREENS.forEach(s => $(s).classList.toggle("hidden", s !== id)); syncTouch(); }
  function hideScreens() { SCREENS.forEach(s => $(s).classList.add("hidden")); syncTouch(); }
  function syncTouch() {
    const playing = g && g.mode === "play";
    touch.classList.toggle("hidden", !(isTouch && playing));
    $("pauseBtn").classList.toggle("hidden", !playing);
  }

  function startGame() {
    SS.audio.init();
    SS.audio.sfx.click();
    const diff = SS.DIFFICULTIES[settings.difficulty];
    g = makeState(diff, "play");
    planStorms();
    g.storms.forEach(st => { st.start = Math.max(st.start, 0.45); }); // give day 1 a calm start
    g.camX = clamp(g.player.x - view.w / 2, 0, Math.max(0, SS.WORLD_W - view.w));
    clearInput();
    hideScreens();
    SS.audio.sfx.day();
  }

  function pause() {
    if (g.mode !== "play") return;
    g.mode = "pause";
    SS.audio.setWind(false);
    const list = SS.TRAITS.filter(t => lv(t.id)).map(t => `<li><strong>${t.name}</strong> ${"I".repeat(lv(t.id))} — ${t.desc}</li>`);
    $("pauseTraits").innerHTML = list.length ? list.join("") : "<li>No evolutions yet. Survive until dawn to evolve.</li>";
    showScreen("pauseScreen");
  }
  function resume() {
    if (g.mode !== "pause") return;
    g.mode = "play";
    if (g.storm.active) SS.audio.setWind(true);
    clearInput();
    hideScreens();
  }

  function toLobby() {
    SS.audio.setWind(false);
    g = makeState(SS.DIFFICULTIES.normal, "lobby");
    g.time = 0.3;
    refreshLobby();
    showScreen("lobby");
  }

  function gameOver() {
    g.mode = "over";
    SS.audio.setWind(false);
    SS.audio.sfx.over();
    const survived = g.day - 1;
    const id = g.diff.id;
    const isBest = survived > (best[id] || 0);
    if (isBest) { best[id] = survived; store.set("best", best); }
    $("causeText").textContent = g.cause || "Exhausted";
    $("daysText").textContent = `You survived ${survived} full day${survived === 1 ? "" : "s"} on ${g.diff.name}.`;
    $("bestText").textContent = isBest && survived > 0 ? "New best!" : `Best on ${g.diff.name}: ${best[id] || 0} day${best[id] === 1 ? "" : "s"}`;
    $("bestText").classList.toggle("new-best", isBest && survived > 0);
    const r = g.rec;
    const evolved = Object.values(g.traits).reduce((a, b) => a + b, 0);
    $("overStats").innerHTML = [
      ["Died on", "Day " + g.day], ["Distance", Math.round(r.dist / 50) + " m"],
      ["Dew drunk", r.dew], ["Meals", r.food],
      ["Hawks dodged", r.dodged], ["Evolutions", evolved]
    ].map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join("");
    $("overTip").textContent = deathAdvice(g.cause);
    showScreen("overScreen");
  }

  function deathAdvice(cause) {
    switch (cause) {
      case "Overheated": return "Tip: from mid-morning, wait in a burrow or under an acacia until the sun drops.";
      case "Froze": return "Tip: get into a burrow before dusk ends. Radiator ears cool you fast at night.";
      case "Dehydrated": return "Tip: be next to a rock at dawn for dew, and remember the oasis in the middle of the map.";
      case "Starved": return "Tip: eat beetles, seeds and cactus fruit whenever you pass them. A big hump makes water too.";
      case "Caught by a hawk": return "Tip: when the red ring appears, sprint (Shift) out of it or duck into a burrow.";
      default: return "";
    }
  }

  // ---------- lobby UI ----------
  function refreshLobby() {
    document.querySelectorAll(".diff-card").forEach(card => {
      const id = card.dataset.diff;
      card.classList.toggle("selected", id === settings.difficulty);
      card.setAttribute("aria-pressed", id === settings.difficulty ? "true" : "false");
      card.querySelector(".best").textContent = "Best: " + (best[id] || 0) + " day" + (best[id] === 1 ? "" : "s");
    });
    $("optSound").checked = settings.sound;
    $("optTips").checked = settings.tips;
  }

  function buildLobby() {
    const wrap = $("diffCards");
    Object.values(SS.DIFFICULTIES).forEach(d => {
      const b = document.createElement("button");
      b.className = "diff-card"; b.dataset.diff = d.id; b.type = "button";
      b.innerHTML = `<strong>${d.name}</strong><span>${d.blurb}</span><em class="best"></em>`;
      b.addEventListener("click", () => {
        settings.difficulty = d.id; store.set("difficulty", d.id);
        SS.audio.init(); SS.audio.sfx.click();
        refreshLobby();
      });
      wrap.appendChild(b);
    });
    $("traitList").innerHTML = SS.TRAITS.map(t => `<li><strong>${t.name}</strong> (up to ${t.max}×): ${t.desc}</li>`).join("");

    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => { t.classList.toggle("active", t === tab); t.setAttribute("aria-selected", t === tab); });
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("hidden", p.id !== tab.dataset.tab));
        SS.audio.init(); SS.audio.sfx.click();
      });
    });
    $("optSound").addEventListener("change", e => { settings.sound = e.target.checked; store.set("sound", settings.sound); SS.audio.setEnabled(settings.sound); });
    $("optTips").addEventListener("change", e => { settings.tips = e.target.checked; store.set("tips", settings.tips); });
    $("startBtn").addEventListener("click", startGame);
    $("againBtn").addEventListener("click", startGame);
    $("restartBtn").addEventListener("click", startGame);
    $("resumeBtn").addEventListener("click", resume);
    $("quitBtn").addEventListener("click", toLobby);
    $("overLobbyBtn").addEventListener("click", toLobby);
    $("pauseBtn").addEventListener("click", pause);
  }

  function toggleSound() {
    settings.sound = !settings.sound;
    store.set("sound", settings.sound);
    SS.audio.setEnabled(settings.sound);
    if (settings.sound && g.mode === "play" && g.storm.active) { SS.audio.init(); SS.audio.setWind(true); }
    $("optSound").checked = settings.sound;
  }

  // ---------- main loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (g.mode === "play") {
      const steps = g.sleeping ? 4 : 1; // sleeping fast-forwards time
      for (let i = 0; i < steps && g.mode === "play"; i++) update(dt);
      updateHint();
      updateCamera(dt);
      updateEffects(dt);
    } else if (g.mode === "lobby") {
      updateDemo(dt);
      updateCamera(dt);
      updateEffects(dt);
    }
    SS.renderScene(ctx, g, view, now);
    requestAnimationFrame(frame);
  }

  // read-only handle for debugging from the browser console
  SS.debug = { get state() { return g; } };

  buildLobby();
  toLobby();
  requestAnimationFrame(frame);
})(window.SS);
