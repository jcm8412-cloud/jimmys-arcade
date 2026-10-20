/* Monster: a friendly-silly monster takes one step closer with each wrong guess.
   Stages: 1 step, 2 step, 3 picks a flower*, 4 step, 5 step, 6 sticks its tongue out*, 7 step,
   8 last step, right up close for a big (gentle) hug.
   (* optional details, skipped in 6-miss games) */
(function () {
  const HORIZON = 120;

  // Monster in local coordinates: feet on y=0, centred on x=0, about 120 tall.
  function monster(face, tongue) {
    const mouth = face === "o"
      ? `<ellipse class="c thin fb" cx="0" cy="-32" rx="7" ry="9"/>`
      : `<path class="c" d="M-22 -36 Q0 -16 22 -36"/>
         ${tongue ? `<path d="M2 -27 q4 14 12 6 l-4 -10 z" fill="#f29a9a" stroke="#f29a9a" stroke-width="2"/>` : ""}
         <path class="fc" d="M-10 -30 L-6 -23 L-2 -29 Z M2 -29 L6 -23 L10 -30 Z"/>`;
    return `
      <ellipse class="a fb" cx="-20" cy="0" rx="13" ry="5"/><ellipse class="a fb" cx="20" cy="0" rx="13" ry="5"/>
      <path class="a fa-soft" d="M-26 -92 L-34 -116 L-14 -98 M26 -92 L34 -116 L14 -98"/>
      <path class="fb" d="M-44 -2 C-58 -40 -52 -96 0 -100 C52 -96 58 -40 44 -2 Z"/>
      <path class="a fa-soft" d="M-44 -2 C-58 -40 -52 -96 0 -100 C52 -96 58 -40 44 -2 Z"/>
      <circle class="c fb" cx="0" cy="-64" r="16"/><circle class="fc" cx="${face === "o" ? 0 : 3}" cy="-62" r="6"/>
      <path class="c thin" d="M-30 -60 l6 3 M-32 -50 l7 1 M30 -60 l-6 3 M32 -50 l-7 1"/>
      ${mouth}`;
  }
  const arms = (lx, ly, rx, ry) =>
    `<path class="a" d="M-44 -46 Q${lx - 6} ${(ly - 46) / 2 - 30} ${lx} ${ly} M44 -46 Q${rx + 6} ${(ry - 46) / 2 - 30} ${rx} ${ry}"/>`;
  // A flower held in the monster's right hand.
  const flower = `<path class="d thin" d="M58 -18 L66 -52"/>
    <g transform="translate(67 -58)" fill="#f29a9a">
      <circle cx="0" cy="-8" r="6"/><circle cx="8" cy="0" r="6"/><circle cx="0" cy="8" r="6"/><circle cx="-8" cy="0" r="6"/>
      <circle r="5" fill="#f3d36b"/></g>`;

  function placed(steps) {
    return { x: 188 - steps * 11, y: HORIZON + 14 + steps * 11, s: 0.34 + steps * 0.11 };
  }

  function scenery() {
    return `<path class="d" d="M10 ${HORIZON} H230"/>
      <path class="d thin" d="M20 ${HORIZON} q14 -24 28 0 M196 ${HORIZON} q10 -16 20 0"/>
      <path class="d thin" d="M40 160 l6 -8 l6 8 M70 196 l6 -8 l6 8 M210 182 l6 -8 l6 8"/>`;
  }

  Arcade.registerTheme({
    id: "monster",
    name: "Monster",
    accent: "#b8e986",
    optional: [3, 6],

    render(v, outcome) {
      if (outcome === "win") {
        const p = placed(Math.min(v.core, 5));
        return `${scenery()}
          <g transform="translate(${p.x} ${p.y}) scale(${p.s})">
            <g class="mn-run">${monster("o")}${arms(-70, -80, 70, -80)}</g>
          </g>
          <path class="d thin mn-dust" d="M${p.x - 20} ${p.y} q-8 -10 -18 -4 q-8 -10 -16 0"/>
          <text class="t mn-bye" x="70" y="60" text-anchor="middle" font-size="22">Eep! Bye!</text>`;
      }
      if (outcome === "lose" || v.core >= 6) {
        return `${scenery()}
          <g transform="translate(120 212) scale(1.12)"><g class="mn-hug">
            ${monster(null, v.has(6))}
            <path class="fc" d="M0 -14 C-10 -26 -26 -16 -14 -4 L0 8 L14 -4 C26 -16 10 -26 0 -14 Z" opacity=".9"/>
            ${arms(-10, -6, 10, -6)}
          </g></g>
          <g class="mn-hearts"><path class="a fa-soft" d="M40 60 c-4 -6 -12 -2 -6 4 l6 6 l6 -6 c6 -6 -2 -10 -6 -4 Z
             M196 46 c-4 -6 -12 -2 -6 4 l6 6 l6 -6 c6 -6 -2 -10 -6 -4 Z"/></g>
          <text class="t" x="200" y="100" text-anchor="middle" font-size="20">hug!</text>`;
      }
      const p = placed(v.core);
      const stepped = v.last && !this.optional.includes(v.last);
      return `${scenery()}
        <g transform="translate(${p.x} ${p.y}) scale(${p.s})">
          <g class="${stepped ? "mn-step" : ""}">
            ${monster(null, v.has(6))}${arms(-58, -18, 58, -18)}
            ${v.has(3) ? `<g class="${v.last === 3 ? "draw-in" : ""}">${flower}</g>` : ""}
          </g>
        </g>`;
    },

    css: `
      .mn-step { animation: mn-step .7s ease-out; }
      @keyframes mn-step {
        0% { transform: translate(14px, -14px) scale(.9); } 50% { transform: translate(6px, -10px) rotate(-4deg); }
        100% { transform: none; }
      }
      .mn-run { transform: translateX(420px); animation: mn-run 1.4s ease-in; }
      @keyframes mn-run {
        0% { transform: none; } 18% { transform: rotate(16deg) translateY(4px); }
        34% { transform: rotate(-6deg); } 50% { transform: translateX(20px); } 100% { transform: translateX(420px); }
      }
      .mn-dust { opacity: 0; animation: mn-dust 1.2s .2s; }
      @keyframes mn-dust { 0%, 60% { opacity: 1; } }
      .mn-bye { animation: mn-fade .4s .5s backwards; }
      @keyframes mn-fade { from { opacity: 0; } }
      .mn-hug { animation: mn-hug 1.3s ease-in-out; }
      @keyframes mn-hug {
        0% { transform: scale(.8); } 30% { transform: scale(1.08, .94); } 55% { transform: scale(.97, 1.04); }
        75% { transform: scale(1.04, .97); } 100% { transform: none; }
      }
      .mn-hearts { animation: mn-hearts 1.2s ease-out; }
      @keyframes mn-hearts { from { transform: translateY(40px); opacity: 0; } }
    `
  });
})();
