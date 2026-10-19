/* Snowman: melts a little more with each wrong guess.
   Stages: 1 hat falls, 2 scarf slips off*, 3 carrot nose drops, 4 arms droop, 5 buttons fall off*,
   6 body shrinks, 7 shrinks more into a puddle, 8 melted: a puddle with the hat floating in it.
   (* optional details, skipped in 6-miss games) */
(function () {
  const GROUND = 205;
  const CARROT = "#f2a65a";
  const SCARF = "#f29a9a";
  const SIZES = { full: [35, 25, 18], small: [30, 21, 15], tiny: [24, 17, 12] }; // [bottom, middle, head]

  function hat(x, y, extra) {
    return `<g transform="translate(${x} ${y})${extra || ""}">
      <rect class="c fb" x="-12" y="-24" width="24" height="24" rx="2"/>
      <path class="c" d="M-21 0 H21"/>
      <path class="a" d="M-11 -6 H11"/>
    </g>`;
  }
  const carrot = (x, y, rot) =>
    `<path transform="translate(${x} ${y}) rotate(${rot})" d="M0 -3 L18 0 L0 3 Z" fill="${CARROT}" stroke="${CARROT}" stroke-width="2" stroke-linejoin="round"/>`;
  const scarfOnGround = `<path d="M150 ${GROUND - 4} q12 -6 24 0 t22 -2" fill="none" stroke="${SCARF}" stroke-width="6" stroke-linecap="round"/>`;
  const buttonsOnGround = `<circle class="fc" cx="96" cy="${GROUND - 4}" r="3"/><circle class="fc" cx="104" cy="${GROUND - 3}" r="3"/><circle class="fc" cx="186" cy="${GROUND - 4}" r="3"/>`;

  // Wrap a part in a class only when it is the change this miss made.
  const fresh = (v, stage, cls, markup) => `<g class="${v.last === stage ? cls : ""}">${markup}</g>`;

  function snowman(v) {
    const [rb, rm, rh] = v.has(7) ? SIZES.tiny : v.has(6) ? SIZES.small : SIZES.full;
    const cb = GROUND - rb, cm = cb - rb - rm + 6, ch = cm - rm - rh + 5;
    const armY = cm - 4;
    const arms = v.has(4)
      ? `<path class="d" d="M${120 - rm + 2} ${armY} L${120 - rm - 22} ${armY + 26} M${120 + rm - 2} ${armY} L${120 + rm + 22} ${armY + 26}"/>`
      : `<path class="d" d="M${120 - rm + 2} ${armY} L${120 - rm - 30} ${armY - 20} M${120 - rm - 20} ${armY - 13} l-4 -10
                            M${120 + rm - 2} ${armY} L${120 + rm + 30} ${armY - 20} M${120 + rm + 20} ${armY - 13} l4 -10"/>`;
    const neckY = ch + rh - 2;
    let out = `
      <circle class="c" cx="120" cy="${cb}" r="${rb}"/>
      <circle class="c" cx="120" cy="${cm}" r="${rm}"/>
      <circle class="c" cx="120" cy="${ch}" r="${rh}"/>
      <circle class="fc" cx="${120 - rh * .35}" cy="${ch - 3}" r="2.5"/><circle class="fc" cx="${120 + rh * .35}" cy="${ch - 3}" r="2.5"/>
      <path class="c thin" d="M${120 - rh * .35} ${ch + rh * .45} Q120 ${ch + rh * (v.has(6) ? .3 : .65)} ${120 + rh * .35} ${ch + rh * .45}"/>
      ${fresh(v, 4, "draw-in", arms)}`;
    out += v.has(5)
      ? fresh(v, 5, "snow-drop-small", buttonsOnGround)
      : `<circle class="fc" cx="120" cy="${cm - 7}" r="2.8"/><circle class="fc" cx="120" cy="${cm + 7}" r="2.8"/><circle class="fc" cx="120" cy="${cb - 6}" r="2.8"/>`;
    out += v.has(2)
      ? fresh(v, 2, "snow-drop", scarfOnGround)
      : `<path d="M${120 - rh} ${neckY} q${rh} 7 ${rh * 2} 0 M${120 + rh * .4} ${neckY + 3} l4 18" fill="none" stroke="${SCARF}" stroke-width="6" stroke-linecap="round"/>`;
    out += v.has(3) ? fresh(v, 3, "snow-drop", carrot(150, GROUND - 3, 160)) : carrot(120, ch + 2, 0);
    out += v.has(1) ? fresh(v, 1, "snow-drop", hat(62, GROUND, " rotate(-18)")) : hat(120, ch - rh + 2);
    if (v.has(7)) out += fresh(v, 7, "draw-in", `<ellipse class="a fa-soft" cx="120" cy="${GROUND - 2}" rx="48" ry="6"/>`);
    return out;
  }

  function puddle(v) {
    return `<g class="snow-ripple"><ellipse class="a fa-soft" cx="120" cy="${GROUND - 4}" rx="80" ry="12"/></g>
      <path class="d" d="M58 ${GROUND - 6} l-16 -4 M176 ${GROUND - 5} l18 -3"/>
      ${carrot(140, GROUND - 6, 10)}
      ${v.has(2) ? scarfOnGround : `<path d="M70 ${GROUND - 5} q10 -4 20 0" fill="none" stroke="${SCARF}" stroke-width="5" stroke-linecap="round"/>`}
      <g class="snow-bob">${hat(104, GROUND - 6, " rotate(8)")}</g>`;
  }

  HM.registerTheme({
    id: "snowman",
    name: "Snowman",
    accent: "#9fd3e8",
    optional: [2, 5],

    render(v, outcome) {
      const ground = `<path class="d" d="M15 ${GROUND} H225"/>`;
      if (outcome === "win") {
        const flakes = [[30, 60], [70, 30], [95, 95], [160, 70], [200, 110], [215, 40], [45, 140], [180, 150], [130, 20]]
          .map(([x, y], i) => `<g class="snow-flake" style="animation-delay:${(i % 4) * .12}s"><path class="c thin" d="M${x - 5} ${y} h10 M${x} ${y - 5} v10 M${x - 3.5} ${y - 3.5} l7 7 M${x - 3.5} ${y + 3.5} l7 -7"/></g>`)
          .join("");
        const fresh0 = HM.themeView(this, 0, 8);
        return `${ground}
          <g><circle class="a fa-soft" cx="196" cy="38" r="16"/>
            <path class="a" d="M196 12 v-6 M196 64 v6 M170 38 h-6 M222 38 h6"/></g>
          <g class="snow-cloud"><path class="c fb" d="M160 52 q-4 -18 14 -20 q6 -14 22 -8 q14 -8 22 6 q14 2 10 22 z"/></g>
          ${snowman(fresh0)}${flakes}`;
      }
      // The last stage (or a loss in a 6-miss game) is the melted puddle.
      if (outcome === "lose" || v.has(8)) return ground + puddle(v);
      return ground + snowman(v);
    },

    css: `
      .snow-drop { animation: snow-drop .6s ease-in; }
      @keyframes snow-drop { from { transform: translateY(-110px); opacity: .3; } }
      .snow-drop-small { animation: snow-drop-small .5s ease-in; }
      @keyframes snow-drop-small { from { transform: translateY(-40px); opacity: .3; } }
      .snow-cloud { animation: snow-cloud 1.2s ease-out; }
      @keyframes snow-cloud { from { transform: translateX(-150px); } }
      .snow-flake { animation: snow-fall 1.3s ease-out backwards; }
      @keyframes snow-fall { from { transform: translateY(-80px); opacity: 0; } }
      .snow-bob { animation: snow-bob 1.4s ease-in-out; }
      @keyframes snow-bob { 0%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } 65% { transform: translateY(3px); } }
      .snow-ripple { animation: snow-ripple 1.2s ease-out; transform-origin: 120px 201px; }
      @keyframes snow-ripple { from { transform: scaleX(.4); opacity: .3; } }
    `
  });
})();
