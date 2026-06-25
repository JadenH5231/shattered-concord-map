/* =====================================================================
 * THE SHATTERED CONCORD — Procedural detail generator
 * ---------------------------------------------------------------------
 * Deterministic (seeded) street/building/trail generation so the board
 * never reshuffles between sessions. All output is in world units [y,x].
 *
 * Output schema (rendered generically by map.js):
 *   { polygons:  [{points:[[y,x]..], cls}],
 *     polylines: [{points:[[y,x]..], cls, closed?}],
 *     markers:   [{pos:[y,x], label?, cls}] }
 *
 * cls values: wall, citadel, street, lane, river, bridge, building,
 *   block, hall, landmark, plaza, field, palisade, trench, bastion,
 *   adit, stall, tunnel, trail, glade, glass, dune, path, crater,
 *   smokestack, spire, dock, ship.
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
  // rectangle centred at world [cy,cx], width w (along angle), height h, ang radians
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

  // ======================================================================
  //  SETTLEMENTS
  // ======================================================================
  function generateTown(s) {
    const r = rng(s.seed);
    const out = { polygons: [], polylines: [], markers: [] };
    const [cy, cx] = s.pos;
    const R = s.size;
    const jit = () => 0.86 + r() * 0.28;

    const add = {
      poly: (points, cls) => out.polygons.push({ points, cls }),
      line: (points, cls, closed) => out.polylines.push({ points, cls, closed: !!closed }),
      mark: (pos, cls, label) => out.markers.push({ pos, cls, label })
    };

    function building(py, px, ang, scale, cls) {
      const w = (5 + r() * 6) * (scale || 1);
      const h = (4 + r() * 5) * (scale || 1);
      add.poly(rect(py, px, w, h, ang), cls || "building");
    }
    // lay buildings along a street segment, both sides
    function lineBuildings(p0, p1, density, setback, cls, skipCenterR) {
      const len = dist(p0, p1);
      const ang = Math.atan2(p1[1] - p0[1], p0[0] - p1[0]); // street direction angle (x,y)
      const n = Math.max(1, Math.floor(len / (10 / density)));
      const nx = (p1[0] - p0[0]) / len, ny = -(p1[1] - p0[1]) / len; // normal-ish in [y,x]
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const my = p0[0] + (p1[0] - p0[0]) * t;
        const mx = p0[1] + (p1[1] - p0[1]) * t;
        for (const side of [-1, 1]) {
          const off = setback + r() * 3;
          const by = my + ny * off * side + (r() - 0.5) * 2;
          const bx = mx + nx * off * side + (r() - 0.5) * 2;
          if (skipCenterR && dist([by, bx], [cy, cx]) < skipCenterR) continue;
          if (dist([by, bx], [cy, cx]) > R * 1.05) continue;
          if (r() > 0.22) building(by, bx, ang + (r() - 0.5) * 0.5, 1, cls);
        }
      }
    }

    // ---- archetype dispatch ------------------------------------------------
    if (s.type === "city" || s.type === "fortress-city") {
      const fortress = s.type === "fortress-city";
      // outer wall
      add.line(ringPoly(cy, cx, R, 26, jit), "wall", true);
      if (fortress) add.line(ringPoly(cy, cx, R * 0.42, 18, jit), "citadel", true);
      // ring roads
      const rings = fortress ? [0.55, 0.82] : [0.45, 0.72, 0.92];
      rings.forEach(f => add.line(ringPoly(cy, cx, R * f, 30, () => 1), fortress ? "lane" : "lane"));
      // radial spokes
      const spokes = fortress ? 6 : 8;
      const a0 = r() * TAU;
      for (let i = 0; i < spokes; i++) {
        const a = a0 + (i / spokes) * TAU;
        const p0 = [cy + Math.sin(a) * R * 0.12, cx + Math.cos(a) * R * 0.12];
        const p1 = [cy + Math.sin(a) * R * 0.98, cx + Math.cos(a) * R * 0.98];
        add.line([p0, p1], "street");
        lineBuildings(p0, p1, fortress ? 0.8 : 1.1, fortress ? 7 : 5, fortress ? "block" : "building", R * 0.18);
      }
      // central plaza + landmark hall
      add.poly(ringPoly(cy, cx, R * 0.14, 16, () => 1), "plaza");
      add.poly(rect(cy + R * 0.04, cx, R * 0.22, R * 0.16, r() * 0.4), "hall");
      // a river with bridges for canal-cities (Cantreval)
      if (s.id === "cantreval") {
        const ry = cy + (r() - 0.5) * 6;
        const river = [];
        for (let i = 0; i <= 8; i++) {
          const t = i / 8;
          river.push([ry + Math.sin(t * 6) * 5, cx - R * 1.05 + t * R * 2.1]);
        }
        add.line(river, "river");
        for (let i = 1; i < 8; i += 3) add.mark(river[i], "bridge");
      }
      // gate markers
      for (let i = 0; i < spokes; i += 2) {
        const a = a0 + (i / spokes) * TAU;
        add.mark([cy + Math.sin(a) * R, cx + Math.cos(a) * R], "spire");
      }
    }

    else if (s.type === "industrial") {
      // brown grid town: orthogonal streets + big foundry blocks
      const ang = 0.18; // slight tilt
      const half = R;
      for (let gx = -half; gx <= half; gx += R / 4) {
        const a = [cy + rot(gx, -half, ang)[1], cx + rot(gx, -half, ang)[0]];
        const b = [cy + rot(gx, half, ang)[1], cx + rot(gx, half, ang)[0]];
        add.line([a, b], "lane");
      }
      for (let gy = -half; gy <= half; gy += R / 4) {
        const a = [cy + rot(-half, gy, ang)[1], cx + rot(-half, gy, ang)[0]];
        const b = [cy + rot(half, gy, ang)[1], cx + rot(half, gy, ang)[0]];
        add.line([a, b], "lane");
      }
      // industrial blocks
      for (let i = 0; i < 26; i++) {
        const gy = (Math.floor(r() * 4) - 2) * (R / 4) + R / 8;
        const gx = (Math.floor(r() * 4) - 2) * (R / 4) + R / 8;
        const [px, py] = rot(gx, gy, ang);
        const by = cy + py, bx = cx + px;
        if (dist([by, bx], [cy, cx]) > R) continue;
        const big = r() > 0.5;
        add.poly(rect(by, bx, big ? R / 4.4 : R / 8, big ? R / 5 : R / 9, ang), big ? "block" : "building");
        if (big && r() > 0.5) add.mark([by, bx], "smokestack");
      }
      add.line(ringPoly(cy, cx, R * 1.02, 22, jit), "wall", true);
    }

    else if (s.type === "fortress") {
      // star fort + trench lines facing the Vale (west, toward lower x)
      const bast = 7, pts = [];
      for (let i = 0; i < bast * 2; i++) {
        const a = (i / (bast * 2)) * TAU;
        const rr = i % 2 ? R * 0.66 : R;
        pts.push([cy + Math.sin(a) * rr, cx + Math.cos(a) * rr]);
      }
      pts.push(pts[0]);
      add.line(pts, "bastion", true);
      // inner barracks blocks
      for (let i = 0; i < 8; i++) {
        const a = r() * TAU, rr = r() * R * 0.5;
        add.poly(rect(cy + Math.sin(a) * rr, cx + Math.cos(a) * rr, R / 5, R / 7, a), "block");
      }
      add.poly(ringPoly(cy, cx, R * 0.18, 12, () => 1), "plaza"); // muster yard
      // concentric trench lines on the west (Vale-facing) side
      for (let k = 1; k <= 3; k++) {
        const tr = [];
        const rr = R * (1 + k * 0.5);
        for (let i = 0; i <= 14; i++) {
          const a = Math.PI * 0.45 + (i / 14) * Math.PI * 1.1; // west-facing arc
          tr.push([cy + Math.sin(a) * rr + (r() - 0.5) * 5, cx + Math.cos(a) * rr + (r() - 0.5) * 5]);
        }
        add.line(tr, "trench");
      }
    }

    else if (s.type === "village" || s.type === "hidden") {
      const hidden = s.type === "hidden";
      // a main road bending through town
      const dir = r() * TAU;
      const main = [];
      for (let i = -1; i <= 1; i++) {
        const a = dir + i * 0.5;
        main.push([cy + Math.sin(a) * R * 1.1 * i + (i === 0 ? 0 : 0), cx + Math.cos(a) * R * 1.1 * i]);
      }
      const road = [
        [cy - Math.sin(dir) * R * 1.2, cx - Math.cos(dir) * R * 1.2],
        [cy + (r() - 0.5) * 8, cx + (r() - 0.5) * 8],
        [cy + Math.sin(dir) * R * 1.2, cx + Math.cos(dir) * R * 1.2]
      ];
      add.line(road, hidden ? "trail" : "street");
      // a couple of lanes
      const lanes = hidden ? 1 : 2 + Math.floor(r() * 2);
      for (let i = 0; i < lanes; i++) {
        const a = dir + Math.PI / 2 + (r() - 0.5);
        const L = [[cy, cx], [cy + Math.sin(a) * R * 0.9, cx + Math.cos(a) * R * 0.9]];
        add.line(L, hidden ? "trail" : "lane");
        if (!hidden) lineBuildings(L[0], L[1], 0.9, 4, "building", R * 0.12);
      }
      // cluster of cottages near the crossing
      const count = hidden ? 6 : 14 + Math.floor(r() * 8);
      for (let i = 0; i < count; i++) {
        const a = r() * TAU, rr = (0.15 + r() * 0.8) * R;
        const by = cy + Math.sin(a) * rr, bx = cx + Math.cos(a) * rr;
        building(by, bx, r() * TAU, hidden ? 0.8 : 0.9, "building");
      }
      // central commons / a slightly grand hall (chapel / reading halls)
      add.poly(ringPoly(cy, cx, R * 0.16, 12, () => 1), "plaza");
      const hy = cy + (r() - 0.5) * R * 0.3, hx = cx + (r() - 0.5) * R * 0.3;
      add.poly(rect(hy, hx, R * 0.2, R * 0.15, r()), "hall");
      add.mark([hy, hx], "spire");
      // palisade for the border village; none for hidden/open towns
      if (s.id === "lirewick") add.line(ringPoly(cy, cx, R * 1.05, 20, jit), "palisade", true);
      // faint fields around open rural towns
      if (!hidden) {
        for (let i = 0; i < 10; i++) {
          const a = r() * TAU, rr = (1.15 + r() * 0.6) * R;
          const fy = cy + Math.sin(a) * rr, fx = cx + Math.cos(a) * rr;
          add.poly(rect(fy, fx, 14 + r() * 10, 9 + r() * 7, a), "field");
        }
      }
    }

    else if (s.type === "mine-market") {
      // irregular cluster against the mountain (north = higher y)
      add.line(ringPoly(cy, cx, R * 1.04, 20, jit), "palisade", true);
      // mine adits cut into the slope to the north
      for (let i = 0; i < 3; i++) {
        const ax = cx + (i - 1) * R * 0.5;
        add.poly(rect(cy + R * 0.9, ax, 8, 6, 0), "adit");
        add.line([[cy + R * 0.9, ax], [cy + R * 1.6 + r() * 20, ax + (r() - 0.5) * 20]], "tunnel");
        add.mark([cy + R * 0.9, ax], "adit");
      }
      // market stalls grid in the centre
      for (let gy = -2; gy <= 2; gy++) for (let gx = -3; gx <= 3; gx++) {
        if (r() > 0.7) continue;
        add.poly(rect(cy + gy * 7, cx + gx * 6, 4, 3.5, 0), "stall");
      }
      // ramshackle buildings around
      for (let i = 0; i < 20; i++) {
        const a = r() * TAU, rr = (0.4 + r() * 0.6) * R;
        building(cy + Math.sin(a) * rr, cx + Math.cos(a) * rr, r() * TAU, 0.9, "building");
      }
      // the Truce Hall (a larger neutral building)
      add.poly(rect(cy - R * 0.3, cx, R * 0.24, R * 0.18, 0.2), "hall");
    }

    // landmark labels (player-safe) placed around the centre
    (s.landmarks || []).forEach((name, i) => {
      const a = (i / Math.max(1, s.landmarks.length)) * TAU + 0.6;
      add.mark([cy + Math.sin(a) * R * 0.5, cx + Math.cos(a) * R * 0.5], "landmark", name);
    });

    // docks for the port (Aurelonne sits on the bay → water to the south)
    if (s.type === "port") {
      add.line(ringPoly(cy, cx, R, 24, jit), "wall", true);
      for (let i = 0; i < 8; i++) {
        const a = r() * TAU, rr = r() * R * 0.8;
        building(cy + Math.sin(a) * rr, cx + Math.cos(a) * rr, r() * TAU, 1, "building");
      }
      for (let i = 0; i < 5; i++) {
        const dx = cx - R * 0.6 + i * R * 0.3;
        add.line([[cy - R * 0.9, dx], [cy - R * 1.5, dx]], "dock");
        if (r() > 0.4) add.mark([cy - R * 1.6, dx], "ship");
      }
      add.poly(rect(cy, cx, R * 0.22, R * 0.16, 0.1), "hall");
    }

    return out;
  }

  // ======================================================================
  //  WILD REGIONS — trails, passes, desert features
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
    // bounding box
    let minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9;
    poly.forEach(p => { minY = Math.min(minY, p[0]); maxY = Math.max(maxY, p[0]); minX = Math.min(minX, p[1]); maxX = Math.max(maxX, p[1]); });
    const rin = () => { for (let k = 0; k < 40; k++) { const p = [minY + r() * (maxY - minY), minX + r() * (maxX - minX)]; if (pip(p, poly)) return p; } return [(minY + maxY) / 2, (minX + maxX) / 2]; };

    if (region.kind === "forest") {
      for (let i = 0; i < 7; i++) out.polylines.push({ points: randomWalk(r, rin(), poly, 26, 9, 1.1), cls: "trail" });
      for (let i = 0; i < 6; i++) { const g = rin(); out.polygons.push({ points: ringPoly(g[0], g[1], 6 + r() * 6, 12, () => 0.8 + r() * 0.4), cls: "glade" }); out.markers.push({ pos: g, cls: "glade" }); }
    } else if (region.kind === "mountains") {
      // smuggling passes thread roughly W-E through the range
      for (let i = 0; i < 4; i++) {
        const y = minY + (0.25 + i * 0.18) * (maxY - minY);
        const pass = [];
        for (let x = minX; x <= maxX; x += (maxX - minX) / 10) { const p = [y + Math.sin(x / 25 + i) * 14, x]; if (pip(p, poly)) pass.push(p); }
        if (pass.length > 2) out.polylines.push({ points: pass, cls: "tunnel" });
      }
      for (let i = 0; i < 5; i++) { const a = rin(); out.markers.push({ pos: a, cls: "adit" }); }
    } else if (region.kind === "desert") {
      // ash dunes (wavy lines) + glass fields (angular polygons) + faint paths
      for (let i = 0; i < 8; i++) {
        const y = minY + r() * (maxY - minY), dune = [];
        for (let x = minX; x <= maxX; x += (maxX - minX) / 12) { const p = [y + Math.sin(x / 18 + i) * 10, x]; if (pip(p, poly)) dune.push(p); }
        if (dune.length > 2) out.polylines.push({ points: dune, cls: "dune" });
      }
      for (let i = 0; i < 5; i++) { const g = rin(); out.polygons.push({ points: ringPoly(g[0], g[1], 8 + r() * 10, 6, () => 0.6 + r() * 0.7), cls: "glass" }); }
      for (let i = 0; i < 3; i++) out.polylines.push({ points: randomWalk(r, rin(), poly, 18, 10, 0.7), cls: "path" });
    } else if (region.kind === "warland") {
      // the Thir Vale: craters + broken trench segments (no-man's-land texture)
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
