// Game constants, difficulty presets, evolution traits and daily weather.
window.SS = window.SS || {};
(function (SS) {
  "use strict";

  SS.WORLD_W = 4000;   // world width in logical pixels (~5 screens)
  SS.DAY_LEN = 90;     // seconds for one full day
  SS.BASE_W = 700;     // minimum logical view size; canvas scales to fit
  SS.BASE_H = 600;
  SS.HEAT_HI = 41;     // body heat danger zone
  SS.HEAT_LO = 33;

  SS.DIFFICULTIES = {
    easy: {
      id: "easy", name: "Easy",
      blurb: "Milder heat and cold, slower thirst and plenty of food. Hawks only appear from day 3.",
      drain: 0.7, heatRate: 0.75, damage: 0.65, food: 26, dewChance: 0.75,
      hawk: 0.5, hawkFromDay: 3, oasis: 120, startWater: 90, startFat: 85
    },
    normal: {
      id: "normal", name: "Normal",
      blurb: "The real desert. Plan your days around the sun and watch the sky for hawks.",
      drain: 1, heatRate: 1, damage: 1, food: 18, dewChance: 0.55,
      hawk: 1, hawkFromDay: 2, oasis: 80, startWater: 80, startFat: 70
    },
    hard: {
      id: "hard", name: "Hard",
      blurb: "Brutal extremes, scarce food, a shallow oasis and hungry hawks from the first day.",
      drain: 1.3, heatRate: 1.25, damage: 1.35, food: 12, dewChance: 0.4,
      hawk: 1.6, hawkFromDay: 1, oasis: 45, startWater: 70, startFat: 60
    }
  };

  // Pick one of three at every new dawn. Each can stack up to `max` levels.
  SS.TRAITS = [
    { id: "kidneys", name: "Desert Kidneys", max: 3, desc: "Lose water 15% slower." },
    { id: "hump", name: "Bigger Hump", max: 3, desc: "Burn fat 15% slower and turn fat into 25% more water." },
    { id: "ears", name: "Radiator Ears", max: 3, desc: "Shed heat 25% faster while cooling and soak up 8% less sun." },
    { id: "fur", name: "Night Fur", max: 3, desc: "Lose body heat 18% slower when it's cold." },
    { id: "legs", name: "Long Legs", max: 3, desc: "Walk 12% faster." },
    { id: "spikes", name: "Dew Spikes", max: 3, desc: "Each dew spot gives +15 extra water." },
    { id: "hide", name: "Tough Hide", max: 3, desc: "Take 15% less damage from everything." },
    { id: "nose", name: "Keen Nose", max: 2, desc: "See food on the minimap and get 20% more from every meal." },
    { id: "snout", name: "Sealed Snout", max: 2, desc: "Sandstorms slow you down much less." }
  ];

  // peak/low shift the day's hottest and coldest air temperatures.
  SS.WEATHER = [
    { id: "clear", name: "Clear skies", desc: "An ordinary desert day.", peak: 0, low: 0, storms: 1, weight: 4 },
    { id: "heatwave", name: "Heatwave", desc: "Midday reaches 50°C. Find shade early.", peak: 5, low: 2, storms: 1, weight: 2 },
    { id: "coldsnap", name: "Cold snap", desc: "Tonight drops below freezing.", peak: -3, low: -5, storms: 1, weight: 2 },
    { id: "windy", name: "Windy", desc: "Two sandstorms today, but hawks stay grounded in storms.", peak: -2, low: 0, storms: 2, weight: 2 }
  ];
})(window.SS);
