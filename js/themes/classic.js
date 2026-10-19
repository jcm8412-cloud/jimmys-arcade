/* Classic: a stick figure gains one part per wrong guess.
   Stages: 1 head, 2 eyes*, 3 body, 4 left arm, 5 right arm, 6 left leg, 7 right leg, 8 hands and feet*.
   (* optional details, skipped in 6-miss games) */
HM.registerTheme({
  id: "classic",
  name: "Classic",
  accent: "#f3d36b",
  optional: [2, 8],

  render(v, outcome) {
    const stand = `<path class="d" d="M30 205 H130 M60 205 V18 H160 V40"/>`;

    if (outcome === "win") {
      return `${stand}
        <path class="d" d="M150 205 H225"/>
        <g class="classic-jump">
          <circle class="c" cx="188" cy="104" r="17"/>
          <circle class="fc" cx="182" cy="101" r="2.5"/><circle class="fc" cx="194" cy="101" r="2.5"/>
          <path class="a" d="M179 109 Q188 119 197 109"/>
          <path class="c" d="M188 121 V162 M188 134 L168 112 M188 134 L208 112 M188 162 L174 200 M188 162 L202 200"/>
          <path class="c thin" d="M174 200 h-8 M202 200 h8"/>
        </g>
        <g class="classic-yay">
          <text class="t" x="196" y="62" text-anchor="middle" font-size="22">yay!</text>
          <path class="a" d="M160 80 l-8 -8 M216 80 l8 -8 M188 72 v-10"/>
        </g>`;
    }

    const lost = outcome === "lose";
    const mouth = lost ? "M151 72 Q160 64 169 72" : "M151 68 Q160 75 169 68";
    const parts = {
      1: `<circle class="c" cx="160" cy="60" r="20"/><path class="c thin" d="${mouth}"/>`,
      2: `<circle class="fc" cx="153" cy="55" r="2.8"/><circle class="fc" cx="167" cy="55" r="2.8"/>`,
      3: `<path class="c" d="M160 80 V140"/>`,
      4: `<path class="c" d="M160 98 L134 124"/>`,
      5: `<path class="c" d="M160 98 L186 124"/>`,
      6: `<path class="c" d="M160 140 L140 182"/>`,
      7: `<path class="c" d="M160 140 L180 182"/>`,
      8: `<circle class="c thin fb" cx="132" cy="126" r="4"/><circle class="c thin fb" cx="188" cy="126" r="4"/>
          <path class="c" d="M140 182 h-10 M180 182 h10"/>`
    };
    const shown = v.done
      .map(s => `<g class="${!lost && s === v.last ? "draw-in" : ""}">${parts[s]}</g>`).join("");
    return `${stand}<g class="${lost ? "classic-sad" : ""}">${shown}</g>`;
  },

  css: `
    .classic-jump { animation: classic-jump 1.2s ease-out; }
    @keyframes classic-jump {
      0% { transform: translateY(0); } 25% { transform: translateY(-34px); } 50% { transform: translateY(0); }
      72% { transform: translateY(-18px); } 100% { transform: translateY(0); }
    }
    .classic-yay { animation: classic-pop .6s .3s ease-out backwards; transform-origin: 196px 60px; }
    @keyframes classic-pop { from { opacity: 0; transform: scale(.3); } }
    .classic-sad { animation: classic-sway 1.2s ease-in-out; transform-origin: 160px 40px; }
    @keyframes classic-sway { 0%, 100% { transform: rotate(0); } 30% { transform: rotate(5deg); } 65% { transform: rotate(-4deg); } }
  `
});
