/* =====================================================================
 * THE SHATTERED CONCORD — Procedural detail generator
 * ---------------------------------------------------------------------
 * Deterministic (seeded) street + building generation so the board never
 * reshuffles between sessions. Towns are laid out like real cities: a
 * civic core (plaza, hall, temple, market), streets radiating or gridded
 * out from it, and differentiated buildings fronting those streets —
 * homes, shops, taverns, manors, warehouses, forges, barracks — zoned by
 * district. A collision pass keeps buildings from overlapping. All output
 * is in world units [y,x] and is player-safe.
 *
 * Output schema (rendered generically by map.js):
 *   { polygons:  [{points:[[y,x]..], cls}],
 *     polylines: [{points:[[y,x]..], cls, closed?}],
 *     markers:   [{pos:[y,x], label?, cls}] }
 * ===================================================================== */

const TownGen = (function () {
  // --- seeded RNG (mulberry32) -------------------------------------------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- geometry helpers ---------------------------------------------------
  const TAU = Math.PI * 2;
  function rot(dx, dy, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    return [dx * c - dy * s, dx * s + dy * c];
  }
  // rectangle centred at world [cy,cx]; w runs along `ang`, h is depth.
  function rect(cy, cx, w, h, ang) {
    const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    return pts.map(([dx, dy]) => { const [rx, ry] = rot(dx, dy, ang); return [cy + ry, cx + rx]; });
  }
  function ringPoly(cy, cx, r, n, jitterFn) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const rr = jitterFn ? r * jitterFn(i) : r;
      out.push([cy + Math.sin(a) * rr, cx + Math.cos(a) * rr]);
    }
    out.push(out[0]);
    return out;
  }
  function pip(pt, poly) { // ray casting; pt=[y,x]
    let inside = false, y = pt[0], x = pt[1];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
      const hit = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (hit) inside = !inside;
    }
    return inside;
  }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

  // --- building catalogue: depth (perp) & frontage (along street) ---------
  const B = {
    home:      { d: [2.0, 2.7], w: [2.2, 3.1], cls: "home" },
    hovel:     { d: [1.6, 2.2], w: [1.7, 2.4], cls: "home" },
    shop:      { d: [2.2, 2.9], w: [2.6, 3.5], cls: "shop" },
    tavern:    { d: [2.8, 3.5], w: [3.2, 4.2], cls: "tavern", glyph: "tavern" },
    manor:     { d: [3.4, 4.4], w: [4.2, 5.8], cls: "manor" },
    temple:    { d: [4.0, 5.0], w: [4.6, 6.2], cls: "temple", glyph: "temple" },
    civic:     { d: [4.4, 5.6], w: [5.4, 7.2], cls: "civic", glyph: "civic" },
    warehouse: { d: [3.4, 4.6], w: [5.0, 7.0], cls: "warehouse" },
    forge:     { d: [3.0, 4.0], w: [3.6, 4.8], cls: "forge", glyph: "forge" },
    barracks:  { d: [3.0, 3.6], w: [6.5, 9.5], cls: "barracks" },
    stall:     { d: [1.3, 1.8], w: [1.5, 2.1], cls: "stall" }
  };
  function span(rngf, range) { return range[0] + rngf() * (range[1] - range[0]); }
  function pick(rngf, pairs) {
    let s = 0; for (const p of pairs) s += p[1];
    let x = rngf() * s;
    for (const p of pairs) { if ((x -= p[1]) <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  }

  // district type mixes, keyed by normalised distance from the town centre
  function zoneSettled(t, r) {
    if (t < 0.30) return pick(r, [["shop", 6], ["tavern", 2], ["home", 2], ["manor", 1]]);
    if (t < 0.58) return pick(r, [["home", 5], ["shop", 3], ["tavern", 1], ["manor", 1]]);
    return pick(r, [["home", 9], ["shop", 1]]);
  }
  function zoneWater(t, r) { return pick(r, [["warehouse", 5], ["tavern", 3], ["shop", 3], ["home", 1]]); }
  function zoneMerchant(t, r) { return pick(r, [["manor", 5], ["shop", 3], ["home", 2]]); }
  function zoneWorker(t, r) { return pick(r, [["home", 7], ["forge", 2], ["tavern", 1], ["warehouse", 1]]); }
  function zoneFoundry(t, r) { return pick(r, [["forge", 5], ["warehouse", 4], ["barracks", 1]]); }
  function zoneRamshackle(t, r) { return pick(r, [["hovel", 6], ["tavern", 3], ["shop", 2], ["stall", 1]]); }

  // ======================================================================
  //  SETTLEMENTS
  // ======================================================================
  function generateTown(s) {
    const r = rng(s.seed);
    const out = { polygons: [], polylines: [], markers: [] };
    const [cy, cx] = s.pos;
    const R = s.size;
    const placed = [];
    const jit = () => 0.84 + r() * 0.30;
    const outline = ringPoly(cy, cx, R, 30, jit);
    const plazaR = R * 0.15;

    const add = {
      poly: (points, cls) => out.polygons.push({ points, cls }),
      line: (points, cls, closed) => out.polylines.push({ points, cls, closed: !!closed }),
      mark: (pos, cls, label) => out.markers.push({ pos, cls, label })
    };
    function collide(py, px, rad) {
      for (const q of placed) {
        const dy = py - q[0], dx = px - q[1], rr = (rad + q[2]) * 0.84;
        if (dy * dy + dx * dx < rr * rr) return true;
      }
      return false;
    }
    // place a building; respects outline, plaza, and collisions
    function place(py, px, ang, type, opt) {
      opt = opt || {};
      const spec = B[type] || B.home;
      const w = span(r, spec.w), d = span(r, spec.d);
      const rad = Math.hypot(w, d) / 2;
      if (!opt.force && !pip([py, px], outline)) return false;
      if (!opt.keepCore && dist([py, px], [cy, cx]) < plazaR) return false;
      if (collide(py, px, rad)) return false;
      add.poly(rect(py, px, w, d, ang), spec.cls);
      placed.push([py, px, rad]);
      if (spec.glyph) {
        const prob = spec.glyph === "tavern" ? 0.7 : spec.glyph === "forge" ? 0.8 : 1;
        if (r() <= prob) add.mark([py, px], spec.glyph);
      }
      return true;
    }
    // lay a row of buildings fronting a street segment, both sides
    function placeRow(p0, p1, opt) {
      opt = opt || {};
      const setback = opt.setback != null ? opt.setback : 3.0;
      const pitch = opt.pitch != null ? opt.pitch : 3.2;
      const jitter = opt.jitter != null ? opt.jitter : 0.22;
      const sides = opt.sides || [-1, 1];
      const zone = opt.zone || zoneSettled;
      const len = dist(p0, p1); if (len < 1) return;
      const ay = (p1[0] - p0[0]) / len, ax = (p1[1] - p0[1]) / len;
      const ny = -ax, nx = ay;               // unit normal in [y,x]
      const ang = Math.atan2(ay, ax);
      const n = Math.max(1, Math.floor(len / pitch));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const my = p0[0] + (p1[0] - p0[0]) * t;
        const mx = p0[1] + (p1[1] - p0[1]) * t;
        for (const side of sides) {
          const off = setback + (r() - 0.5) * 0.8;
          const py = my + ny * side * off + (r() - 0.5) * 0.6;
          const px = mx + nx * side * off + (r() - 0.5) * 0.6;
          const type = zone(dist([py, px], [cy, cx]) / R, r);
          place(py, px, ang + (r() - 0.5) * jitter, type);
        }
      }
    }
    // scatter infill buildings into open ground (collision-thinned)
    function scatter(n, zone, rMin, rMax) {
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, rr = (rMin + r() * (rMax - rMin)) * R;
        place(cy + Math.sin(a) * rr, cx + Math.cos(a) * rr, r() * TAU, zone(rr / R, r));
      }
    }
    // central civic ensemble shared by most towns
    function civicCore(opt) {
      opt = opt || {};
      add.poly(ringPoly(cy, cx, plazaR, 16, () => 1), "plaza");
      // town hall / keep, just off centre
      place(cy + R * 0.05, cx - R * 0.02, r() * 0.3, "civic", { force: true, keepCore: true });
      if (opt.temple !== false) {
        const a = 1.4 + r();
        place(cy + Math.sin(a) * plazaR * 1.7, cx + Math.cos(a) * plazaR * 1.7, r() * TAU, "temple", { keepCore: true });
      }
      if (opt.market !== false) {
        // a ring of market stalls around the plaza
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * TAU + r() * 0.2;
          const rr = plazaR * (1.25 + r() * 0.35);
          place(cy + Math.sin(a) * rr, cx + Math.cos(a) * rr, a, "stall", { keepCore: true });
        }
        add.mark([cy - plazaR * 1.7, cx], "district", "Market");
      }
    }
    function gates(spokes, a0) {
      for (let i = 0; i < spokes; i += 2) {
        const a = a0 + (i / spokes) * TAU;
        add.mark([cy + Math.sin(a) * R, cx + Math.cos(a) * R], "spire");
      }
    }

    // ---- archetype dispatch ------------------------------------------------
    if (s.type === "city" || s.type === "fortress-city") {
      const fortress = s.type === "fortress-city";
      add.line(ringPoly(cy, cx, R, 36, jit), "wall", true);
      if (fortress) add.line(ringPoly(cy, cx, R * 0.40, 22, jit), "citadel", true);

      civicCore({ market: !fortress, temple: true });

      // concentric ring roads
      const rings = fortress ? [0.55, 0.82] : [0.46, 0.70, 0.90];
      rings.forEach(f => {
        const ring = ringPoly(cy, cx, R * f, 40, () => 1);
        add.line(ring, "lane");
        for (let i = 0; i < ring.length - 1; i++) {
          placeRow(ring[i], ring[i + 1], { zone: fortress ? zoneWorker : zoneSettled, setback: 2.6, pitch: 3.0, sides: [1] });
        }
      });
      // radial avenues lined both sides
      const spokes = fortress ? 7 : 8;
      const a0 = r() * TAU;
      for (let i = 0; i < spokes; i++) {
        const a = a0 + (i / spokes) * TAU;
        const p0 = [cy + Math.sin(a) * R * (fortress ? 0.42 : plazaR / R * 1.1), cx + Math.cos(a) * R * (fortress ? 0.42 : plazaR / R * 1.1)];
        const p1 = [cy + Math.sin(a) * R * 0.97, cx + Math.cos(a) * R * 0.97];
        add.line([p0, p1], "street");
        placeRow(p0, p1, { zone: fortress ? zoneWorker : zoneSettled, setback: 3.0, pitch: 3.2 });
      }
      gates(spokes, a0);

      if (fortress) {
        // a forge district along the north-east arc + barracks in the citadel
        const fa = a0 + 0.8;
        const fc = [cy + Math.sin(fa) * R * 0.62, cx + Math.cos(fa) * R * 0.62];
        for (let i = 0; i < 14; i++) {
          const a = fa + (r() - 0.5) * 1.1, rr = R * (0.45 + r() * 0.35);
          place(cy + Math.sin(a) * rr, cx + Math.cos(a) * rr, r() * TAU, zoneFoundry(0, r));
        }
        add.mark(fc, "district", "Forges");
        for (let i = 0; i < 6; i++) {
          const a = r() * TAU, rr = r() * R * 0.34;
          place(cy + Math.sin(a) * rr, cx + Math.cos(a) * rr, a, "barracks", { keepCore: true });
        }
      } else {
        // Cantreval: a river of canals with bridges + a merchant quarter
        const ry = cy + (r() - 0.5) * 8;
        const river = [];
        for (let i = 0; i <= 10; i++) { const t = i / 10; river.push([ry + Math.sin(t * 6) * 6, cx - R * 1.05 + t * R * 2.1]); }
        add.line(river, "river");
        for (let i = 2; i < 9; i += 3) { add.mark(river[i], "bridge"); placeRow([river[i - 1], river[i + 1]], { zone: zoneWater, setback: 4, pitch: 3.2, sides: [-1, 1] }); }
        const ma = a0 + 2.0;
        for (let i = 0; i < 10; i++) { const a = ma + (r() - 0.5) * 0.9, rr = R * (0.4 + r() * 0.4); place(cy + Math.sin(a) * rr, cx + Math.cos(a) * rr, r() * TAU, zoneMerchant(0, r)); }
      }
      scatter(fortress ? 60 : 40, fortress ? zoneWorker : zoneSettled, 0.3, 0.95);
    }

    else if (s.type === "industrial") {
      const ang = 0.18;
      // gridded streets
      const S = R / 4.5;
      for (let g = -R; g <= R; g += S) {
        const a = [cy + rot(g, -R, ang)[1], cx + rot(g, -R, ang)[0]];
        const b = [cy + rot(g, R, ang)[1], cx + rot(g, R, ang)[0]];
        add.line([a, b], "lane");
        placeRow(a, b, { zone: zoneWorker, setback: 2.8, pitch: 3.0 });
        const c = [cy + rot(-R, g, ang)[1], cx + rot(-R, g, ang)[0]];
        const d = [cy + rot(R, g, ang)[1], cx + rot(R, g, ang)[0]];
        add.line([c, d], "lane");
      }
      civicCore({ market: false, temple: false });
      // foundry district (south-west cluster) with smokestacks
      const fc = [cy - R * 0.4, cx - R * 0.35];
      for (let i = 0; i < 16; i++) {
        const a = r() * TAU, rr = r() * R * 0.5;
        place(fc[0] + Math.sin(a) * rr, fc[1] + Math.cos(a) * rr, ang + (r() - 0.5) * 0.4, zoneFoundry(0, r));
      }
      add.mark(fc, "district", "Foundry Row");
      scatter(40, zoneWorker, 0.25, 0.95);
      add.line(ringPoly(cy, cx, R * 1.02, 24, jit), "wall", true);
      add.mark([cy + R, cx], "spire");
    }

    else if (s.type === "fortress") {
      // star fort facing the Vale (west), with trench lines and a sutler camp
      const bast = 7, pts = [];
      for (let i = 0; i < bast * 2; i++) {
        const a = (i / (bast * 2)) * TAU;
        const rr = i % 2 ? R * 0.64 : R;
        pts.push([cy + Math.sin(a) * rr, cx + Math.cos(a) * rr]);
      }
      pts.push(pts[0]);
      add.line(pts, "bastion", true);
      add.poly(ringPoly(cy, cx, R * 0.20, 12, () => 1), "plaza");        // muster yard
      add.mark([cy, cx], "district", "Muster Yard");
      place(cy, cx + R * 0.04, 0, "civic", { force: true, keepCore: true });
      // barracks blocks inside
      for (let i = 0; i < 10; i++) {
        const a = r() * TAU, rr = r() * R * 0.55;
        place(cy + Math.sin(a) * rr, cx + Math.cos(a) * rr, a, "barracks", { keepCore: true });
      }
      // concentric trench lines on the west (Vale-facing) side
      for (let k = 1; k <= 3; k++) {
        const tr = [], rr = R * (1 + k * 0.45);
        for (let i = 0; i <= 16; i++) {
          const a = Math.PI * 0.42 + (i / 16) * Math.PI * 1.16;
          tr.push([cy + Math.sin(a) * rr + (r() - 0.5) * 5, cx + Math.cos(a) * rr + (r() - 0.5) * 5]);
        }
        add.line(tr, "trench");
      }
      // a small sutlers' camp behind the fort (east)
      const sc = [cy + R * 0.2, cx + R * 0.9];
      for (let i = 0; i < 9; i++) { const a = r() * TAU, rr = r() * R * 0.35; place(sc[0] + Math.sin(a) * rr, sc[1] + Math.cos(a) * rr, r() * TAU, pick(r, [["tavern", 2], ["stall", 3], ["hovel", 3]])); }
    }

    else if (s.type === "village" || s.type === "hidden") {
      const hidden = s.type === "hidden";
      const dir = r() * TAU;
      // a main road through town
      const road = [
        [cy - Math.sin(dir) * R * 1.25, cx - Math.cos(dir) * R * 1.25],
        [cy + (r() - 0.5) * 6, cx + (r() - 0.5) * 6],
        [cy + Math.sin(dir) * R * 1.25, cx + Math.cos(dir) * R * 1.25]
      ];
      add.line(road, hidden ? "trail" : "street");
      if (!hidden) { placeRow(road[0], road[1], { setback: 3.0, pitch: 3.0 }); placeRow(road[1], road[2], { setback: 3.0, pitch: 3.0 }); }
      // cross lanes
      const lanes = hidden ? 2 : 3;
      for (let i = 0; i < lanes; i++) {
        const a = dir + Math.PI / 2 + (r() - 0.5) * 0.8;
        const L = [[cy, cx], [cy + Math.sin(a) * R * 0.95, cx + Math.cos(a) * R * 0.95]];
        add.line(L, hidden ? "trail" : "lane");
        placeRow(L[0], L[1], { zone: hidden ? (() => "home") : zoneSettled, setback: 2.6, pitch: 3.0 });
      }
      // commons / green + chapel + tavern
      add.poly(ringPoly(cy, cx, R * 0.16, 12, () => 1), hidden ? "glade" : "plaza");
      place(cy + (r() - 0.5) * R * 0.3, cx + (r() - 0.5) * R * 0.3, r(), "temple", { keepCore: true });
      if (!hidden) {
        place(cy + Math.sin(dir + 1) * R * 0.4, cx + Math.cos(dir + 1) * R * 0.4, r(), "tavern", { keepCore: true });
        place(cy + Math.sin(dir - 1) * R * 0.45, cx + Math.cos(dir - 1) * R * 0.45, r(), "forge", { keepCore: true });
      }
      scatter(hidden ? 10 : 18, hidden ? (() => "home") : zoneSettled, 0.2, 0.95);
      if (hidden) {
        // quiet gardens
        for (let i = 0; i < 4; i++) { const a = r() * TAU, rr = (0.4 + r() * 0.5) * R; const g = [cy + Math.sin(a) * rr, cx + Math.cos(a) * rr]; add.poly(ringPoly(g[0], g[1], 4 + r() * 3, 10, () => 0.8 + r() * 0.4), "glade"); }
      } else {
        // faint fields around open rural towns
        for (let i = 0; i < 12; i++) { const a = r() * TAU, rr = (1.15 + r() * 0.6) * R; add.poly(rect(cy + Math.sin(a) * rr, cx + Math.cos(a) * rr, 14 + r() * 10, 9 + r() * 7, a), "field"); }
      }
      if (s.id === "lirewick") add.line(ringPoly(cy, cx, R * 1.08, 22, jit), "palisade", true);
    }

    else if (s.type === "mine-market") {
      add.line(ringPoly(cy, cx, R * 1.05, 22, jit), "palisade", true);
      // mine adits cut into the slope to the north (higher y)
      for (let i = 0; i < 3; i++) {
        const ax = cx + (i - 1) * R * 0.5;
        add.poly(rect(cy + R * 0.9, ax, 8, 6, 0), "adit");
        add.line([[cy + R * 0.9, ax], [cy + R * 1.6 + r() * 20, ax + (r() - 0.5) * 20]], "tunnel");
        add.mark([cy + R * 0.9, ax], "adit");
      }
      // a rough market with the Truce Hall
      civicCore({ market: true, temple: false });
      add.mark([cy - plazaR * 1.7, cx], "district", "Black Market");
      // a couple of lanes lined with taverns & shacks
      for (let i = 0; i < 3; i++) {
        const a = r() * TAU;
        const L = [[cy, cx], [cy + Math.sin(a) * R * 0.85, cx + Math.cos(a) * R * 0.85]];
        add.line(L, "lane");
        placeRow(L[0], L[1], { zone: zoneRamshackle, setback: 2.6, pitch: 2.9 });
      }
      scatter(24, zoneRamshackle, 0.25, 0.95);
    }

    // ports get a quay, docks, warehouses, and an inland grid
    if (s.type === "port") {
      add.line(ringPoly(cy, cx, R, 28, jit), "wall", true);
      civicCore({ market: true, temple: true });
      // quay street along the south (water) edge
      const quayY = cy - R * 0.72;
      const quay = [[quayY, cx - R * 0.85], [quayY + 4, cx], [quayY, cx + R * 0.85]];
      add.line(quay, "dock");
      placeRow(quay[0], quay[1], { zone: zoneWater, setback: 3.6, pitch: 3.2, sides: [1] });
      placeRow(quay[1], quay[2], { zone: zoneWater, setback: 3.6, pitch: 3.2, sides: [1] });
      add.mark([quayY - 3, cx], "district", "The Long Docks");
      // piers reaching into the water (south)
      for (let i = 0; i < 6; i++) {
        const dx = cx - R * 0.7 + i * R * 0.28;
        add.line([[quayY - 2, dx], [quayY - R * 0.7, dx]], "dock");
        if (r() > 0.4) add.mark([quayY - R * 0.72, dx], "ship");
      }
      // inland grid: shops near the quay grading to homes; a merchant row
      const S = R / 4;
      for (let g = -R * 0.8; g <= R * 0.8; g += S) {
        add.line([[cy - R * 0.55, cx + g], [cy + R * 0.9, cx + g]], "lane");
        placeRow([cy - R * 0.5, cx + g], [cy + R * 0.9, cx + g], { zone: zoneSettled, setback: 2.7, pitch: 3.0 });
      }
      for (let i = 0; i < 8; i++) { const a = 0.3 + r() * 0.9, rr = R * (0.5 + r() * 0.4); place(cy + Math.sin(a) * rr, cx + Math.cos(a) * rr, r() * TAU, zoneMerchant(0, r)); }
      scatter(26, zoneSettled, 0.3, 0.92);
    }

    // landmark labels (player-safe) placed around the centre
    (s.landmarks || []).forEach((name, i) => {
      const a = (i / Math.max(1, s.landmarks.length)) * TAU + 0.6;
      add.mark([cy + Math.sin(a) * R * 0.62, cx + Math.cos(a) * R * 0.62], "landmark", name);
    });

    return out;
  }

  // ======================================================================
  //  WILD REGIONS — trails, passes, desert features (unchanged behaviour)
  // ======================================================================
  function randomWalk(r, start, poly, steps, stepLen, wander) {
    const pts = [start.slice()];
    let dir = r() * TAU, cur = start.slice();
    for (let i = 0; i < steps; i++) {
      dir += (r() - 0.5) * wander;
      const next = [cur[0] + Math.sin(dir) * stepLen, cur[1] + Math.cos(dir) * stepLen];
      if (!pip(next, poly)) { dir += Math.PI; continue; }
      pts.push(next); cur = next;
    }
    return pts;
  }

  function generateRegionDetail(region) {
    const r = rng((region.id || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 7) * 97 + 13);
    const out = { polygons: [], polylines: [], markers: [] };
    const poly = region.polygon;
    let minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9;
    poly.forEach(p => { minY = Math.min(minY, p[0]); maxY = Math.max(maxY, p[0]); minX = Math.min(minX, p[1]); maxX = Math.max(maxX, p[1]); });
    const rin = () => { for (let k = 0; k < 40; k++) { const p = [minY + r() * (maxY - minY), minX + r() * (maxX - minX)]; if (pip(p, poly)) return p; } return [(minY + maxY) / 2, (minX + maxX) / 2]; };

    if (region.kind === "forest") {
      for (let i = 0; i < 7; i++) out.polylines.push({ points: randomWalk(r, rin(), poly, 26, 9, 1.1), cls: "trail" });
      for (let i = 0; i < 6; i++) { const g = rin(); out.polygons.push({ points: ringPoly(g[0], g[1], 6 + r() * 6, 12, () => 0.8 + r() * 0.4), cls: "glade" }); out.markers.push({ pos: g, cls: "glade" }); }
    } else if (region.kind === "mountains") {
      for (let i = 0; i < 4; i++) {
        const y = minY + (0.25 + i * 0.18) * (maxY - minY);
        const pass = [];
        for (let x = minX; x <= maxX; x += (maxX - minX) / 10) { const p = [y + Math.sin(x / 25 + i) * 14, x]; if (pip(p, poly)) pass.push(p); }
        if (pass.length > 2) out.polylines.push({ points: pass, cls: "tunnel" });
      }
      for (let i = 0; i < 5; i++) { const a = rin(); out.markers.push({ pos: a, cls: "adit" }); }
    } else if (region.kind === "desert") {
      for (let i = 0; i < 8; i++) {
        const y = minY + r() * (maxY - minY), dune = [];
        for (let x = minX; x <= maxX; x += (maxX - minX) / 12) { const p = [y + Math.sin(x / 18 + i) * 10, x]; if (pip(p, poly)) dune.push(p); }
        if (dune.length > 2) out.polylines.push({ points: dune, cls: "dune" });
      }
      for (let i = 0; i < 5; i++) { const g = rin(); out.polygons.push({ points: ringPoly(g[0], g[1], 8 + r() * 10, 6, () => 0.6 + r() * 0.7), cls: "glass" }); }
      for (let i = 0; i < 3; i++) out.polylines.push({ points: randomWalk(r, rin(), poly, 18, 10, 0.7), cls: "path" });
    } else if (region.kind === "warland") {
      for (let i = 0; i < 18; i++) { const c = rin(); out.polygons.push({ points: ringPoly(c[0], c[1], 2 + r() * 4, 8, () => 0.7 + r() * 0.5), cls: "crater" }); }
      for (let i = 0; i < 6; i++) {
        const s0 = rin(), seg = [s0];
        let d = (r() - 0.5) * 1 + Math.PI / 2;
        for (let k = 0; k < 5; k++) { const n = [seg[seg.length - 1][0] + Math.sin(d) * 8, seg[seg.length - 1][1] + Math.cos(d) * 8]; if (pip(n, poly)) seg.push(n); d += (r() - 0.5) * 0.8; }
        if (seg.length > 2) out.polylines.push({ points: seg, cls: "trench" });
      }
    }
    return out;
  }

  return { generateTown, generateRegionDetail };
})();

if (typeof module !== "undefined") module.exports = TownGen;
