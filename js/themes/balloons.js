/* Balloons: a basket held up by 6 balloons.
   Stages: 1 pop, 2 pop, 3 a sandbag drops*, 4 pop, 5 pop, 6 the pilot's cap blows away*, 7 pop,
   8 the last balloon pops and the basket bumps down onto the grass.
   (* optional details, skipped in 6-miss games) */
(function () {
  const GROUND = 205;
  const BALLOONS = [ // [cx, cy, fill] — popped from the end of the list first
    [120, 26, "#f29a9a"], [84, 38, "#f3d36b"], [156, 38, "#9fd3e8"],
    [64, 74, "#b8e986"], [176, 74, "#f2a65a"], [120, 64, "#d7b4f3"]
  ];
  const BASKET_Y = [128, 134, 140, 147, 155, 164]; // top of basket by balloons popped

  function pilot(y, sad, capOn) {
    const mouth = sad ? `<circle class="c thin" cx="120" cy="${y - 7}" r="2.5"/>`
      : `<path class="c thin" d="M115 ${y - 8} Q120 ${y - 4} 125 ${y - 8}"/>`;
    const cap = capOn ? `<path class="a fa-soft" d="M110 ${y - 19} q10 -12 20 0 z M128 ${y - 19} h8"/>` : "";
    return `<circle class="c fb" cx="120" cy="${y - 12}" r="10"/>${cap}
      <circle class="fc" cx="116" cy="${y - 14}" r="1.8"/><circle class="fc" cx="124" cy="${y - 14}" r="1.8"/>${mouth}`;
  }
  function basket(y, sad, v) {
    const bags = `<path class="d thin" d="M96 ${y + 4} l-6 10 M144 ${y + 4} l6 10"/>`
      + `<rect class="c thin fb" x="83" y="${y + 13}" width="12" height="13" rx="3"/>`
      + (v.has(3) ? "" : `<rect class="c thin fb" x="145" y="${y + 13}" width="12" height="13" rx="3"/>`);
    return `${pilot(y, sad, !v.has(6))}${bags}
      <path class="c fb" d="M96 ${y} H144 L139 ${y + 32} H101 Z"/>
      <path class="a thin" d="M98 ${y + 10} H142 M100 ${y + 21} H140 M112 ${y} V${y + 32} M128 ${y} V${y + 32}"/>`;
  }
  function balloon([x, y, fill]) {
    return `<ellipse cx="${x}" cy="${y}" rx="15" ry="18" fill="${fill}" fill-opacity=".35" stroke="${fill}" stroke-width="4"/>
      <path class="c thin" d="M${x - 6} ${y - 8} q3 -5 8 -5"/>
      <path class="c thin" d="M${x - 3} ${y + 21} h6 l-3 -3 z"/>`;
  }
  const string = ([x, y], by) => `<path class="d thin" d="M${x} ${y + 21} L${x < 120 ? 100 : x > 120 ? 140 : 120} ${by}"/>`;

  function grass(v) {
    let tufts = "";
    for (let x = 22; x < 230; x += 26) tufts += `M${x} ${GROUND} l-4 -8 M${x} ${GROUND} l4 -9`;
    const bag = v.has(3)
      ? `<g class="${v.last === 3 ? "bl-fall" : ""}"><rect class="c thin fb" x="196" y="${GROUND - 14}" width="12" height="13" rx="3"/></g>` : "";
    const cap = v.has(6)
      ? `<g class="${v.last === 6 ? "bl-blow" : ""}"><path class="a fa-soft" d="M200 30 q10 -12 20 0 z M218 30 h8"/></g>` : "";
    return `<path class="d" d="M10 ${GROUND} H230"/><path class="a thin" d="${tufts}"/>${bag}${cap}`;
  }

  function flight(v) {
    const popped = Math.min(v.core, 5);
    const by = BASKET_Y[popped];
    const left = BALLOONS.slice(0, 6 - popped);
    return left.map(b => string(b, by)).join("") + left.map(balloon).join("") + basket(by, false, v);
  }

  HM.registerTheme({
    id: "balloons",
    name: "Balloons",
    accent: "#f29a9a",
    optional: [3, 6],

    render(v, outcome) {
      if (outcome === "win") {
        return `${grass(v)}<g class="bl-away">${flight(v)}</g>
          <text class="t bl-wheee" x="120" y="120" text-anchor="middle" font-size="26">Wheee!</text>`;
      }
      if (outcome === "lose" || v.core >= 6) {
        const y = GROUND - 32;
        return `${grass(v)}<g class="bl-bump">
          <path class="d thin" d="M100 ${y} q-20 -10 -34 4 M140 ${y} q22 -12 34 2 M120 ${y} q4 -14 -10 -20"/>
          ${basket(y, true, v)}</g>`;
      }
      let out = grass(v) + flight(v);
      const lastWasPop = v.last && !this.optional.includes(v.last);
      if (lastWasPop) { // burst where the last balloon was
        const [x, y] = BALLOONS[6 - v.core];
        out += `<g class="bl-pop"><path class="a" d="M${x - 16} ${y} h-8 M${x + 16} ${y} h8 M${x} ${y - 18} v-8 M${x - 12} ${y - 12} l-6 -6 M${x + 12} ${y - 12} l6 -6 M${x - 12} ${y + 12} l-6 6 M${x + 12} ${y + 12} l6 6"/>
          <text class="t" x="${x}" y="${y + 6}" text-anchor="middle" font-size="16">pop!</text></g>`;
      }
      return out;
    },

    css: `
      .bl-pop { opacity: 0; animation: bl-pop .9s ease-out; }
      @keyframes bl-pop { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }
      .bl-fall { animation: bl-fall .6s ease-in; }
      @keyframes bl-fall { from { transform: translate(-50px, -40px); } }
      .bl-blow { animation: bl-blow .9s ease-out; }
      @keyframes bl-blow { from { transform: translate(-90px, 100px) rotate(-30deg); } }
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
