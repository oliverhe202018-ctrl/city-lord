import * as turf from "@turf/turf";

// ─── Types ──────────────────────────────────────────────

export type PolygonRing = [number, number][];

export interface TerritoryAdjacencyInput {
  id: string;
  ownerClubId: string | null;
  outerRings: PolygonRing[];
}

interface BBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

// ─── UnionFind ──────────────────────────────────────────

export class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;

  constructor(ids: string[]) {
    this.parent = new Map(ids.map((id) => [id, id]));
    this.rank = new Map(ids.map((id) => [id, 0]));
  }

  find(x: string): string {
    let p = this.parent.get(x);
    if (p === undefined) return x;
    // Path compression
    while (p !== x) {
      const grandparent = this.parent.get(p);
      if (grandparent === undefined) break;
      this.parent.set(x, grandparent);
      x = p;
      p = grandparent;
    }
    return p;
  }

  union(x: string, y: string): void {
    const px = this.find(x);
    const py = this.find(y);
    if (px === py) return;

    const rx = this.rank.get(px) ?? 0;
    const ry = this.rank.get(py) ?? 0;

    if (rx < ry) {
      this.parent.set(px, py);
    } else if (rx > ry) {
      this.parent.set(py, px);
    } else {
      this.parent.set(py, px);
      this.rank.set(px, rx + 1);
    }
  }

  getComponents(): string[][] {
    const groups = new Map<string, string[]>();
    for (const [id] of this.parent) {
      const root = this.find(id);
      const list = groups.get(root) || [];
      list.push(id);
      groups.set(root, list);
    }
    return Array.from(groups.values());
  }
}

// ─── BBox Utilities ─────────────────────────────────────

export function getBBox(rings: PolygonRing[]): BBox | null {
  if (!rings.length) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  if (!isFinite(minLng)) return null;
  return { minLng, maxLng, minLat, maxLat };
}

export function bboxesIntersect(a: BBox, b: BBox): boolean {
  return (
    a.maxLng >= b.minLng &&
    a.minLng <= b.maxLng &&
    a.maxLat >= b.minLat &&
    a.minLat <= b.maxLat
  );
}

// ─── Polygon Construction ───────────────────────────────

function ringsToPolygon(rings: PolygonRing[]): ReturnType<typeof turf.polygon> | null {
  if (!rings.length) return null;
  const coords = rings.map((ring) => ring.map(([lng, lat]) => [lng, lat]));
  try {
    return turf.polygon(coords as number[][][]);
  } catch {
    return null;
  }
}

// ─── Adjacency Detection ────────────────────────────────

const BUFFER_5M_KM = 0.005; // 5 meters in kilometers

export function areTerritoriesAdjacent(
  ringsA: PolygonRing[],
  ringsB: PolygonRing[],
  enableBuffer: boolean = false
): boolean {
  const polyA = ringsToPolygon(ringsA);
  const polyB = ringsToPolygon(ringsB);
  if (!polyA || !polyB) return false;

  // Layer 2: Turf.js booleanIntersects + booleanTouches
  try {
    if (turf.booleanIntersects(polyA, polyB)) return true;
    if (turf.booleanTouches(polyA, polyB)) return true;
  } catch {
    // Turf may throw on degenerate polygons
  }

  // Layer 3 (optional): tiny buffer for GPS inaccuracy
  if (enableBuffer) {
    try {
      const buffered = turf.buffer(polyA, BUFFER_5M_KM, { units: "kilometers" });
      if (buffered && turf.booleanIntersects(buffered, polyB)) return true;
    } catch {
      // Buffer may fail on degenerate geometry
    }
  }

  return false;
}

// ─── Connected Components Grouping ──────────────────────

/**
 * Group club territories by connected components.
 * Only territories with the same ownerClubId are considered for adjacency.
 *
 * @returns Map<clubId, string[][]> — each inner array is a connected component of territory IDs
 */
export function groupClubTerritoriesByConnectedComponents(
  territories: TerritoryAdjacencyInput[]
): Map<string, string[][]> {
  // 1. Filter club territories and pre-compute bboxes
  const clubTerritories: { input: TerritoryAdjacencyInput; bbox: BBox | null }[] = [];
  for (const t of territories) {
    if (!t.ownerClubId) continue;
    const bbox = getBBox(t.outerRings);
    clubTerritories.push({ input: t, bbox });
  }

  // 2. Group by clubId
  const byClub = new Map<string, { input: TerritoryAdjacencyInput; bbox: BBox | null }[]>();
  for (const ct of clubTerritories) {
    const clubId = ct.input.ownerClubId!;
    const list = byClub.get(clubId) || [];
    list.push(ct);
    byClub.set(clubId, list);
  }

  // 3. For each club, run Union-Find on adjacency
  const result = new Map<string, string[][]>();

  for (const [clubId, items] of byClub) {
    if (items.length === 0) continue;

    const ids = items.map((it) => it.input.id);
    const uf = new UnionFind(ids);

    // Compare all pairs within the same club
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];

        // Layer 1: BBox pre-filter
        if (a.bbox && b.bbox && !bboxesIntersect(a.bbox, b.bbox)) {
          continue;
        }

        // Layer 2 & 3: Turf.js adjacency check
        if (areTerritoriesAdjacent(a.input.outerRings, b.input.outerRings)) {
          uf.union(a.input.id, b.input.id);
        }
      }
    }

    const components = uf.getComponents();
    result.set(clubId, components);
  }

  return result;
}