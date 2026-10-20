/* Rocket: each wrong guess drains one second of fuel from the countdown gauge.
   Stages: 1 drain, 2 drain, 3 a bolt pops off*, 4 drain, 5 drain, 6 the antenna droops*, 7 drain,
   8 out of fuel: the rocket fizzles and tips over.
   (* optional details, skipped in 6-miss games) */
(function () {
  const GROUND = 205;
  const FLAME = "#f3d36b";

  // Rocket in local coordinates: nozzle bottom at (0, 0), nose at (0, -126).
  function rocket(v) {
    const antenna = v && v.has(6)
      ? `<g class="${v.last === 6 ? "draw-in" : ""}"><path class="d thin" d="M0 -126 q2 -10 12 -10 q4 0 6 6"/><circle class="a fb" cx="18" cy="-128" r="3"/></g>`
      : `<path class="d thin" d="M0 -126 V-142"/><circle class="a fb" cx="0" cy="-145" r="3"/>`;
    const bolts = v && v.has(3)
      ? `<circle class="fc" cx="-12" cy="-30" r="2.4"/>`
      : `<circle class="fc" cx="-12" cy="-30" r="2.4"/><circle class="fc" cx="12" cy="-30" r="2.4"/>`;
    return `${antenna}
      <path class="a fa-soft" d="M-22 -40 L-38 -6 L-22 -12 Z M22 -40 L38 -6 L22 -12 Z"/>
      <path class="c fb" d="M0 -126 C20 -106 26 -66 22 -12 H-22 C-26 -66 -20 -106 0 -126 Z"/>
      <path class="a thin" d="M-14 -100 H14"/>
      <circle class="c fb" cx="0" cy="-70" r="11"/><circle class="a thin" cx="0" cy="-70" r="5"/>
      ${bolts}
      <path class="c thin fb" d="M-12 -12 L-15 0 H15 L12 -12"/>`;
  }

  function gauge(fuel) {
    let cells = "";
    for (let i = 0; i < 6; i++) {
      const y = 166 - i * 20;
      cells += `<rect x="198" y="${y}" width="26" height="16" rx="2" ${i < fuel ? 'class="fa a" fill-opacity=".6"' : 'class="d thin" fill="none"'}/>`;
    }
    return `<rect class="d" x="192" y="40" width="38" height="148" rx="4" fill="none"/>${cells}
      <text class="t" x="211" y="30" text-anchor="middle" font-size="22">${fuel}</text>
      <text class="t dim" x="211" y="204" text-anchor="middle" font-size="13">FUEL</text>`;
  }

  const pad = `<path class="d" d="M10 ${GROUND} H185 M40 ${GROUND} V54 M40 70 H74 M40 110 H74 M40 150 H74 M50 ${GROUND} L40 180"/>
    <path class="c" d="M78 182 H162 M90 182 L84 ${GROUND} M150 182 L156 ${GROUND}"/>`;

  const looseBolt = v => (v.has(3)
    ? `<g class="${v.last === 3 ? "rk-bolt" : ""}"><circle class="fc" cx="172" cy="${GROUND - 4}" r="3"/></g>` : "");

  Arcade.registerTheme({
    id: "rocket",
    name: "Rocket",
    accent: "#ff8a65",
    optional: [3, 6],

    render(v, outcome) {
      const fuel = 6 - Math.min(v.core, 6);
      if (outcome === "win") {
        return `${pad}${gauge(fuel)}${looseBolt(v)}
          <g class="rk-smoke"><path class="d thin" d="M92 180 q-14 -4 -16 -14 q-12 0 -10 -12 M148 180 q14 -4 16 -14 q12 0 10 -12"/></g>
          <g transform="translate(120 182)"><g class="rk-launch">
            <path d="M-12 2 Q0 60 12 2 Z" fill="${FLAME}" stroke="${FLAME}" stroke-width="3" stroke-linejoin="round"/>
            <path class="a" d="M-6 6 Q0 34 6 6"/>
            ${rocket(v)}
          </g></g>
          <text class="t rk-word" x="120" y="60" text-anchor="middle" font-size="26">Blast off!</text>`;
      }
      if (outcome === "lose" || v.core >= 6) {
        return `${pad}${gauge(0)}${looseBolt(v)}
          <g transform="translate(72 152)"><g class="rk-tip">${rocket(v)}</g></g>
          <g class="rk-fizz"><path class="d thin" d="M62 150 q-10 -8 -2 -16 q-10 -8 0 -16 M54 156 q-8 -6 -2 -12"/></g>
          <text class="t" x="120" y="60" text-anchor="middle" font-size="22">fzzzt...</text>`;
      }
      const drained = v.last && !this.optional.includes(v.last);
      return `${pad}${gauge(fuel)}${looseBolt(v)}
        <g transform="translate(120 182)"><g class="${drained ? "rk-shake" : ""}">${rocket(v)}</g></g>`;
    },

    css: `
      .rk-shake { animation: rk-shake .5s ease-in-out; }
      @keyframes rk-shake { 25% { transform: translateX(-3px); } 50% { transform: translateX(3px); } 75% { transform: translateX(-2px); } }
      .rk-bolt { animation: rk-bolt .7s ease-in; }
      @keyframes rk-bolt { from { transform: translate(-40px, -50px); } }
      .rk-launch { transform: translateY(-330px); animation: rk-launch 1.4s cubic-bezier(.55, 0, .9, .5); }
      @keyframes rk-launch { 0% { transform: none; } 15% { transform: translateX(2px); } 25% { transform: translateX(-2px); } 100% { transform: translateY(-330px); } }
      .rk-smoke { animation: rk-puff 1.2s ease-out; transform-origin: 120px 180px; }
      @keyframes rk-puff { from { opacity: 0; transform: scale(.3); } }
      .rk-word { animation: rk-fade .4s .9s backwards; }
      @keyframes rk-fade { from { opacity: 0; } }
      .rk-tip { transform: rotate(90deg) scale(.8); transform-origin: 0 0; animation: rk-tip 1.3s ease-in; }
      @keyframes rk-tip {
        0% { transform: translate(48px, 30px); } 30% { transform: translate(48px, 30px) rotate(-6deg); }
        55% { transform: translate(40px, 24px) rotate(14deg) scale(.9); } 85% { transform: rotate(94deg) scale(.8); } 100% { transform: rotate(90deg) scale(.8); }
      }
      .rk-fizz { opacity: .6; animation: rk-fizz 1.2s ease-out; }
      @keyframes rk-fizz { from { opacity: 0; transform: translateY(10px); } }
    `
  });
})();
