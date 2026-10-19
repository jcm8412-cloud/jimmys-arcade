/* Balloons: a basket held up by 6 balloons; one pops per wrong guess. */
(function () {
  const GROUND = 205;
  const BALLOONS = [ // [cx, cy, fill] — popped from the end of the list first
    [120, 26, "#f29a9a"], [84, 38, "#f3d36b"], [156, 38, "#9fd3e8"],
    [64, 74, "#b8e986"], [176, 74, "#f2a65a"], [120, 64, "#d7b4f3"]
  ];
  const BASKET_Y = [128, 134, 140, 147, 155, 164]; // top of basket by stage

  function basket(y, sad) {
    const mouth = sad ? `<circle class="c thin" cx="120" cy="${y - 7}" r="2.5"/>`
      : `<path class="c thin" d="M115 ${y - 8} Q120 ${y - 4} 125 ${y - 8}"/>`;
    return `
      <circle class="c fb" cx="120" cy="${y - 12}" r="10"/>
      <circle class="fc" cx="116" cy="${y - 14}" r="1.8"/><circle class="fc" cx="124" cy="${y - 14}" r="1.8"/>${mouth}
      <path class="c fb" d="M96 ${y} H144 L139 ${y + 32} H101 Z"/>
      <path class="a thin" d="M98 ${y + 10} H142 M100 ${y + 21} H140 M112 ${y} V${y + 32} M128 ${y} V${y + 32}"/>`;
  }

  function balloon([x, y, fill]) {
    return `<ellipse cx="${x}" cy="${y}" rx="15" ry="18" fill="${fill}" fill-opacity=".35" stroke="${fill}" stroke-width="4"/>
      <path class="c thin" d="M${x - 6} ${y - 8} q3 -5 8 -5"/>
      <path class="c thin" d="M${x - 3} ${y + 21} h6 l-3 -3 z"/>`;
  }
  const string = ([x, y], by) => `<path class="d thin" d="M${x} ${y + 21} L${x < 120 ? 100 : x > 120 ? 140 : 120} ${by}"/>`;

  function grass() {
    let tufts = "";
    for (let x = 22; x < 230; x += 26) tufts += `M${x} ${GROUND} l-4 -8 M${x} ${GROUND} l4 -9`;
    return `<path class="d" d="M10 ${GROUND} H230"/><path class="a thin" d="${tufts}"/>`;
  }

  function flight(stage) {
    const by = BASKET_Y[Math.min(stage, 5)];
    const left = BALLOONS.slice(0, 6 - stage);
    return left.map(b => string(b, by)).join("") + left.map(balloon).join("") + basket(by);
  }

  HM.registerTheme({
    id: "balloons",
    name: "Balloons",
    accent: "#f29a9a",

    render(stage, outcome) {
      if (outcome === "win") {
        return `${grass()}<g class="bl-away">${flight(stage)}</g>
          <text class="t bl-wheee" x="120" y="120" text-anchor="middle" font-size="26">Wheee!</text>`;
      }
      if (outcome === "lose") {
        const y = GROUND - 32;
        return `${grass()}<g class="bl-bump">
          <path class="d thin" d="M100 ${y} q-20 -10 -34 4 M140 ${y} q22 -12 34 2 M120 ${y} q4 -14 -10 -20"/>
          ${basket(y, true)}</g>`;
      }
      let out = grass() + flight(stage);
      if (stage > 0) { // burst where the last balloon was
        const [x, y] = BALLOONS[6 - stage];
        out += `<g class="bl-pop"><path class="a" d="M${x - 16} ${y} h-8 M${x + 16} ${y} h8 M${x} ${y - 18} v-8 M${x - 12} ${y - 12} l-6 -6 M${x + 12} ${y - 12} l6 -6 M${x - 12} ${y + 12} l-6 6 M${x + 12} ${y + 12} l6 6"/>
          <text class="t" x="${x}" y="${y + 6}" text-anchor="middle" font-size="16">pop!</text></g>`;
      }
      return out;
    },

    css: `
      .bl-pop { opacity: 0; animation: bl-pop .9s ease-out; }
      @keyframes bl-pop { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }
      .bl-away { transform: translateY(-240px); animation: bl-away 1.4s ease-in; }
      @keyframes bl-away { 0% { transform: translateY(0); } 20% { transform: translateY(6px); } }
      .bl-wheee { animation: bl-fade .5s .5s backwards; }
      @keyframes bl-fade { from { opacity: 0; } }
      .bl-bump { animation: bl-bump 1s ease-in; }
      @keyframes bl-bump {
        0% { transform: translateY(-60px); } 55% { transform: translateY(0); } 70% { transform: translateY(-12px); }
        85% { transform: translateY(0); } 92% { transform: translateY(-4px); } 100% { transform: translateY(0); }
      }
    `
  });
})();
