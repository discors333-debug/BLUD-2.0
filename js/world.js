// Terrain, world generation and the day/night environment model.
(function (SS) {
  "use strict";

  SS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  SS.lerp = (a, b, t) => a + (b - a) * t;
  SS.rand = (a, b) => a + Math.random() * (b - a);
  SS.groundY = x => 470 + 18 * Math.sin(x / 180) + 10 * Math.sin(x / 67 + 1);

  const BURROWS = [450, 1450, 2550, 3550];
  const OASIS_X = 1880;

  SS.createWorld = function (diff) {
    const world = {
      burrows: BURROWS.slice(),
      rocks: [250, 780, 1180, 1690, 2080, 2360, 2900, 3250, 3800]
        .map(x => ({ x, w: SS.rand(34, 50), h: SS.rand(20, 30), dew: false })),
      trees: [980, 2210, 3080].map(x => ({ x })),
      cacti: [620, 1580, 2700, 3420].map(x => ({ x, fruit: true, h: SS.rand(60, 85) })),
      oasis: { x: OASIS_X, level: diff.oasis, max: diff.oasis },
      food: [],
      stars: Array.from({ length: 80 }, () => ({ x: Math.random(), y: Math.random() * 0.6, r: SS.rand(0.6, 1.6) }))
    };
    SS.spawnFood(world, diff.food);
    SS.placeDew(world, diff);
    return world;
  };

  SS.spawnFood = function (world, n) {
    for (let i = 0; i < n; i++) {
      let x;
      do { x = SS.rand(60, SS.WORLD_W - 60); }
      while (world.burrows.some(b => Math.abs(b - x) < 70) || Math.abs(x - OASIS_X) < 90);
      const r = Math.random();
      const type = r < 0.07 ? "scarab" : r < 0.5 ? "beetle" : "seed";
      world.food.push({ x, type, dir: Math.random() < 0.5 ? -1 : 1, phase: Math.random() * 6 });
    }
  };

  SS.placeDew = function (world, diff) {
    let n = 0;
    world.rocks.forEach(r => { r.dew = Math.random() < diff.dewChance; if (r.dew) n++; });
    while (n < 2) {
      const r = world.rocks[Math.floor(Math.random() * world.rocks.length)];
      if (!r.dew) { r.dew = true; n++; }
    }
  };

  // ---- Day/night model. t is time of day in [0,1): 0 = midnight, 0.5 = noon ----
  SS.phaseName = t => (t < 0.2 || t >= 0.8) ? "Night" : t < 0.3 ? "Dawn" : t < 0.7 ? "Day" : "Dusk";
  SS.sunHeight = t => (t >= 0.2 && t <= 0.8) ? Math.sin(Math.PI * (t - 0.2) / 0.6) : 0;

  SS.airTemp = function (t, weather) {
    const low = 3 + (weather ? weather.low : 0);
    const peak = 45 + (weather ? weather.peak : 0);
    // the ground keeps radiating heat a little after the sun peaks
    const s = (t >= 0.2 && t <= 0.85) ? Math.max(0, Math.sin(Math.PI * (t - 0.2) / 0.65)) : 0;
    return low + (peak - low) * Math.pow(s, 1.3);
  };

  // 0 = full night, 1 = full daylight
  SS.lightLevel = function (t) {
    if (t < 0.18 || t > 0.84) return 0;
    if (t < 0.3) return (t - 0.18) / 0.12;
    if (t > 0.72) return 1 - (t - 0.72) / 0.12;
    return 1;
  };

  const SKY = [
    [0.00, [12, 16, 40], [30, 30, 60]],
    [0.18, [20, 24, 60], [60, 50, 90]],
    [0.24, [90, 90, 150], [250, 150, 110]],
    [0.32, [110, 170, 230], [240, 220, 180]],
    [0.50, [70, 150, 235], [250, 230, 190]],
    [0.68, [110, 160, 220], [245, 210, 160]],
    [0.76, [120, 70, 120], [250, 130, 80]],
    [0.84, [25, 25, 65], [70, 50, 90]],
    [1.00, [12, 16, 40], [30, 30, 60]]
  ];
  SS.skyColors = function (t) {
    for (let i = 0; i < SKY.length - 1; i++) {
      const a = SKY[i], b = SKY[i + 1];
      if (t >= a[0] && t <= b[0]) {
        const f = (t - a[0]) / (b[0] - a[0]);
        const mix = (c1, c2) => `rgb(${c1.map((v, j) => Math.round(SS.lerp(v, c2[j], f))).join(",")})`;
        return [mix(a[1], b[1]), mix(a[2], b[2])];
      }
    }
    return ["#0c1028", "#1e1e3c"];
  };

  SS.pickWeather = function () {
    const total = SS.WEATHER.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * total;
    for (const w of SS.WEATHER) { r -= w.weight; if (r <= 0) return w; }
    return SS.WEATHER[0];
  };
})(window.SS);
