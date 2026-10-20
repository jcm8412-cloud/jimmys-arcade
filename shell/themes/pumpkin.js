/* Pumpkin: the jack-o'-lantern's candle burns lower and a ghost fades in with each wrong guess.
   Stages: 1 candle lower, 2 lower, 3 a bat flutters by*, 4 lower, 5 lower, 6 a spider drops down*, 7 lower,
   8 the candle goes out and the ghost says "boo!".
   (* optional details, skipped in 6-miss games) */
(function () {
  const GROUND = 205;
  const ORANGE = "#f5a142";

  function pumpkin(glow) {
    const face = glow > 0
      ? `fill="${ORANGE}" fill-opacity="${glow}" stroke="${ORANGE}"`
      : `class="fb" stroke="#b9c4b6"`;
    return `
      <path class="d" d="M116 128 q2 -14 12 -18" stroke-width="7"/>
      <ellipse class="a" cx="120" cy="166" rx="58" ry="40"/>
      <ellipse class="a thin" cx="120" cy="166" rx="30" ry="40"/>
      <path class="a thin" d="M120 126 V206"/>
      <g stroke-width="3" stroke-linejoin="round">
        <path ${face} d="M88 156 L100 140 L110 156 Z M130 156 L140 140 L152 156 Z"/>
        <path ${face} d="M84 172 Q120 200 156 172 L146 178 L140 172 L132 182 L124 174 L116 182 L108 174 L100 182 L94 176 Z"/>
      </g>`;
  }

  function candle(height, lit) {
    const top = GROUND - height;
    const flame = lit
      ? `<g class="pk-flicker" style="transform-origin:210px ${top}px">
           <path d="M210 ${top - 2} q-7 -9 0 -20 q7 11 0 20 Z" fill="#f3d36b" stroke="#f3d36b" stroke-width="2"/></g>`
      : "";
    return `<path class="c" d="M196 ${GROUND} H224"/>
      <rect class="c fb" x="202" y="${top}" width="16" height="${height}" rx="2"/>
      <path class="d thin" d="M210 ${top} v-4"/>${flame}`;
  }

  function ghost(x, y, opacity, cls) {
    return `<g class="${cls || ""}" style="opacity:${opacity}">
      <path class="c fa-ghost" d="M${x - 20} ${y + 30} V${y} a20 20 0 0 1 40 0 V${y + 30} l-7 -6 l-6 6 l-7 -6 l-6 6 l-7 -6 Z"/>
      <circle class="fc" cx="${x - 7}" cy="${y - 2}" r="3"/><circle class="fc" cx="${x + 7}" cy="${y - 2}" r="3"/>
      <ellipse class="c thin" cx="${x}" cy="${y + 10}" rx="3" ry="4"/></g>`;
  }

  function extras(v) {
    let out = "";
    if (v.has(3)) out += `<g class="${v.last === 3 ? "pk-bat" : ""}">
      <path class="c thin fb" d="M150 34 q8 -10 16 -2 q4 -6 8 0 q4 -6 8 0 q8 -8 16 2 q-10 0 -14 8 q-6 -4 -10 0 q-6 -4 -10 0 q-4 -8 -14 -8 z"/>
      <circle class="fc" cx="171" cy="36" r="1.5"/><circle class="fc" cx="177" cy="36" r="1.5"/></g>`;
    if (v.has(6)) out += `<g class="${v.last === 6 ? "pk-spider" : ""}">
      <path class="d thin" d="M175 0 V70"/>
      <circle class="c thin fb" cx="175" cy="76" r="7"/>
      <path class="c thin" d="M168 72 l-8 -4 M168 78 l-8 2 M168 82 l-6 6 M182 72 l8 -4 M182 78 l8 2 M182 82 l6 6"/>
      <circle class="fc" cx="172" cy="75" r="1.4"/><circle class="fc" cx="178" cy="75" r="1.4"/></g>`;
    return out;
  }

  Arcade.registerTheme({
    id: "pumpkin",
    name: "Pumpkin",
    accent: ORANGE,
    optional: [3, 6],

    render(v, outcome) {
      const ground = `<path class="d" d="M10 ${GROUND} H190"/>`;
      if (outcome === "win") {
        return `${ground}
          <circle class="pk-glow" cx="120" cy="166" r="80" fill="${ORANGE}"/>
          ${pumpkin(1)}${candle(56, true)}
          ${ghost(50, 50, 0, "pk-flee")}
          <text class="t pk-fade" x="60" y="40" text-anchor="middle" font-size="18">eek!</text>`;
      }
      if (outcome === "lose" || v.core >= 6) {
        return `${ground}${extras(v)}${pumpkin(0)}${candle(8, false)}
          <path class="d thin pk-smoke" d="M210 194 q-8 -10 0 -20 q8 -10 0 -22"/>
          <g class="pk-boo">${ghost(62, 70, 1)}
            <path class="c fb" d="M88 26 h74 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 h-52 l-14 12 l2 -12 h-10 a8 8 0 0 1 -8 -8 v-22 a8 8 0 0 1 8 -8 z"/>
            <text class="t" x="124" y="54" text-anchor="middle" font-size="24">boo!</text></g>`;
      }
      const k = v.core;
      const burned = v.last && !this.optional.includes(v.last);
      return `${ground}${extras(v)}${pumpkin(Math.max(0.15, 0.9 - k * 0.13).toFixed(2))}
        ${candle(56 - k * 8, true)}
        ${ghost(50, 60 + (6 - k) * 4, (k / 6).toFixed(2), burned ? "pk-fadein" : "")}`;
    },

    css: `
      .fa-ghost { fill: var(--chalk); fill-opacity: .18; }
      .pk-flicker { animation: pk-flicker 1.1s ease-in-out infinite alternate; }
      @keyframes pk-flicker { 0% { transform: scale(1, 1); } 50% { transform: scale(.9, 1.1); } 100% { transform: scale(1.05, .9); } }
      .pk-fadein { animation: pk-fadein .8s ease-out; }
      @keyframes pk-fadein { from { opacity: 0; } }
      .pk-bat { animation: pk-bat 1s ease-out; }
      @keyframes pk-bat { from { transform: translate(-120px, 30px); } 50% { transform: translate(-50px, -10px); } }
      .pk-spider { animation: pk-spider .9s ease-out; }
      @keyframes pk-spider { from { transform: translateY(-80px); } }
      .pk-glow { opacity: .22; animation: pk-glow 1.2s ease-out; transform-origin: 120px 166px; }
      @keyframes pk-glow { 0% { opacity: 0; transform: scale(.5); } 60% { opacity: .4; } }
      .pk-flee { animation: pk-flee 1.2s ease-in; }
      @keyframes pk-flee { 0% { opacity: .8; transform: none; } 100% { opacity: 0; transform: translate(-90px, -70px) scale(.5); } }
      .pk-fade { opacity: 0; animation: pk-word 1.2s; }
      @keyframes pk-word { 0%, 70% { opacity: 1; } }
      .pk-smoke { opacity: .5; animation: pk-smoke 1.4s ease-out; }
      @keyframes pk-smoke { from { opacity: 1; transform: translateY(14px); } }
      .pk-boo { animation: pk-boo .7s .5s cubic-bezier(.3, 1.6, .5, 1) backwards; transform-origin: 62px 100px; }
      @keyframes pk-boo { from { opacity: 0; transform: scale(.4); } }
    `
  });
})();
