// All canvas drawing: scenery, creatures, effects and the HUD.
(function (SS) {
  "use strict";

  const { clamp, lerp, groundY } = SS;
  const FONT = "Trebuchet MS, Verdana, sans-serif";
  let ctx;

  // ---------- helpers ----------
  function ellipse(x, y, rx, ry, color, rot) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // darken (and slightly blue-shift) a colour as night falls
  function shade(hex, light) {
    const n = parseInt(hex.slice(1), 16);
    const f = 0.45 + 0.55 * light;
    const b = Math.min(255, Math.round((n & 255) * f * (1 + (1 - light) * 0.25)));
    return `rgb(${Math.round((n >> 16) * f)},${Math.round(((n >> 8) & 255) * f)},${b})`;
  }
  function text(str, x, y, size, color, align, bold) {
    ctx.font = `${bold === false ? "" : "bold "}${size}px ${FONT}`;
    ctx.textAlign = align || "left"; ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function wrap(str, maxW) {
    const words = str.split(" "), lines = []; let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  // ---------- the sandstrider ----------
  function drawStrider(x, y, facing, walk, moving, sealed, fatFrac, hurt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing * 0.85, 0.85);
    // soft shadow
    ellipse(0, 2, 40, 6, "rgba(0,0,0,0.18)");
    const sw = moving ? Math.sin(walk) * 10 : 0;
    const bob = moving ? Math.abs(Math.sin(walk)) * 2 : 0;
    // legs + wide flat feet
    ctx.strokeStyle = "#C99A5A"; ctx.lineWidth = 4; ctx.lineCap = "round";
    [[-16, -sw, 0], [16, sw, Math.PI]].forEach(([lx, off, ph]) => {
      const fy = -4 - (moving ? Math.max(0, Math.sin(walk + ph)) * 5 : 0);
      ctx.beginPath(); ctx.moveTo(lx, -54 - bob); ctx.lineTo(lx + off, fy); ctx.stroke();
      ellipse(lx + off + 2, fy + 1, 11, 4, "#B88A50");
    });
    ctx.translate(0, -bob);
    const body = hurt ? "#F08A6A" : "#E3B877";
    ellipse(0, -64, 33, 20, body);
    // hump with 5 spikes; its size shows how much fat is stored
    const hx = -4, hy = -82, hrx = 11 + 9 * fatFrac, hry = 7 + 6 * fatFrac;
    ctx.fillStyle = "#B8864A";
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.15 + 0.7 * i / 4);
      const bx = hx + hrx * Math.cos(a), by = hy + hry * Math.sin(a);
      const nx = Math.cos(a), ny = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(bx - ny * 3.5, by + nx * 3.5);
      ctx.lineTo(bx + ny * 3.5, by - nx * 3.5);
      ctx.lineTo(bx + nx * 10, by + ny * 10);
      ctx.closePath(); ctx.fill();
    }
    ellipse(hx, hy, hrx, hry, hurt ? "#E07A5A" : "#D9A866");
    // neck
    ctx.strokeStyle = body; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(22, -70); ctx.lineTo(36, -98); ctx.stroke();
    // tall ears with pink insides
    ellipse(32, -126, 4.5, 17, body, -0.18); ellipse(32, -125, 2.2, 12, "#F4A7B9", -0.18);
    ellipse(43, -128, 4.5, 17, body, 0.12); ellipse(43, -127, 2.2, 12, "#F4A7B9", 0.12);
    // head + snout
    ellipse(40, -104, 13, 13, body);
    ellipse(51, -100, 6, 5, body);
    // big eye with 3 lashes
    ellipse(44, -107, 5.5, 5.5, "#fff");
    ellipse(46, -107, 3, 3, "#2b1a0a");
    ellipse(47, -108, 1, 1, "#fff");
    ctx.strokeStyle = "#2b1a0a"; ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI * (0.3 + 0.2 * i);
      ctx.beginPath();
      ctx.moveTo(44 + Math.cos(a) * 5.5, -107 + Math.sin(a) * 5.5);
      ctx.lineTo(44 + Math.cos(a) * 9, -107 + Math.sin(a) * 9);
      ctx.stroke();
    }
    // nostril: sealed shut in sandstorms
    if (sealed) {
      ctx.strokeStyle = "#6b3a0e"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(53, -102); ctx.lineTo(57, -101); ctx.stroke();
    } else ellipse(55, -101, 1.6, 1.6, "#6b3a0e");
    ctx.restore();
  }

  function drawPeeking(x, y, sleeping, t) {
    ctx.save(); ctx.translate(x, y + 6);
    const droop = sleeping ? 0.5 : 0;
    ellipse(-8, -14, 3.5, 13, "#C9A06A", -0.15 - droop); ellipse(-8, -13, 1.6, 9, "#F4A7B9", -0.15 - droop);
    ellipse(8, -14, 3.5, 13, "#C9A06A", 0.15 + droop); ellipse(8, -13, 1.6, 9, "#F4A7B9", 0.15 + droop);
    if (sleeping) {
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
      [-5, 5].forEach(ex => { ctx.beginPath(); ctx.arc(ex, -1, 2.5, 0.1, Math.PI - 0.1); ctx.stroke(); });
      const zp = (t * 1.5) % 1;
      ctx.globalAlpha = 1 - zp;
      text("z", 12 + zp * 10, -20 - zp * 30, 12 + zp * 8, "#fff", "left");
      ctx.globalAlpha = 1;
    } else {
      ellipse(-5, 0, 3, 3, "#fff"); ellipse(5, 0, 3, 3, "#fff");
      ellipse(-5, 0, 1.5, 1.5, "#000"); ellipse(5, 0, 1.5, 1.5, "#000");
    }
    ctx.restore();
  }

  // ---------- scenery ----------
  function drawTree(t, light) {
    const y = groundY(t.x);
    ellipse(t.x, y + 3, 62, 7, `rgba(40,20,0,${0.08 + 0.18 * light})`);
    ctx.strokeStyle = shade("#6b4a2b", light); ctx.lineWidth = 7; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(t.x, y); ctx.lineTo(t.x - 3, y - 70); ctx.lineTo(t.x - 28, y - 104);
    ctx.moveTo(t.x - 3, y - 70); ctx.lineTo(t.x + 24, y - 108);
    ctx.stroke();
    ellipse(t.x - 2, y - 112, 76, 15, shade("#5f7a32", light));
    ellipse(t.x - 14, y - 121, 46, 10, shade("#77963f", light));
    ellipse(t.x + 22, y - 118, 30, 8, shade("#6f8c3a", light));
  }

  function drawCactus(c, light, now) {
    const y = groundY(c.x), h = c.h;
    const green = shade("#4f8a4a", light);
    ctx.strokeStyle = green; ctx.lineCap = "round";
    ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(c.x, y); ctx.lineTo(c.x, y - h); ctx.stroke();
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(c.x - 6, y - h * 0.45); ctx.lineTo(c.x - 20, y - h * 0.45); ctx.lineTo(c.x - 20, y - h * 0.75);
    ctx.moveTo(c.x + 6, y - h * 0.6); ctx.lineTo(c.x + 18, y - h * 0.6); ctx.lineTo(c.x + 18, y - h * 0.85);
    ctx.stroke();
    ctx.strokeStyle = shade("#3c6e38", light); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(c.x, y - 4); ctx.lineTo(c.x, y - h + 4); ctx.stroke();
    if (c.fruit) {
      const p = 1 + 0.08 * Math.sin(now / 250 + c.x);
      ellipse(c.x - 4, y - h - 6, 5 * p, 6 * p, "#E04A7A");
      ellipse(c.x + 5, y - h - 4, 4.5 * p, 5.5 * p, "#D63C6E");
      ellipse(c.x - 20, y - h * 0.75 - 6, 4.5 * p, 5.5 * p, "#E04A7A");
    }
  }

  function drawOasis(o, light, now) {
    const y = groundY(o.x);
    const f = o.max ? o.level / o.max : 0;
    ellipse(o.x, y + 6, 78, 14, shade("#B8935A", light));
    if (f > 0.02) {
      const rx = 30 + 42 * f, ry = 5 + 7 * f;
      ellipse(o.x, y + 6, rx, ry, shade("#3E9BD1", light));
      ellipse(o.x - rx * 0.3, y + 4, rx * 0.4, ry * 0.35, `rgba(255,255,255,${0.25 + 0.15 * Math.sin(now / 400)})`);
    } else {
      ellipse(o.x, y + 6, 40, 6, shade("#8E7A55", light)); // cracked mud
    }
    ctx.strokeStyle = shade("#6f8c3a", light); ctx.lineWidth = 2.5; ctx.lineCap = "round";
    for (const dx of [-74, -66, -58, 60, 68, 76]) {
      const sway = Math.sin(now / 600 + dx) * 3;
      ctx.beginPath(); ctx.moveTo(o.x + dx, y + 6); ctx.lineTo(o.x + dx + sway, y - 22 - (Math.abs(dx) % 9)); ctx.stroke();
    }
  }

  function drawBeetle(f) {
    const y = groundY(f.x);
    ctx.save(); ctx.translate(f.x, y); ctx.scale(f.dir, 1);
    const scarab = f.type === "scarab";
    if (scarab) ellipse(0, -6, 13, 9, "rgba(255,220,80,0.25)");
    ctx.strokeStyle = "#1e1a12"; ctx.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) {
      const w = Math.sin(f.phase * 14 + i) * 2;
      ctx.beginPath(); ctx.moveTo(i * 4, -4); ctx.lineTo(i * 4 + w - 2, 0); ctx.stroke();
    }
    ellipse(0, -6, 7, 4.5, scarab ? "#E8B923" : "#2e3b2a");
    ctx.strokeStyle = scarab ? "#9c7a10" : "#1a2418"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(5, -6); ctx.stroke();
    ellipse(7, -6, 2.8, 2.6, scarab ? "#9c7a10" : "#1e1a12");
    ctx.restore();
  }
  function drawSeeds(f) {
    const y = groundY(f.x);
    ellipse(f.x - 5, y - 2, 3.5, 2, "#7a5428", 0.4);
    ellipse(f.x + 3, y - 2, 3.5, 2, "#8a6030", -0.3);
    ellipse(f.x, y - 4.5, 3.5, 2, "#6a4420", 0.1);
  }

  function drawHawk(h, now) {
    if (h.state === "none") return;
    // shadow on the ground grows as the hawk gets closer
    const gy = groundY(h.x);
    const closeness = clamp(1 - (gy - h.y) / 400, 0.15, 1);
    ellipse(h.x, gy + 2, 18 + 22 * closeness, 4 + 3 * closeness, `rgba(0,0,0,${0.15 + 0.3 * closeness})`);
    ctx.save(); ctx.translate(h.x, h.y);
    const diving = h.state === "diving";
    const flap = diving ? 0.2 : Math.sin(now / 90) * 0.6;
    ctx.fillStyle = "#4a3324";
    for (const side of [-1, 1]) {
      ctx.save(); ctx.scale(side, 1); ctx.rotate(-flap * (diving ? 0.3 : 1) + (diving ? 0.9 : 0));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(18, -14, 40, -4); ctx.quadraticCurveTo(22, 2, 0, 6); ctx.fill();
      ctx.restore();
    }
    ellipse(0, 2, 8, 12, "#5c4030");
    ellipse(0, -10, 5.5, 5.5, "#6b4a35");
    ctx.fillStyle = "#E8B923";
    ctx.beginPath(); ctx.moveTo(-2, -7); ctx.lineTo(2, -7); ctx.lineTo(0, -2); ctx.fill();
    ctx.restore();
  }

  // ---------- main scene ----------
  SS.renderScene = function (c, g, view, now) {
    ctx = c;
    const t = g.time;
    const light = SS.lightLevel(t);
    let shakeX = 0, shakeY = 0;
    if (g.shake > 0) { shakeX = (Math.random() - 0.5) * 14 * g.shake; shakeY = (Math.random() - 0.5) * 10 * g.shake; }
    ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, shakeX * view.dpr, shakeY * view.dpr);
    const vw = view.w, vh = view.h, camX = g.camX;

    // sky
    const [top, bottom] = SS.skyColors(t);
    const grad = ctx.createLinearGradient(0, 0, 0, 480);
    grad.addColorStop(0, top); grad.addColorStop(1, bottom);
    ctx.fillStyle = grad; ctx.fillRect(-20, -20, vw + 40, vh + 40);

    // stars
    if (light < 1) {
      ctx.fillStyle = `rgba(255,255,240,${(1 - light) * 0.9})`;
      for (const s of g.world.stars) {
        const tw = 0.7 + 0.3 * Math.sin(now / 500 + s.x * 50);
        ctx.beginPath(); ctx.arc(s.x * vw, s.y * 450, s.r * tw, 0, Math.PI * 2); ctx.fill();
      }
    }
    // sun with a heat glow that grows toward midday
    if (t > 0.18 && t < 0.82) {
      const p = (t - 0.2) / 0.6;
      const sx = lerp(-30, vw + 30, p), sy = 440 - 370 * Math.sin(Math.PI * clamp(p, 0, 1));
      const glow = 34 + 26 * SS.sunHeight(t);
      ellipse(sx, sy, glow, glow, "rgba(255,230,120,0.22)");
      ellipse(sx, sy, 22, 22, "#FFE27A");
    }
    // crescent moon
    const mt = t >= 0.8 ? t - 0.8 : t + 0.2;
    if (mt < 0.42) {
      const p = mt / 0.4;
      const mx = lerp(-30, vw + 30, p), my = 440 - 360 * Math.sin(Math.PI * clamp(p, 0, 1));
      ellipse(mx, my, 16, 16, "#EEF0E0");
      ellipse(mx + 7, my - 4, 13, 13, top);
    }

    // parallax dunes
    const layers = [[0.25, "#B98E5E", 400, 34], [0.5, "#CDA26B", 435, 22]];
    for (const [par, col, base, amp] of layers) {
      ctx.fillStyle = shade(col, light);
      ctx.beginPath(); ctx.moveTo(-20, vh + 20);
      for (let sx = -20; sx <= vw + 40; sx += 20) {
        const wx = sx + camX * par;
        ctx.lineTo(sx, base + amp * Math.sin(wx / 230) + amp * 0.5 * Math.sin(wx / 90));
      }
      ctx.lineTo(vw + 40, vh + 20); ctx.fill();
    }

    // ---- world space ----
    ctx.save();
    ctx.translate(-camX, 0);
    const x0 = Math.floor(camX / 10) * 10 - 20, x1 = camX + vw + 30;
    const onScreen = (x, m) => x > camX - m && x < camX + vw + m;

    ctx.fillStyle = shade("#E8C88A", light);
    ctx.beginPath(); ctx.moveTo(x0, vh + 20);
    for (let x = x0; x <= x1; x += 10) ctx.lineTo(x, groundY(x));
    ctx.lineTo(x1, vh + 20); ctx.fill();
    ctx.strokeStyle = shade("#D4AE6E", light); ctx.lineWidth = 2;
    for (const off of [30, 70]) {
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 10) ctx.lineTo(x, groundY(x) + off + 4 * Math.sin(x / 40 + off));
      ctx.stroke();
    }

    const w = g.world;
    for (const tr of w.trees) if (onScreen(tr.x, 100)) drawTree(tr, light);
    if (onScreen(w.oasis.x, 100)) drawOasis(w.oasis, light, now);
    for (const b of w.burrows) {
      if (!onScreen(b, 60)) continue;
      const y = groundY(b);
      ellipse(b, y + 4, 44, 16, shade("#C9A06A", light));
      ellipse(b, y + 6, 34, 12, "#2a1a0c");
      ellipse(b, y + 8, 26, 8, "#140c05");
    }
    for (const cc of w.cacti) if (onScreen(cc.x, 60)) drawCactus(cc, light, now);
    for (const r of w.rocks) {
      if (!onScreen(r.x, 60)) continue;
      const y = groundY(r.x);
      ellipse(r.x, y - r.h * 0.4, r.w, r.h, shade("#8E8577", light));
      ellipse(r.x - r.w * 0.25, y - r.h * 0.7, r.w * 0.45, r.h * 0.35, shade("#A39A8B", light));
      if (r.dew) {
        const tw = 0.6 + 0.4 * Math.sin(now / 200 + r.x);
        for (let i = -1; i <= 1; i++) {
          ellipse(r.x + i * 11, y - r.h * 1.15 + Math.abs(i) * 3, 4, 5, "rgba(120,200,255,0.9)");
          ellipse(r.x + i * 11 - 1, y - r.h * 1.15 + Math.abs(i) * 3 - 2, 1.4, 1.4, `rgba(255,255,255,${tw})`);
        }
      }
    }
    for (const f of w.food) {
      if (!onScreen(f.x, 30)) continue;
      if (f.type === "seed") drawSeeds(f); else drawBeetle(f);
    }

    // player
    const p = g.player, py = groundY(p.x);
    if (p.inBurrow) drawPeeking(p.x, py, g.sleeping, now / 1000);
    else {
      const flicker = g.hurt > 0 && Math.sin(now / 40) > 0;
      drawStrider(p.x, py, p.facing, p.walk, p.moving, g.storm.active, g.stats.fat / 100, flicker);
    }

    // hawk target marker and warning
    const h = g.hawk;
    if (h.state === "circling" && !p.inBurrow) {
      const blink = Math.sin(now / 100) > 0;
      if (blink) text("!", p.x, py - 150, 30, "#ff3b30", "center");
    }
    if (h.state === "diving") {
      const ty = groundY(h.tx);
      ctx.strokeStyle = "rgba(255,59,48,0.8)"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(h.tx, ty, 55, 10, 0, 0, Math.PI * 2); ctx.stroke();
    }

    // particles + floating text
    for (const pa of g.particles) {
      ctx.globalAlpha = clamp(pa.life / pa.max, 0, 1);
      ellipse(pa.x, pa.y, pa.r, pa.r, pa.color);
    }
    ctx.globalAlpha = 1;
    for (const fl of g.floaters) {
      ctx.globalAlpha = clamp(fl.life / 0.5, 0, 1);
      text(fl.text, fl.x, fl.y, 15, fl.color, "center");
    }
    ctx.globalAlpha = 1;

    drawHawk(h, now);

    // interaction hint
    if (g.hint) {
      ctx.font = `bold 14px ${FONT}`; ctx.textAlign = "center";
      const tw = ctx.measureText(g.hint).width + 16;
      const hy = p.inBurrow ? py - 70 : py - 172;
      ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(p.x - tw / 2, hy, tw, 24, 8); ctx.fill();
      text(g.hint, p.x, hy + 17, 14, "#fff", "center");
    }
    ctx.restore();

    // night tint
    if (light < 1) { ctx.fillStyle = `rgba(10,12,40,${(1 - light) * 0.35})`; ctx.fillRect(-20, -20, vw + 40, vh + 40); }

    // midday heat shimmer tint
    const heatT = SS.airTemp(t, g.weather);
    if (heatT > 38) { ctx.fillStyle = `rgba(255,140,40,${(heatT - 38) / 12 * 0.12})`; ctx.fillRect(-20, -20, vw + 40, vh + 40); }

    // sandstorm
    if (g.storm.active) {
      const st = g.storm;
      const fade = Math.min(1, st.timer / 2, (st.dur - st.timer) / 2);
      ctx.fillStyle = `rgba(190,150,80,${0.5 * fade})`; ctx.fillRect(-20, -20, vw + 40, vh + 40);
      ctx.strokeStyle = `rgba(235,205,145,${0.6 * fade})`; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const s of g.streaks) { ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.l, s.y + s.l * 0.12); }
      ctx.stroke();
    }

    // damage vignette
    if (g.hurt > 0 || (g.dangerPulse && g.mode === "play")) {
      const a = Math.max(g.hurt, g.dangerPulse ? 0.25 + 0.15 * Math.sin(now / 150) : 0);
      const rg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.3, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
      rg.addColorStop(0, "rgba(255,0,0,0)"); rg.addColorStop(1, `rgba(200,0,0,${0.5 * a})`);
      ctx.fillStyle = rg; ctx.fillRect(-20, -20, vw + 40, vh + 40);
    }

    ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, 0, 0);
    if (g.mode !== "lobby") drawHUD(g, view, now);
  };

  // ---------- HUD ----------
  function bar(x, y, w, label, frac, color, valueText, danger, now) {
    const h = 14;
    text(label, x, y - 4, 12, "#fff", "left");
    text(valueText, x + w, y - 4, 12, "#fff", "right");
    ctx.fillStyle = "rgba(0,0,0,0.5)"; roundRect(x, y, w, h, 5); ctx.fill();
    const flash = danger && Math.sin(now / 120) > 0;
    ctx.fillStyle = flash ? "#ff3b30" : color;
    roundRect(x, y, Math.max(4, w * clamp(frac, 0, 1)), h, 5); ctx.fill();
    if (danger) { ctx.strokeStyle = "#ff3b30"; ctx.lineWidth = 2; roundRect(x, y, w, h, 5); ctx.stroke(); }
  }

  function drawHUD(g, view, now) {
    const vw = view.w, s = g.stats;
    // stats panel
    ctx.fillStyle = "rgba(0,0,0,0.38)"; roundRect(8, 8, 360, 78, 10); ctx.fill();
    const hf = (s.heat - 28) / 18;
    bar(20, 30, 160, "Body heat", hf, s.heat > 39 ? "#ff8a3d" : s.heat < 35 ? "#6ab7ff" : "#7bd36b",
      s.heat.toFixed(1) + "°C", s.heat > SS.HEAT_HI || s.heat < SS.HEAT_LO, now);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(20 + 160 * (SS.HEAT_LO - 28) / 18, 28, 2, 18);
    ctx.fillRect(20 + 160 * (SS.HEAT_HI - 28) / 18, 28, 2, 18);
    bar(196, 30, 160, "Water", s.water / 100, "#4fb3ff", Math.round(s.water) + "%", s.water < 12, now);
    bar(20, 66, 160, "Fat (hump)", s.fat / 100, "#e0a050", Math.round(s.fat) + "%", s.fat < 5, now);
    bar(196, 66, 160, "Health", s.health / 100, "#ff5a6e", Math.round(s.health) + "%", s.health < 30, now);

    // day / temperature panel (top-right)
    ctx.fillStyle = "rgba(0,0,0,0.38)"; roundRect(vw - 168, 8, 160, 78, 10); ctx.fill();
    text("Day " + g.day, vw - 18, 34, 24, "#fff", "right");
    const air = g.air;
    const where = g.player.inBurrow ? "Burrow " : g.inShade ? "Shade " : "Air ";
    text(where + Math.round(air) + "°C", vw - 18, 55, 15, air > 35 ? "#ffb070" : air < 12 ? "#9fd0ff" : "#fff", "right");
    text(SS.phaseName(g.time) + " · " + g.weather.name, vw - 18, 75, 12, "#f3e2c0", "right", false);

    // day progress clock under the panel
    const cx = vw - 168, cw = 160, cy = 90;
    ctx.fillStyle = "rgba(0,0,0,0.38)"; roundRect(cx, cy, cw, 8, 4); ctx.fill();
    const dayGrad = ctx.createLinearGradient(cx, 0, cx + cw, 0);
    dayGrad.addColorStop(0, "#223"); dayGrad.addColorStop(0.2, "#e9a"); dayGrad.addColorStop(0.5, "#fd6");
    dayGrad.addColorStop(0.8, "#e9a"); dayGrad.addColorStop(1, "#223");
    ctx.fillStyle = dayGrad; roundRect(cx + 1, cy + 1, cw - 2, 6, 3); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillRect(cx + cw * g.time - 1, cy - 2, 3, 12);

    drawMinimap(g, view);

    // status chips
    const chips = [];
    if (g.sleeping) chips.push(["Sleeping · time ×4", "#7a6cff"]);
    if (g.inShade) chips.push(["In shade −12°C", "#4f8a4a"]);
    if (g.player.sprint && g.player.moving) chips.push(["Sprinting", "#d9783a"]);
    if (g.storm.active) chips.push(["Sandstorm · nostrils sealed", "#a27b3e"]);
    if (g.hawk.state === "circling" || g.hawk.state === "diving") chips.push(["Hawk overhead!", "#c0392b"]);
    let chx = 8;
    for (const [label, col] of chips) {
      ctx.font = `bold 12px ${FONT}`;
      const cwid = ctx.measureText(label).width + 16;
      ctx.fillStyle = col; roundRect(chx, 124, cwid, 20, 10); ctx.fill();
      text(label, chx + 8, 138, 12, "#fff", "left");
      chx += cwid + 6;
    }

    // adaptation tip popup
    if (g.tip.timer > 0 && g.tip.queue.length) {
      const msg = g.tip.queue[0];
      const a = Math.min(1, g.tip.timer * 2, (4.5 - g.tip.timer) * 4);
      ctx.globalAlpha = a;
      ctx.font = `bold 16px ${FONT}`;
      const bw = Math.min(560, vw - 30);
      const lines = wrap(msg.text, bw - 40);
      const bh = 22 * lines.length + 36, bx = (vw - bw) / 2, by = 152;
      ctx.fillStyle = "rgba(255,245,215,0.96)"; roundRect(bx, by, bw, bh, 12); ctx.fill();
      ctx.strokeStyle = "#c99a5a"; ctx.lineWidth = 3; ctx.stroke();
      text(msg.title, vw / 2, by + 19, 12, "#8a4f17", "center");
      lines.forEach((l, i) => text(l, vw / 2, by + 42 + i * 22, 16, "#4a2f12", "center"));
      ctx.globalAlpha = 1;
    }

    // day banner
    if (g.banner && g.banner.timer > 0) {
      const b = g.banner;
      const a = Math.min(1, b.timer, (3.5 - b.timer) * 3);
      ctx.globalAlpha = clamp(a, 0, 1);
      text(b.title, vw / 2, view.h * 0.42, 52, "#fff8e0", "center");
      text(b.sub, vw / 2, view.h * 0.42 + 34, 18, "#ffe6b0", "center");
      ctx.globalAlpha = 1;
    }
  }

  function drawMinimap(g, view) {
    const x = 8, y = 96, w = Math.min(view.w - 184, 520), h = 20;
    if (w < 120) return;
    const sx = wx => x + (wx / SS.WORLD_W) * w;
    ctx.fillStyle = "rgba(0,0,0,0.38)"; roundRect(x, y, w, h, 6); ctx.fill();
    // camera window
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
    ctx.strokeRect(sx(g.camX), y + 2, Math.min(w, (view.w / SS.WORLD_W) * w), h - 4);
    const wd = g.world, mid = y + h / 2;
    for (const tr of wd.trees) ellipse(sx(tr.x), mid, 4, 3, "#6f8c3a");
    ellipse(sx(wd.oasis.x), mid + 2, 5, 3, wd.oasis.level > 1 ? "#3E9BD1" : "#8E7A55");
    for (const b of wd.burrows) ellipse(sx(b), mid + 3, 4, 2.5, "#140c05");
    for (const r of wd.rocks) if (r.dew) ellipse(sx(r.x), mid - 3, 2.5, 2.5, "#7cd0ff");
    for (const c of wd.cacti) if (c.fruit) ellipse(sx(c.x), mid - 3, 2.2, 2.2, "#E04A7A");
    if (g.traits.nose) for (const f of wd.food) ellipse(sx(f.x), mid + 5, 1.4, 1.4, f.type === "scarab" ? "#ffd84a" : "#d8b37a");
    if (g.hawk.state !== "none") ellipse(sx(g.hawk.x), y + 4, 3, 2, "#ff3b30");
    ctx.fillStyle = "#fff";
    const px = sx(g.player.x);
    ctx.beginPath(); ctx.moveTo(px, mid - 5); ctx.lineTo(px - 4, mid + 5); ctx.lineTo(px + 4, mid + 5); ctx.fill();
  }
})(window.SS);
