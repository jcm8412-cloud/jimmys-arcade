/* Toy Tower movement tuning: every number that decides how the hero moves, in one place.
   Units are tiles (one girder block) and seconds: a speed of 6 means 6 tiles per second.
   Open the arcade with ?tune at the end of its address to get sliders for all of these while playing. */
window.TT = window.TT || {};

TT.CONFIG = {
  hero: {
    width: 0.6,          // collision box, in tiles
    height: 0.92
  },
  run: {
    maxSpeed: 6.5,       // top running speed
    accel: 80,           // how fast you get up to speed (high = no slow wind-up)
    turnAccel: 120,      // extra grip when switching direction
    decel: 100           // how fast you stop when you let go (high = no sliding)
  },
  air: {
    maxSpeed: 6.5,       // steering speed in the air (full air control)
    accel: 55,
    decel: 35            // slowing down in the air with no direction held
  },
  gravity: 60,           // pull while going up
  fallGravity: 75,       // pull while coming down (a little heavier, so jumps feel snappy)
  maxFall: 20,           // falling speed limit
  jump: {
    speed: 20,           // launch speed of a full jump (a bit over 3 tiles high)
    cutSpeed: 8,         // letting go of Jump early drops the upward speed to this: a short hop
    coyoteTime: 0.1,     // you can still jump this long after running off a ledge
    bufferTime: 0.1      // a jump pressed this long before landing happens on landing
  },
  ledge: {
    pullUp: 0.4,         // if your feet are this close below a ledge's top, you pull up onto it
    edgeReach: 0.25,     // landing this close past the end of a platform still counts
    cornerNudge: 0.3     // bumping your head on a corner by less than this slides you around it
  },
  climb: {
    snap: 0.65,          // grab a ladder, vine or rope when your middle is this close to it (sideways)
    autoGrab: true,      // jumping or falling into one grabs it (hold Down to fall past)
    upSpeed: 4.5,
    downSpeed: 4,        // speed when you start holding Down...
    slideSpeed: 11,      // ...speeding up to this (hold Down to slide down fast)
    slideAccel: 25,
    centerSpeed: 12,     // how quickly you slide to the middle of the ladder after grabbing
    jumpUp: 15,          // jumping off with Up held
    jumpSide: 12,        // jumping off sideways (or with no direction)
    jumpOffX: 5.5,       // sideways speed when jumping off left or right
    regrabDelay: 0.3     // after jumping off, wait this long before grabbing again
  },
  wall: {
    slideSpeed: 3.5,     // falling speed while pressing into a wall
    jumpX: 7.5,          // wall jump: push away from the wall...
    jumpY: 17,           // ...and up
    lockTime: 0.16,      // right after a wall jump, steering is weaker for this long...
    lockControl: 0.15,   // ...at this share of normal, so the push-off carries you across
    coyoteTime: 0.1      // a wall jump still works this long after leaving the wall
  },
  land: {
    squashTime: 0.14,    // the little squash when landing (falls never hurt)
    dustSpeed: 7         // landing faster than this makes a chalk-dust puff
  },
  girder: {
    slope: 0.07,         // how much a ramp (a run of > or < girders) drops per tile
    stepUp: 0.3          // walking up a ramp (or onto a slightly higher girder) follows the ground this far
  },
  hazards: {
    hitScale: 0.75,      // a toy's bump circle is this share of its drawn size, so close calls go your way
    ballRadius: 0.3,
    canRadius: 0.32,
    bounce: 0.35,        // how high bouncy balls hop as they roll
    gravity: 40          // how fast toys fall off the end of a ramp
  },
  bonk: {
    dizzyTime: 0.6,      // after a bonk the hero is dizzy (can't move) this long...
    safeTime: 1.6,       // ...and blinks, safe from more bonks, this long
    knockback: 3.5       // and gets bumped back this fast
  }
};
