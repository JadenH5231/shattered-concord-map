/* =====================================================================
 * THE SHATTERED CONCORD — Map engine (Leaflet, CRS.Simple)
 * Zoom-tiered detail: continent → region → street, with a toggleable
 * square/hex D&D battle grid. All content is player-safe.
 * ===================================================================== */
(function () {
  "use strict";

  // ---- zoom thresholds --------------------------------------------------
  const Z = {
    regionLabel: -1,   // region names appear
    routes: 0,         // roads + rivers
    townLabel: 0,      // non-capital town names
    terrain: 0,        // terrain texture (chevrons/trees/dots)
    front: -0.75,      // the front line
    regionDetail: 1.5, // trails, passes, dunes, craters
    townDetail: 3,     // streets + buildings
    landmark: 3.6      // landmark name labels
  };

  // ---- style table (parchment palette) ---------------------------------
  const STYLE = {
    land:      { color: "#5a4226", weight: 2.2, fill: true, fillColor: "#e8dabc", fillOpacity: 1 },
    sea:       { stroke: false, fill: true, fillColor: "#a9bcbf", fillOpacity: 1 },
    bay:       { color: "#7c97a0", weight: 1, fill: true, fillColor: "#a9bcbf", fillOpacity: 1, dashArray: "1 4" },
    kalvann:   { stroke: false, fill: true, fillColor: "#cdb87f", fillOpacity: 0.30 },
    velgrath:  { stroke: false, fill: true, fillColor: "#97a09a", fillOpacity: 0.34 },
    border:    { color: "#5a4226", weight: 1.6, dashArray: "7 6", fill: false, opacity: 0.7 },
    rgn_mountains: { stroke: false, fill: true, fillColor: "#cbb893", fillOpacity: 0.45 },
    rgn_forest:    { stroke: false, fill: true, fillColor: "#9db184", fillOpacity: 0.42 },
    rgn_desert:    { stroke: false, fill: true, fillColor: "#e4d3a0", fillOpacity: 0.55 },
    rgn_warland:   { stroke: false, fill: true, fillColor: "#c2ab8c", fillOpacity: 0.40 },
    wall:      { color: "#6e5236", weight: 2.4, fill: false },
    citadel:   { color: "#5a4226", weight: 2.8, fill: false },
    bastion:   { color: "#5a4226", weight: 2.4, fill: true, fillColor: "#b7b1a4", fillOpacity: 0.35 },
    palisade:  { color: "#7a5c3e", weight: 1.6, dashArray: "5 4", fill: false },
    street:    { color: "#7c6647", weight: 2.2, fill: false },
    lane:      { color: "#9a855f", weight: 1, fill: false },
    building:  { color: "#7a5c3e", weight: 0.5, fill: true, fillColor: "#d4bd90", fillOpacity: 0.95 },
    block:     { color: "#6b5135", weight: 0.7, fill: true, fillColor: "#bda480", fillOpacity: 0.95 },
    hall:      { color: "#5a4226", weight: 1, fill: true, fillColor: "#b78a4e", fillOpacity: 0.95 },
    plaza:     { color: "#a98f63", weight: 0.5, fill: true, fillColor: "#efe3c4", fillOpacity: 0.9 },
    field:     { color: "#8a9a5b", weight: 0.5, dashArray: "3 3", fill: true, fillColor: "#d8d09b", fillOpacity: 0.5 },
    trench:    { color: "#7a3b2a", weight: 1.8, dashArray: "6 4", fill: false },
    river:     { color: "#5d83a0", weight: 2.4, fill: false },
    dock:      { color: "#6e5236", weight: 2, fill: false },
    adit:      { color: "#3a2c1d", weight: 1, fill: true, fillColor: "#4a3826", fillOpacity: 0.9 },
    tunnel:    { color: "#6e5236", weight: 1.2, dashArray: "2 5", fill: false },
    stall:     { color: "#7a5c3e", weight: 0.4, fill: true, fillColor: "#cdb78d", fillOpacity: 0.9 },
    trail:     { color: "#6f5a3a", weight: 1.3, dashArray: "2 6", fill: false },
    path:      { color: "#8a7350", weight: 1, dashArray: "1 6", fill: false, opacity: 0.7 },
    dune:      { color: "#bfa468", weight: 1, fill: false, opacity: 0.7 },
    glass:     { color: "#9fc0c4", weight: 0.6, fill: true, fillColor: "#cfe3e3", fillOpacity: 0.4 },
    glade:     { color: "#6f8a4f", weight: 0.6, fill: true, fillColor: "#b7c79a", fillOpacity: 0.5 },
    crater:    { color: "#6a553f", weight: 0.5, fill: true, fillColor: "#b6a98a", fillOpacity: 0.4 },
    front:     { color: "#9a3b27", weight: 3, dashArray: "9 6", fill: false },
    road:      { color: "#7a5c3e", weight: 2.6, fill: false, lineCap: "round" },
    smug:      { color: "#7a5c3e", weight: 2, dashArray: "6 6", fill: false }
  };

  // point-marker glyph styles (canvas circle markers)
  const DOT = {
    spire:      { radius: 2.4, color: "#5a4226", fillColor: "#7a5c3e", weight: 1, fillOpacity: 1 },
    bridge:     { radius: 2.2, color: "#5d83a0", fillColor: "#cdb78d", weight: 1, fillOpacity: 1 },
    smokestack: { radius: 2.6, color: "#3a2c1d", fillColor: "#6b5135", weight: 1, fillOpacity: 1 },
    adit:       { radius: 3,   color: "#1f150d", fillColor: "#2c2014", weight: 1, fillOpacity: 1 },
    ship:       { radius: 2.6, color: "#5a4226", fillColor: "#9aa6a1", weight: 1, fillOpacity: 1 },
    glade:      { radius: 2.8, color: "#5c7a3e", fillColor: "#9db184", weight: 1, fillOpacity: 1 }
  };

  // ---- helpers (declared early; function decls are hoisted) -------------
  function padBounds(b, p) { return [[b[0][0] - p, b[0][1] - p], [b[1][0] + p, b[1][1] + p]]; }
  function bbox(poly) { let minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9; poly.forEach(p => { minY = Math.min(minY, p[0]); maxY = Math.max(maxY, p[0]); minX = Math.min(minX, p[1]); maxX = Math.max(maxX, p[1]); }); return { minX, minY, w: maxX - minX, h: maxY - minY }; }
  function pip(pt, poly) { let inside = false, y = pt[0], x = pt[1]; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1]; const hit = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi; if (hit) inside = !inside; } return inside; }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(str) { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function niceUnits(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / p; const m = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10; return m * p; }

  // ---- map init ---------------------------------------------------------
  const canvasR = L.canvas({ padding: 0.6 });
  const map = L.map("map", {
    crs: L.CRS.Simple,
    minZoom: -2, maxZoom: 6,
    zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 90,
    maxBounds: padBounds(WORLD.bounds, 240), maxBoundsViscosity: 0.7,
    renderer: canvasR
  });
  // Add the shared renderer to the map explicitly and first, so it's fully
  // initialized (bounds set) before any layer that uses it tries to render.
  // Leaving this implicit (relying on whichever path happens to touch
  // getRenderer() first) is what caused every path to crash on first paint.
  canvasR.addTo(map);
  map.createPane("gridPane");
  map.getPane("gridPane").style.zIndex = 450;
  map.getPane("gridPane").style.pointerEvents = "none";
  map.attributionControl.setPrefix("Istraveth · The Shattered Concord");

  const LL = (p) => L.latLng(p[0], p[1]);
  const LLs = (a) => a.map(LL);

  // Give the map its initial view now, before any other layer is built or
  // any zoom listener is bound. fitBounds() triggers Leaflet's first-ever
  // "load" event synchronously, which is also when a freshly-added shared
  // renderer like canvasR actually finishes initializing (gets its pixel
  // bounds). If that first view change happens later, after a "zoomend"
  // listener is already wired to rebuild every layer, the listener fires
  // mid-load (before the renderer is ready) and every path throws on its
  // first paint. Doing it here, before anything else exists to listen for
  // it, sidesteps the race entirely.
  map.fitBounds(L.latLngBounds(LLs(WORLD.coastline)), { padding: [30, 30] });
  // The "whole continent" fit can land below zoom 0 on most screens — when
  // it does, pull the ambient LOD thresholds down with it so roads, rivers,
  // and terrain texture are visible on first load instead of only after
  // the player zooms in by hand.
  const fitZ = map.getZoom();
  Z.routes = Math.min(Z.routes, fitZ);
  Z.terrain = Math.min(Z.terrain, fitZ);
  Z.townLabel = Math.min(Z.townLabel, fitZ);
  Z.front = Math.min(Z.front, fitZ);

  // background sea fills the padded world
  const seaBox = padBounds(WORLD.bounds, 240);
  L.rectangle([[seaBox[0][0], seaBox[0][1]], [seaBox[1][0], seaBox[1][1]]],
    Object.assign({ interactive: false, renderer: canvasR }, STYLE.sea)).addTo(map);

  // ---- layer groups -----------------------------------------------------
  const G = {
    land: L.layerGroup(), nations: L.layerGroup(), regions: L.layerGroup(),
    terrain: L.layerGroup(), regionDetail: L.layerGroup(), routes: L.layerGroup(),
    front: L.layerGroup(), townDetail: L.layerGroup(), markers: L.layerGroup(),
    labNation: L.layerGroup(), labRegion: L.layerGroup(), labTown: L.layerGroup(),
    labLandmark: L.layerGroup()
  };

  // ---- base: land + coast ----------------------------------------------
  L.polygon(LLs(WORLD.coastline), Object.assign({ interactive: false, renderer: canvasR }, STYLE.land)).addTo(G.land);
  L.polygon(LLs(WORLD.nations.kalvann.polygon), Object.assign({ interactive: false, renderer: canvasR }, STYLE.kalvann)).addTo(G.nations);
  L.polygon(LLs(WORLD.nations.velgrath.polygon), Object.assign({ interactive: false, renderer: canvasR }, STYLE.velgrath)).addTo(G.nations);
  const spine = [[765, 500], [620, 505], [560, 498], [470, 510], [360, 500], [250, 495], [215, 485]];
  L.polyline(LLs(spine), Object.assign({ interactive: false, renderer: canvasR }, STYLE.border)).addTo(G.nations);
  L.polygon(LLs(WORLD.bay), Object.assign({ interactive: false, renderer: canvasR }, STYLE.bay)).addTo(G.land);

  // ---- coastal hachures: short ticks along the shore, pointing seaward --
  function addCoastalHachures() {
    const r = mulberry32(hash("coast") + 3);
    const pts = WORLD.coastline;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = dist(a, b);
      if (len < 4) continue;
      const d1 = (b[0] - a[0]) / len, d2 = (b[1] - a[1]) / len;
      let n1 = -d2, n2 = d1;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (pip([mid[0] + n1 * 3, mid[1] + n2 * 3], WORLD.coastline)) { n1 = -n1; n2 = -n2; }
      const steps = Math.max(1, Math.round(len / 14));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const p0 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const tickLen = 2.6 + r() * 2.4;
        const p1 = [p0[0] + n1 * tickLen, p0[1] + n2 * tickLen];
        L.polyline(LLs([p0, p1]), { interactive: false, renderer: canvasR, color: "#5a4226", weight: 0.8, opacity: 0.38 }).addTo(G.land);
      }
    }
  }
  addCoastalHachures();

  // ---- sea texture: gentle scattered wave glyphs across the open water --
  function addSeaTexture() {
    const r = mulberry32(hash("sea") + 7);
    const seaB = padBounds(WORLD.bounds, 200);
    const bb = { minY: seaB[0][0], minX: seaB[0][1], h: seaB[1][0] - seaB[0][0], w: seaB[1][1] - seaB[0][1] };
    let placed = 0, tries = 0;
    while (placed < 150 && tries < 3000) {
      tries++;
      const p = [bb.minY + r() * bb.h, bb.minX + r() * bb.w];
      if (pip(p, WORLD.coastline)) continue;
      placed++;
      const len = 14 + r() * 16, ang = r() * Math.PI * 2, bow = 3 + r() * 3;
      const d1 = Math.sin(ang), d2 = Math.cos(ang), n1 = -d2, n2 = d1;
      const p0 = [p[0] - d1 * len / 2, p[1] - d2 * len / 2];
      const p2 = [p[0] + d1 * len / 2, p[1] + d2 * len / 2];
      const pm = [p[0] + n1 * bow, p[1] + n2 * bow];
      L.polyline(LLs([p0, pm, p2]), { interactive: false, renderer: canvasR, color: "#7f97a0", weight: 1, opacity: 0.35, fill: false }).addTo(G.land);
    }
  }
  addSeaTexture();

  // ---- regions ----------------------------------------------------------
  WORLD.regions.forEach(rg => {
    L.polygon(LLs(rg.polygon), Object.assign({ interactive: false, renderer: canvasR }, STYLE["rgn_" + rg.kind])).addTo(G.regions);
  });

  // ---- terrain glyphs (seeded) -------------------------------------------
  function treeGlyph(p, r, big) {
    const s = (big ? 4.5 : 3) + r() * 3;
    const tone = r() > 0.5 ? "#6f8a4f" : "#7c9a5a";
    L.polygon(LLs([[p[0] + s, p[1]], [p[0] - s * 0.7, p[1] - s * 0.62], [p[0] - s * 0.7, p[1] + s * 0.62]]),
      { interactive: false, renderer: canvasR, color: "#445c30", weight: 0.5, fill: true, fillColor: tone, fillOpacity: 0.75 }).addTo(G.terrain);
    if (big) {
      const s2 = s * 0.62, oy = s * 0.55, ox = s * 0.3;
      L.polygon(LLs([[p[0] + s2 + oy, p[1] + ox], [p[0] - s2 * 0.5 + oy, p[1] - s2 * 0.5 + ox], [p[0] - s2 * 0.5 + oy, p[1] + s2 * 0.5 + ox]]),
        { interactive: false, renderer: canvasR, color: "#445c30", weight: 0.5, fill: true, fillColor: tone, fillOpacity: 0.7 }).addTo(G.terrain);
    }
  }
  function mountainGlyph(p, r) {
    const s = 6 + r() * 7;
    const lean = (r() - 0.5) * s * 0.3;
    const peak = [p[0] + s, p[1] + lean];
    const base = [[p[0] - s * 0.55, p[1] - s * 0.95], peak, [p[0] - s * 0.55, p[1] + s * 0.95]];
    L.polygon(LLs(base), { interactive: false, renderer: canvasR, color: "#5a4226", weight: 0.7, fill: true, fillColor: "#a99873", fillOpacity: 0.55 }).addTo(G.terrain);
    L.polygon(LLs([peak, [p[0] - s * 0.55, p[1] + s * 0.95], [p[0] - s * 0.1, p[1] + s * 0.3]]),
      { interactive: false, renderer: canvasR, stroke: false, fill: true, fillColor: "#6b5236", fillOpacity: 0.35 }).addTo(G.terrain);
    if (r() > 0.55) {
      const cs = s * 0.32;
      L.polygon(LLs([peak, [peak[0] - cs * 0.85, peak[1] - cs * 0.5], [peak[0] - cs * 0.85, peak[1] + cs * 0.5]]),
        { interactive: false, renderer: canvasR, stroke: false, fill: true, fillColor: "#eee6d2", fillOpacity: 0.8 }).addTo(G.terrain);
    }
  }
  function crackGlyph(p, r) {
    const a = r() * Math.PI, s = 2 + r() * 3;
    L.polyline(LLs([[p[0] - Math.sin(a) * s, p[1] - Math.cos(a) * s], [p[0] + Math.sin(a) * s, p[1] + Math.cos(a) * s]]),
      { interactive: false, renderer: canvasR, color: "#8a7350", weight: 0.8, opacity: 0.55 }).addTo(G.terrain);
  }
  function graveGlyph(p, r) {
    const s = 1.6 + r() * 1.4;
    L.polyline(LLs([[p[0] - s, p[1] - s], [p[0] + s, p[1] + s]]), { interactive: false, renderer: canvasR, color: "#6a4a3a", weight: 0.8, opacity: 0.5 }).addTo(G.terrain);
    L.polyline(LLs([[p[0] - s, p[1] + s], [p[0] + s, p[1] - s]]), { interactive: false, renderer: canvasR, color: "#6a4a3a", weight: 0.8, opacity: 0.5 }).addTo(G.terrain);
  }
  function hillTick(p, r) {
    const ang = r() * Math.PI * 2, s = 3.5 + r() * 3.5;
    const d1 = Math.sin(ang), d2 = Math.cos(ang), n1 = -d2, n2 = d1;
    const p0 = [p[0] - d1 * s, p[1] - d2 * s];
    const p2 = [p[0] + d1 * s, p[1] + d2 * s];
    const p1 = [p[0] + n1 * s * 0.45, p[1] + n2 * s * 0.45];
    L.polyline(LLs([p0, p1, p2]), { interactive: false, renderer: canvasR, color: "#8a7350", weight: 0.8, opacity: 0.42, fill: false }).addTo(G.terrain);
  }
  function grassTuft(p, r) {
    const base = r() * Math.PI * 2;
    for (let k = -1; k <= 1; k++) {
      const a = base + k * 0.35, s = 1.3 + r() * 1.3;
      L.polyline(LLs([p, [p[0] + Math.sin(a) * s, p[1] + Math.cos(a) * s]]),
        { interactive: false, renderer: canvasR, color: "#7c9a5a", weight: 0.7, opacity: 0.45 }).addTo(G.terrain);
    }
  }

  // ---- region terrain texture + region detail (seeded) ------------------
  WORLD.regions.forEach(rg => addTerrain(rg));
  function addTerrain(rg) {
    const r = mulberry32(hash(rg.id) + 5);
    const bb = bbox(rg.polygon);
    const n = { mountains: 170, forest: 260, desert: 140, warland: 150 }[rg.kind] || 90;
    for (let i = 0; i < n; i++) {
      const p = [bb.minY + r() * bb.h, bb.minX + r() * bb.w];
      if (!pip(p, rg.polygon)) continue;
      if (rg.kind === "mountains") mountainGlyph(p, r);
      else if (rg.kind === "forest") treeGlyph(p, r, r() > 0.62);
      else if (rg.kind === "desert") { if (r() > 0.4) L.circleMarker(LL(p), { interactive: false, renderer: canvasR, radius: 0.7 + r() * 0.6, color: "#b89a5f", fillColor: "#b89a5f", fillOpacity: 0.7, weight: 0 }).addTo(G.terrain); else crackGlyph(p, r); }
      else if (rg.kind === "warland") { if (r() > 0.3) L.circleMarker(LL(p), { interactive: false, renderer: canvasR, radius: 1 + r() * 0.8, color: "#7a6a52", fillColor: "#9a8a6f", fillOpacity: 0.5, weight: 0 }).addTo(G.terrain); else graveGlyph(p, r); }
    }
    drawFeatures(TownGen.generateRegionDetail(rg), G.regionDetail);
  }

  // ---- generic countryside texture: the open land between named regions -
  function addOpenLandTexture() {
    const r = mulberry32(hash("openland") + 11);
    const bb = bbox(WORLD.coastline);
    const inRegion = (p) => WORLD.regions.some(rg => pip(p, rg.polygon));
    const nearTown = (p) => WORLD.settlements.some(s => dist(p, s.pos) < s.size * 1.6);
    let placed = 0, tries = 0;
    while (placed < 650 && tries < 6000) {
      tries++;
      const p = [bb.minY + r() * bb.h, bb.minX + r() * bb.w];
      if (!pip(p, WORLD.coastline) || inRegion(p) || nearTown(p)) continue;
      placed++;
      const roll = r();
      if (roll < 0.62) hillTick(p, r);
      else if (roll < 0.86) grassTuft(p, r);
      else treeGlyph(p, r, false);
    }
  }
  addOpenLandTexture();

  // ---- routes + rivers + front -----------------------------------------
  WORLD.rivers.forEach(rv => {
    if (rv.points.length < 2) return;
    L.polyline(LLs(rv.points), Object.assign({ interactive: false, renderer: canvasR }, STYLE.river)).addTo(G.routes);
    L.polyline(LLs(rv.points), { interactive: false, renderer: canvasR, color: "#bcd3df", weight: 0.8, opacity: 0.55 }).addTo(G.routes);
  });
  WORLD.roads.forEach(rd => { L.polyline(LLs(rd.points), Object.assign({ interactive: false, renderer: canvasR }, rd.dashed ? STYLE.smug : STYLE.road)).addTo(G.routes); });
  L.polyline(LLs(WORLD.frontLine), Object.assign({ interactive: false, renderer: canvasR }, STYLE.front)).addTo(G.front);

  // ---- settlements: detail + pin + labels ------------------------------
  WORLD.settlements.forEach(s => buildSettlement(s));

  function buildSettlement(s) {
    const det = TownGen.generateTown(s);
    det.markers = (det.markers || []).filter(m => {
      if (m.cls === "landmark") { addLandmarkLabel(m); return false; }
      return true;
    });
    drawFeatures(det, G.townDetail);

    const isCap = !!s.capital, isHidden = !!s.hidden;
    const pinHtml = isCap
      ? '<span style="display:block;width:14px;height:14px;transform:translate(-50%,-50%);background:#9a3b27;clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);box-shadow:0 0 0 1px rgba(245,238,220,.8)"></span>'
      : isHidden
        ? '<span style="display:block;width:11px;height:11px;transform:translate(-50%,-50%);border:1.5px dashed #7a5c3e;border-radius:50%"></span>'
        : '<span style="display:block;width:10px;height:10px;transform:translate(-50%,-50%);background:#7a5c3e;border:2px solid #efe4c9;border-radius:50%;box-shadow:0 0 0 1px #7a5c3e"></span>';
    const m = L.marker(LL(s.pos), { icon: L.divIcon({ className: "", iconSize: [18, 18], html: pinHtml }), keyboard: false });
    m.bindPopup(popupHTML(s), { maxWidth: 260 });
    m._minZoom = isCap ? -2 : -0.5;
    m.addTo(G.markers);

    const lbl = L.marker(LL([s.pos[0] - (isCap ? 18 : 12), s.pos[1]]), {
      interactive: false, keyboard: false,
      icon: L.divIcon({
        className: "", iconSize: [0, 0],
        html: '<div class="lbl lbl-town ' + (isCap ? "cap " : "") + (isHidden ? "lbl-hidden" : "") + '">' +
          (isHidden ? esc(s.name) + ' <span style="opacity:.7">(rumoured)</span>' : esc(s.name)) + '</div>'
      })
    });
    lbl._minZoom = isCap ? Z.regionLabel : Z.townLabel;
    lbl.addTo(G.labTown);
  }

  function addLandmarkLabel(m) {
    L.marker(LL(m.pos), {
      interactive: false, keyboard: false,
      icon: L.divIcon({ className: "", iconSize: [0, 0], html: '<div class="lbl lbl-landmark">' + esc(m.label) + '</div>' })
    }).addTo(G.labLandmark);
  }

  // generic feature drawer
  function drawFeatures(feat, group) {
    (feat.polygons || []).forEach(p => {
      const st = STYLE[p.cls] || STYLE.building;
      L.polygon(LLs(p.points), Object.assign({ interactive: false, renderer: canvasR }, st)).addTo(group);
    });
    (feat.polylines || []).forEach(l => {
      const st = STYLE[l.cls] || STYLE.lane;
      const layer = l.closed
        ? L.polygon(LLs(l.points), Object.assign({ interactive: false, renderer: canvasR }, st, { fill: false }))
        : L.polyline(LLs(l.points), Object.assign({ interactive: false, renderer: canvasR }, st));
      layer.addTo(group);
    });
    (feat.markers || []).forEach(mk => {
      const st = DOT[mk.cls]; if (!st) return;
      L.circleMarker(LL(mk.pos), Object.assign({ interactive: false, renderer: canvasR }, st)).addTo(group);
    });
  }

  // ---- nation & region labels ------------------------------------------
  Object.values(WORLD.nations).forEach(nn => {
    L.marker(LL(nn.labelAt), {
      interactive: false, keyboard: false,
      icon: L.divIcon({ className: "", iconSize: [0, 0], html: '<div class="lbl lbl-nation">' + esc(nn.name) + '<small>' + esc(nn.subtitle) + '</small></div>' })
    }).addTo(G.labNation);
  });
  WORLD.regions.forEach(rg => {
    const mk = L.marker(LL(rg.labelAt), {
      interactive: true, keyboard: false,
      icon: L.divIcon({ className: "", iconSize: [0, 0], html: '<div class="lbl lbl-region">' + esc(rg.name) + '</div>' })
    });
    mk.bindPopup('<p class="pop-title">' + esc(rg.name) + '</p><p class="pop-sub">Region</p><p>' + esc(rg.desc) + '</p>', { maxWidth: 260 });
    mk.addTo(G.labRegion);
  });

  function popupHTML(s) {
    const nation = s.nation === "kalvann" ? "Kalvann" : s.nation === "velgrath" ? "Velgrath" : "Neutral ground";
    let h = '<p class="pop-title">' + esc(s.name) + '</p>';
    h += '<p class="pop-sub">' + (s.capital ? "Capital · " : "") + nation + '</p>';
    h += '<p>' + esc(s.desc) + '</p>';
    if (s.landmarks && s.landmarks.length) h += '<ul class="pop-marks">' + s.landmarks.map(x => '<li>' + esc(x) + '</li>').join("") + '</ul>';
    return h;
  }

  // =====================================================================
  //  GRID OVERLAY (square / hex), anchored to world coordinates
  // =====================================================================
  const Grid = L.Layer.extend({
    initialize: function () { this._mode = "off"; },
    setMode: function (m) { this._mode = m; this._draw(); },
    onAdd: function (mp) {
      this._map = mp;
      this._c = L.DomUtil.create("canvas", "grid-canvas", mp.getPane("gridPane"));
      this._c.style.position = "absolute";
      mp.on("move zoom viewreset resize zoomend moveend", this._draw, this);
      this._draw();
    },
    onRemove: function (mp) { mp.off("move zoom viewreset resize zoomend moveend", this._draw, this); L.DomUtil.remove(this._c); },
    _draw: function () {
      const mp = this._map; if (!mp) return;
      const size = mp.getSize();
      const c = this._c; c.width = size.x; c.height = size.y;
      L.DomUtil.setPosition(c, mp.containerPointToLayerPoint([0, 0]));
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      if (this._mode === "off") return;

      const z = mp.getZoom();
      const pxPerUnit = Math.pow(2, z);
      const cell = niceUnits(36 / pxPerUnit);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(58,44,29,0.34)";

      const b = mp.getBounds();
      const minX = Math.floor(b.getWest() / cell) * cell;
      const maxX = Math.ceil(b.getEast() / cell) * cell;
      const minY = Math.floor(b.getSouth() / cell) * cell;
      const maxY = Math.ceil(b.getNorth() / cell) * cell;

      if (this._mode === "square") {
        ctx.beginPath();
        for (let x = minX; x <= maxX; x += cell) { const p1 = mp.latLngToContainerPoint([minY, x]), p2 = mp.latLngToContainerPoint([maxY, x]); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); }
        for (let y = minY; y <= maxY; y += cell) { const p1 = mp.latLngToContainerPoint([y, minX]), p2 = mp.latLngToContainerPoint([y, maxX]); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); }
        ctx.stroke();
      } else if (this._mode === "hex") {
        const hr = cell, hw = Math.sqrt(3) * hr, vh = 1.5 * hr;
        let row = 0;
        for (let y = minY - vh; y <= maxY + vh; y += vh, row++) {
          const xoff = (row % 2) ? hw / 2 : 0;
          for (let x = minX - hw; x <= maxX + hw; x += hw) hexPath(ctx, mp, x + xoff, y, hr);
        }
      }
    }
  });
  function hexPath(ctx, mp, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 90); const p = mp.latLngToContainerPoint([cy + r * Math.sin(a), cx + r * Math.cos(a)]); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
    ctx.closePath(); ctx.stroke();
  }
  const grid = new Grid();
  map.addLayer(grid);

  // =====================================================================
  //  VISIBILITY MANAGEMENT (by zoom + toggles)
  // =====================================================================
  const ui = { labels: true, routes: true, front: true, terrain: true, shading: true };
  function want(group, on) { if (on) { if (!map.hasLayer(group)) map.addLayer(group); } else { if (map.hasLayer(group)) map.removeLayer(group); } }

  function updateVisibility() {
    const z = map.getZoom();
    want(G.land, true);
    want(G.regions, ui.shading);
    want(G.nations, ui.shading);
    want(G.terrain, ui.terrain && z >= Z.terrain);
    want(G.regionDetail, ui.terrain && z >= Z.regionDetail);
    want(G.routes, ui.routes && z >= Z.routes);
    want(G.front, ui.front && z >= Z.front);
    want(G.townDetail, z >= Z.townDetail);
    want(G.labNation, ui.labels);
    want(G.labRegion, ui.labels && z >= Z.regionLabel);
    want(G.labLandmark, ui.labels && z >= Z.landmark);
    want(G.markers, true);
    G.markers.eachLayer(l => { const el = l.getElement && l.getElement(); if (el) el.style.display = (z >= (l._minZoom ?? -2)) ? "" : "none"; });
    want(G.labTown, ui.labels);
    G.labTown.eachLayer(l => { const el = l.getElement && l.getElement(); if (el) el.style.display = (ui.labels && z >= (l._minZoom ?? 0)) ? "" : "none"; });
    updateScaleRead(z);
  }

  function updateScaleRead(z) {
    const el = document.getElementById("scale-read");
    const mode = grid._mode;
    const unit = z >= 5 ? "5 ft" : z >= 4 ? "20 ft" : z >= 3 ? "100 ft" : z >= 1.5 ? "¼ mile" : z >= 0 ? "1 mile" : "10 miles";
    if (mode === "off") el.textContent = z >= Z.townDetail ? "Street level — turn on the grid" : "Zoom in for street level";
    else el.textContent = "1 " + (mode === "hex" ? "hex" : "square") + " ≈ " + unit;
  }

  map.on("zoomend", updateVisibility);
  map.on("moveend", () => updateScaleRead(map.getZoom()));

  // =====================================================================
  //  UI WIRING
  // =====================================================================
  const jump = document.getElementById("jump");
  const og1 = document.createElement("optgroup"); og1.label = "Settlements";
  WORLD.settlements.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(s => { const o = document.createElement("option"); o.value = "s:" + s.id; o.textContent = s.name + (s.capital ? " ★" : ""); og1.appendChild(o); });
  const og2 = document.createElement("optgroup"); og2.label = "Regions";
  WORLD.regions.forEach(rg => { const o = document.createElement("option"); o.value = "r:" + rg.id; o.textContent = rg.name; og2.appendChild(o); });
  jump.appendChild(og1); jump.appendChild(og2);
  jump.addEventListener("change", () => {
    const v = jump.value; if (!v) return;
    const parts = v.split(":"), t = parts[0], id = parts[1];
    if (t === "s") { const s = WORLD.settlements.find(x => x.id === id); map.flyTo(LL(s.pos), 4.5, { duration: 0.8 }); }
    else { const rg = WORLD.regions.find(x => x.id === id); map.flyToBounds(L.latLngBounds(LLs(rg.polygon)), { padding: [40, 40], maxZoom: 2.5, duration: 0.8 }); }
    jump.value = "";
  });

  const bind = (id, key) => document.getElementById(id).addEventListener("change", e => { ui[key] = e.target.checked; updateVisibility(); });
  bind("t-labels", "labels"); bind("t-routes", "routes"); bind("t-front", "front"); bind("t-terrain", "terrain"); bind("t-shading", "shading");

  document.getElementById("grid-seg").addEventListener("click", e => {
    const btn = e.target.closest("button"); if (!btn) return;
    [...e.currentTarget.children].forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    grid.setMode(btn.dataset.grid);
    updateScaleRead(map.getZoom());
  });

  document.getElementById("panel-toggle").addEventListener("click", () => document.getElementById("panel").classList.toggle("collapsed"));

  // =====================================================================
  //  GO
  // =====================================================================
  updateVisibility();
})();
