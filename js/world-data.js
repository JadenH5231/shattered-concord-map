/* =====================================================================
 * THE SHATTERED CONCORD — World Data (player-safe layer)
 * ---------------------------------------------------------------------
 * Coordinates are world units: easting x = 0 (west) .. 1000 (east),
 * northing y = 0 (south) .. 800 (north). Stored as [y, x] to match the
 * map's [lat, lng] convention with north pointing up.
 *
 * EVERY description here is drawn only from the spoiler-safe Player's
 * Primer. No DM secrets, no metaplot, no buried things. If it isn't
 * something a Kalvanni traveller could know, it isn't on this map.
 * ===================================================================== */

const WORLD = {
  // Overall bounds [ [minY,minX], [maxY,maxX] ]
  bounds: [[0, 0], [800, 1000]],

  // The landmass of Istraveth (outer coastline), clockwise from NW.
  coastline: [
    [760, 60], [770, 240], [752, 430], [772, 620], [748, 800], [740, 940],
    [560, 955], [380, 945], [200, 950], [80, 930],
    [70, 760], [95, 620], [90, 580],            // south coast → bay east headland
    [180, 560], [210, 520], [212, 440], [185, 405], // around Lanthorne Bay
    [92, 380],                                   // bay west headland
    [80, 300], [70, 160], [70, 70],              // south coast west
    [240, 55], [430, 65], [600, 50], [760, 60]   // west coast up to NW
  ],

  // Lanthorne Bay — the contested southern sea-throat (water cutting inland).
  bay: [
    [215, 485], [210, 520], [180, 560], [90, 580],
    [92, 380], [185, 405], [212, 440], [215, 485]
  ],

  // The two nations. They share the central border spine.
  nations: {
    kalvann: {
      name: "KALVANN",
      subtitle: "The Western Reach",
      labelAt: [330, 150],
      polygon: [
        [765, 500], [760, 60], [600, 50], [430, 65], [240, 55], [70, 70],
        [70, 160], [80, 300], [92, 380], [185, 405], [212, 440], [215, 485],
        [250, 495], [360, 500], [470, 510], [560, 498], [620, 505], [765, 500]
      ]
    },
    velgrath: {
      name: "VELGRATH",
      subtitle: "The Iron East",
      labelAt: [580, 830],
      polygon: [
        [765, 500], [740, 940], [560, 955], [380, 945], [200, 950], [80, 930],
        [70, 760], [95, 620], [90, 580], [180, 560], [210, 520], [215, 485],
        [250, 495], [360, 500], [470, 510], [560, 498], [620, 505], [765, 500]
      ]
    }
  },

  // The great regions. Polygons are shaded; labels float above terrain.
  regions: [
    {
      id: "rimefang",
      name: "The Rimefang Mountains",
      kind: "mountains",
      labelAt: [665, 505],
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
      labelAt: [385, 503],
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
    { id: "thir", name: "The Thir", points: [[565, 520], [505, 515], [430, 508], [360, 502], [285, 494], [240, 488], [215, 485]] },
    { id: "thir-trib", name: "", points: [[470, 510], [440, 470], [400, 430], [380, 360]] }
  ],

  // Player-known roads. dashed:true = smuggling route / hidden trail.
  roads: [
    { from: "cantreval", to: "aurelonne", points: [[360, 230], [300, 300], [230, 332], [175, 360]] },
    { from: "cantreval", to: "lirewick", points: [[360, 230], [352, 330], [338, 400], [330, 450]] },
    { from: "cantreval", to: "brammer", points: [[360, 230], [305, 268], [255, 300]] },
    { from: "brammer", to: "aurelonne", points: [[255, 300], [212, 332], [175, 360]] },
    { from: "vorgrad", to: "kalteisen", points: [[430, 815], [505, 715], [560, 620]] },
    { from: "vorgrad", to: "mardrek", points: [[430, 815], [398, 688], [365, 560]] },
    { from: "cantreval", to: "thistlebank", dashed: true, points: [[360, 230], [430, 212], [478, 190], [500, 175]] },
    { from: "kalteisen", to: "stonehook", dashed: true, points: [[560, 620], [582, 562], [600, 510]] },
    { from: "stonehook", to: "kalvann-north", dashed: true, points: [[600, 510], [588, 470], [560, 442], [520, 430]] }
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
      pos: [360, 230], size: 40, seed: 1411, capital: true,
      landmarks: ["The Athenaeum — oldest library in the realm", "Protector's Bridge", "The Bell Market"],
      desc: "Kalvann's capital and oldest city — bridges, color, music, and informers. Home of the Athenaeum, the realm's oldest library."
    },
    {
      id: "aurelonne", name: "Aurelonne", type: "port", nation: "kalvann",
      pos: [175, 360], size: 34, seed: 2207,
      landmarks: ["The Long Docks", "Charter House", "The Saltgate"],
      desc: "Kalvann's great port on Lanthorne Bay and seat of the merchant houses. Half the world's smuggling is brokered here under honest letterhead."
    },
    {
      id: "lirewick", name: "Lirewick", type: "village", nation: "kalvann",
      pos: [330, 450], size: 18, seed: 333, start: true,
      landmarks: ["The Commons", "The Waystone Inn", "Old Chapel"],
      desc: "A small, tired Kalvanni border village on the edge of the Thir Vale. Where many a hard road begins."
    },
    {
      id: "thistlebank", name: "Thistlebank", type: "hidden", nation: "kalvann",
      pos: [500, 175], size: 16, seed: 909, hidden: true,
      landmarks: ["The Reading Halls", "Poets' Walk"],
      desc: "A hidden sanctuary of Kalvanni historians and poets. Hard to find on purpose — its place on any map is rumor more than record."
    },
    {
      id: "brammer", name: "Brammer's Hollow", type: "village", nation: "kalvann",
      pos: [255, 300], size: 18,  seed: 1717,
      landmarks: ["The Market Green", "The Old Mill", "Hollow Chapel"],
      desc: "A rural town the war has strangely spared. Outsiders are tolerated, not trusted."
    },
    {
      id: "vorgrad", name: "Vorgrad", type: "fortress-city", nation: "velgrath",
      pos: [430, 815], size: 40, seed: 4001, capital: true,
      landmarks: ["The Hammerhall", "The Iron Gate", "Bellspire"],
      desc: "Velgrath's capital — a tiered fortress-city of black stone and forge-smoke. Bells, not clocks, run the day."
    },
    {
      id: "kalteisen", name: "Kalteisen", type: "industrial", nation: "velgrath",
      pos: [560, 620], size: 32, seed: 5123,
      landmarks: ["Foundry Row", "The Ore Gate", "The Slag Yards"],
      desc: "Velgrath's industrial heart at the foot of the Rimefang. Mines, foundries, and war-engine yards under a brown sky."
    },
    {
      id: "mardrek", name: "Fort Mardrek", type: "fortress", nation: "velgrath",
      pos: [365, 560], size: 28, seed: 6611,
      landmarks: ["The Redoubt", "The Trench Lines", "The Muster Yard"],
      desc: "Velgrath's great border fortress facing the Thir Vale — less a fort than kilometres of trench, redoubt, and graveyard."
    },
    {
      id: "stonehook", name: "Stonehook", type: "mine-market", nation: "neutral",
      pos: [600, 510], size: 24, seed: 7777,
      landmarks: ["The Black Market", "The Old Adit", "The Truce Hall"],
      desc: "A played-out mine turned neutral black-market hub. Mercenaries, deserters, and spies from both sides drink at the same bar."
    }
  ]
};

if (typeof module !== "undefined") module.exports = WORLD;
