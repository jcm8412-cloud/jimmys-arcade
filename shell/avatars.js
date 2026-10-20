/* Player avatars: 12 simple chalk drawings in a 48x48 box. Guests get their first initial. */
(function () {
  const A = self.Arcade = self.Arcade || {};

  A.AVATARS = {
    cat: { name: "Cat", color: "#f3d36b", svg:
      `<path d="M12 20 L13 8 L21 15 M36 20 L35 8 L27 15"/><circle cx="24" cy="27" r="13"/>
       <circle class="dot" cx="19" cy="25" r="1.8"/><circle class="dot" cx="29" cy="25" r="1.8"/>
       <path d="M22 30 h4 l-2 2 z M10 29 h7 M10 33 l7 -1 M38 29 h-7 M38 33 l-7 -1"/>` },
    dog: { name: "Dog", color: "#f2a65a", svg:
      `<ellipse cx="24" cy="26" rx="12" ry="13"/><path d="M13 18 q-6 2 -5 14 q4 0 6 -6 M35 18 q6 2 5 14 q-4 0 -6 -6"/>
       <circle class="dot" cx="19" cy="23" r="1.8"/><circle class="dot" cx="29" cy="23" r="1.8"/>
       <ellipse class="dot" cx="24" cy="30" rx="3" ry="2.2"/><path d="M24 32 v3 q-3 3 -5 0 M24 35 q3 3 5 0"/>` },
    rocket: { name: "Rocket", color: "#ff8a65", svg:
      `<path d="M24 5 C33 12 33 26 30 34 H18 C15 26 15 12 24 5 Z"/><circle cx="24" cy="19" r="4"/>
       <path d="M18 27 L11 37 L18 34 M30 27 L37 37 L30 34 M21 38 q3 7 6 0"/>` },
    star: { name: "Star", color: "#f3d36b", svg:
      `<path d="M24 5 L29 18 L43 18 L32 27 L36 41 L24 33 L12 41 L16 27 L5 18 L19 18 Z"/>
       <circle class="dot" cx="20.5" cy="24" r="1.6"/><circle class="dot" cx="27.5" cy="24" r="1.6"/><path d="M21 29 q3 2.5 6 0"/>` },
    dinosaur: { name: "Dinosaur", color: "#b8e986", svg:
      `<path d="M6 36 Q8 24 20 22 Q22 12 30 10 Q40 9 40 16 Q40 20 34 20 Q32 30 28 36 M14 36 v5 M26 36 v5"/>
       <path d="M18 22 l2 -5 l3 4 l3 -6 l2 5"/><circle class="dot" cx="35" cy="14" r="1.8"/>` },
    owl: { name: "Owl", color: "#d7b4f3", svg:
      `<path d="M12 12 L16 17 M36 12 L32 17"/><ellipse cx="24" cy="27" rx="13" ry="15"/>
       <circle cx="19" cy="23" r="4.5"/><circle cx="29" cy="23" r="4.5"/>
       <circle class="dot" cx="19" cy="23" r="1.6"/><circle class="dot" cx="29" cy="23" r="1.6"/><path d="M22 29 l2 3 l2 -3 z"/>` },
    fish: { name: "Fish", color: "#9fd3e8", svg:
      `<path d="M6 24 Q18 10 32 24 Q18 38 6 24 Z M32 24 L42 15 L42 33 Z"/><circle class="dot" cx="13" cy="22" r="1.8"/>
       <path d="M18 18 q3 6 0 12"/>` },
    robot: { name: "Robot", color: "#b9c4b6", svg:
      `<path d="M24 6 v6"/><circle cx="24" cy="5" r="2"/><rect x="11" y="12" width="26" height="22" rx="4"/>
       <rect x="16" y="18" width="5" height="5" rx="1"/><rect x="27" y="18" width="5" height="5" rx="1"/>
       <path d="M18 28 h12 M8 20 v8 M40 20 v8 M17 34 v6 M31 34 v6"/>` },
    flower: { name: "Flower", color: "#f29a9a", svg:
      `<circle cx="24" cy="12" r="6"/><circle cx="34" cy="20" r="6"/><circle cx="14" cy="20" r="6"/>
       <circle cx="18" cy="30" r="6"/><circle cx="30" cy="30" r="6"/><circle class="dot" cx="24" cy="22" r="4.5"/>
       <path d="M24 36 v9 M24 41 q5 -4 9 -2"/>` },
    sun: { name: "Sun", color: "#f3d36b", svg:
      `<circle cx="24" cy="24" r="10"/><path d="M24 4 v6 M24 38 v6 M4 24 h6 M38 24 h6 M10 10 l4 4 M34 34 l4 4 M10 38 l4 -4 M34 14 l4 -4"/>
       <circle class="dot" cx="20.5" cy="22" r="1.5"/><circle class="dot" cx="27.5" cy="22" r="1.5"/><path d="M20 27 q4 3 8 0"/>` },
    ghost: { name: "Ghost", color: "#f2f0e6", svg:
      `<path d="M11 42 V22 a13 13 0 0 1 26 0 V42 l-4.5 -4 l-4 4 l-4.5 -4 l-4 4 l-4.5 -4 Z"/>
       <circle class="dot" cx="19" cy="22" r="2"/><circle class="dot" cx="29" cy="22" r="2"/><ellipse cx="24" cy="30" rx="2.5" ry="3"/>` },
    car: { name: "Car", color: "#9fd3e8", svg:
      `<path d="M5 31 V24 L11 23 L16 14 H31 L37 23 L43 25 V31 Z M18 17 v6 M28 17 v6"/>
       <circle cx="14" cy="32" r="4.5"/><circle cx="34" cy="32" r="4.5"/>` }
  };
  A.AVATAR_IDS = Object.keys(A.AVATARS);

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* SVG for a player: { avatar, name }. Unknown or missing avatars (guests) show the first initial. */
  A.avatarSvg = function (player, cls) {
    const a = player && A.AVATARS[player.avatar];
    if (a) {
      return `<svg class="avatar ${cls || ""}" viewBox="0 0 48 48" style="--av:${a.color}" aria-hidden="true">${a.svg}</svg>`;
    }
    const initial = ((player && player.name) || "?").trim().charAt(0).toUpperCase() || "?";
    return `<svg class="avatar guest ${cls || ""}" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="19"/><text x="24" y="32" text-anchor="middle">${esc(initial)}</text></svg>`;
  };
})();
