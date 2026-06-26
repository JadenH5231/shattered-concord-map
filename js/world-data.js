/* =====================================================================
 * THE SHATTERED CONCORD — World Data (player-safe layer)
 * ---------------------------------------------------------------------
 * Coordinates are world units: easting x = 0 (west) .. 1000 (east),
 * northing y = 0 (south) .. 800 (north). Stored as [y, x] to match the
 * map's [lat, lng] convention with north pointing up.
 *
 * The outer coastline is a set of control points; map.js runs a
 * Catmull-Rom pass over them so the shore reads as a flowing, natural
 * coast (capes, coves, headlands, a deep bay) rather than straight cuts.
 * The two nations are derived from the coastline split along the border
 * spine, so realm shading always meets the water exactly.
 *
 * EVERY description here is drawn only from the spoiler-safe Player's
 * Primer. No DM secrets, no metaplot, no buried things. If it isn't
 * something a Kalvanni traveller could know, it isn't on this map.
 * ===================================================================== */

const WORLD = {
  // Overall bounds [ [minY,minX], [maxY,maxX] ]
  bounds: [[0, 0], [800, 1000]],

  /* The landmass of Istraveth — control points for a smoothed coast.
   * Ordered as one ring starting at the NORTH SPLIT (where the border
   * reaches the northern sea), running west and south, into Lanthorne
   * Bay to its head (the SOUTH SPLIT), back out and around the east. */
  coastline: [
    // — north coast, split → west —
    [765, 500], [783, 468], [770, 436], [791, 402], [763, 372],
    [780, 340], [794, 308], [771, 278], [787, 246], [766, 216],
    [783, 186], [797, 150], [778, 116], [762, 86], [748, 62],
    // — west coast, north → south (coves & capes) —
    [722, 60], [688, 84], [652, 58], [618, 86], [582, 60],
    [548, 88], [512, 58], [478, 86], [442, 60], [408, 88],
    [372, 60], [338, 86], [302, 60], [268, 86], [232, 58], [198, 84], [168, 70],
    // — south-west coast, turning east —
    [146, 92], [122, 138], [108, 186], [98, 236], [92, 288], [90, 338], [92, 372],
    // — Lanthorne Bay, west shore → head (south split) —
    [112, 386], [150, 398], [186, 408], [205, 442], [214, 468], [215, 485],
    // — Lanthorne Bay, head → east shore, back out —
    [210, 520], [190, 548], [160, 564], [122, 576], [96, 560], [92, 540],
    // — south-east coast (the ashen shore) —
    [86, 590], [78, 632], [88, 676], [70, 716], [86, 758], [72, 800], [88, 842], [74, 884], [92, 918],
    // — east coast, south → north (inlets & a peninsula) —
    [122, 946], [158, 930], [200, 954], [244, 936], [288, 958], [332, 938],
    [376, 960], [420, 978], [456, 952], [500, 966], [544, 942],
    [588, 962], [632, 940], [676, 960], [720, 942],
    // — north-east coast, back to the split —
    [754, 918], [776, 882], [762, 846], [748, 808], [770, 772],
    [786, 734], [768, 700], [752, 664], [776, 628], [760, 592], [748, 556], [766, 528]
  ],

  /* The contested border. Runs down the spine of the land from the
   * northern sea to the head of Lanthorne Bay. The nations are built by
   * splitting the coastline at this line's two endpoints. */
  borderSpine: [
    [765, 500], [690, 503], [620, 505], [560, 498], [470, 510],
    [360, 500], [285, 496], [250, 495], [215, 485]
  ],

  // Lanthorne Bay — the contested southern sea-throat (named water).
  waters: [
    { name: "Lanthorne Bay", at: [150, 478], size: "bay" },
    { name: "The Sundering Sea", at: [40, 760], size: "sea" }
  ],

  /* Offshore isles — pure geography, unnamed (no lore implied).
   * map.js grows a small jittered, smoothed island from each. */
  islands: [
    { c: [52, 512], r: 22, seed: 21 },
    { c: [34, 470], r: 13, seed: 22 },
    { c: [44, 556], r: 9,  seed: 23 },
    { c: [566, 26], r: 26, seed: 24 },
    { c: [612, 30], r: 12, seed: 25 },
    { c: [812, 872], r: 24, seed: 26 },
    { c: [300, 986], r: 14, seed: 27 },
    { c: [150, 612], r: 8,  seed: 28 }
  ],

  // The two nations. Polygons are derived in map.js from coastline + spine.
  nations: {
    kalvann: {
      name: "KALVANN",
      subtitle: "The Western Reach",
      labelAt: [470, 120]
    },
    velgrath: {
      name: "VELGRATH",
      subtitle: "The Iron East",
      labelAt: [662, 742]
    }
  },

  // The great regions. Polygons are shaded; labels float above terrain.
  regions: [
    {
      id: "rimefang",
      name: "The Rimefang Mountains",
      kind: "mountains",
      labelAt: [678, 512],
      polygon: [
        [775, 445], [770, 520], [765, 580], [620, 590], [545, 565],
        [505, 510], [520, 445], [600, 430], [690, 435]
      ],
      desc: "The cold northern barrier between the nations' northern flanks. Riddled with smuggling tunnels and rich ore."
    },
    {
      id: "thirvale",
      name: "The Thir Vale",
      kind: "warland",
      labelAt: [400, 503],
      polygon: [
        [520, 470], [520, 545], [400, 540], [300, 528], [240, 505],
        [250, 458], [330, 470], [430, 462]
      ],
      desc: "The trench-scarred borderland between the nations. The front has barely moved in twenty years, and the dead outnumber the living. Soldiers say it is haunted."
    },
    {
      id: "wyldewold",
      name: "The Wyldewold",
      kind: "forest",
      labelAt: [645, 175],
      polygon: [
        [770, 70], [775, 240], [700, 320], [600, 330], [520, 300],
        [500, 180], [540, 80], [650, 60]
      ],
      desc: "A primeval forest no nation can hold. Mythic beasts, twisted growth, and people who live beyond all law."
    },
    {
      id: "ashendeep",
      name: "The Ashen Deep",
      kind: "desert",
      labelAt: [195, 765],
      polygon: [
        [305, 645], [300, 800], [255, 885], [130, 880], [95, 760],
        [120, 660], [200, 625]
      ],
      desc: "A haunted desert of ash and glass where something went catastrophically wrong long ago. Those who enter mostly do not return."
    }
  ],

  // Major waterways. The Thir runs the length of the Vale into the bay.
  rivers: [
    { id: "thir", name: "The Thir", points: [[600, 560], [565, 520], [505, 515], [440, 506], [370, 500], [300, 492], [250, 488], [222, 486], [216, 485]] },
    { id: "thir-trib", name: "", points: [[470, 510], [440, 470], [400, 430], [378, 372]] },
    { id: "kelder", name: "The Kelder", points: [[330, 86], [300, 150], [266, 220], [258, 300]] }
  ],

  // Player-known roads. dashed:true = smuggling route / hidden trail.
  roads: [
    { from: "cantreval", to: "aurelonne", points: [[362, 232], [322, 296], [284, 356], [250, 405], [234, 428]] },
    { from: "cantreval", to: "lirewick", points: [[362, 232], [352, 330], [340, 400], [330, 452]] },
    { from: "cantreval", to: "brammer", points: [[362, 232], [318, 268], [272, 308]] },
    { from: "brammer", to: "aurelonne", points: [[272, 308], [250, 366], [234, 428]] },
    { from: "vorgrad", to: "kalteisen", points: [[432, 812], [505, 715], [560, 624]] },
    { from: "vorgrad", to: "mardrek", points: [[432, 812], [400, 688], [366, 560]] },
    { from: "cantreval", to: "thistlebank", dashed: true, points: [[362, 232], [432, 214], [480, 192], [505, 178]] },
    { from: "kalteisen", to: "stonehook", dashed: true, points: [[560, 624], [582, 562], [600, 512]] },
    { from: "stonehook", to: "kalvann-north", dashed: true, points: [[600, 512], [588, 470], [560, 442], [520, 430]] }
  ],

  // The current front, as commonly drawn on Kalvanni broadsheets.
  frontLine: [
    [528, 500], [470, 522], [432, 492], [380, 516], [332, 494],
    [284, 510], [242, 492], [216, 486]
  ],

  /* The settlements. type drives the procedural layout in town-generator.js.
   * seed keeps each town's streets stable across reloads (a DM board must
   * not reshuffle). size is the layout radius in world units. */
  settlements: [
    {
      id: "cantreval", name: "Cantreval", type: "city", nation: "kalvann",
      pos: [362, 232], size: 42, seed: 1411, capital: true,
      landmarks: ["The Athenaeum — oldest library in the realm", "Protector's Bridge", "The Bell Market"],
      desc: "Kalvann's capital and oldest city — bridges, color, music, and informers. Home of the Athenaeum, the realm's oldest library."
    },
    {
      id: "aurelonne", name: "Aurelonne", type: "port", nation: "kalvann",
      pos: [234, 428], size: 34, seed: 2207,
      landmarks: ["The Long Docks", "Charter House", "The Saltgate"],
      desc: "Kalvann's great port on Lanthorne Bay and seat of the merchant houses. Half the world's smuggling is brokered here under honest letterhead."
    },
    {
      id: "lirewick", name: "Lirewick", type: "village", nation: "kalvann",
      pos: [330, 452], size: 18, seed: 333, start: true,
      landmarks: ["The Commons", "The Waystone Inn", "Old Chapel"],
      desc: "A small, tired Kalvanni border village on the edge of the Thir Vale. Where many a hard road begins."
    },
    {
      id: "thistlebank", name: "Thistlebank", type: "hidden", nation: "kalvann",
      pos: [505, 178], size: 16, seed: 909, hidden: true,
      landmarks: ["The Reading Halls", "Poets' Walk"],
      desc: "A hidden sanctuary of Kalvanni historians and poets. Hard to find on purpose — its place on any map is rumor more than record."
    },
    {
      id: "brammer", name: "Brammer's Hollow", type: "village", nation: "kalvann",
      pos: [272, 308], size: 18, seed: 1717,
      landmarks: ["The Market Green", "The Old Mill", "Hollow Chapel"],
      desc: "A rural town the war has strangely spared. Outsiders are tolerated, not trusted."
    },
    {
      id: "vorgrad", name: "Vorgrad", type: "fortress-city", nation: "velgrath",
      pos: [432, 812], size: 42, seed: 4001, capital: true,
      landmarks: ["The Hammerhall", "The Iron Gate", "Bellspire"],
      desc: "Velgrath's capital — a tiered fortress-city of black stone and forge-smoke. Bells, not clocks, run the day."
    },
    {
      id: "kalteisen", name: "Kalteisen", type: "industrial", nation: "velgrath",
      pos: [560, 624], size: 32, seed: 5123,
      landmarks: ["Foundry Row", "The Ore Gate", "The Slag Yards"],
      desc: "Velgrath's industrial heart at the foot of the Rimefang. Mines, foundries, and war-engine yards under a brown sky."
    },
    {
      id: "mardrek", name: "Fort Mardrek", type: "fortress", nation: "velgrath",
      pos: [366, 560], size: 28, seed: 6611,
      landmarks: ["The Redoubt", "The Trench Lines", "The Muster Yard"],
      desc: "Velgrath's great border fortress facing the Thir Vale — less a fort than kilometres of trench, redoubt, and graveyard."
    },
    {
      id: "stonehook", name: "Stonehook", type: "mine-market", nation: "neutral",
      pos: [600, 512], size: 24, seed: 7777,
      landmarks: ["The Black Market", "The Old Adit", "The Truce Hall"],
      desc: "A played-out mine turned neutral black-market hub. Mercenaries, deserters, and spies from both sides drink at the same bar."
    }
  ]
};

if (typeof module !== "undefined") module.exports = WORLD;
