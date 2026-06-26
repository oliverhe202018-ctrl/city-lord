import { describe, it, expect } from "vitest";
import * as turf from "@turf/turf";
import {
  UnionFind,
  getBBox,
  bboxesIntersect,
  areTerritoriesAdjacent,
  groupClubTerritoriesByConnectedComponents,
  type PolygonRing,
  type TerritoryAdjacencyInput,
} from "@/city-lord-app/src/lib/citylord/territory-adjacency";

// ─── Helpers ────────────────────────────────────────────

/** Create a simple square polygon ring centered at (lng, lat) */
function makeSquare(lng: number, lat: number, size: number): PolygonRing[] {
  const half = size / 2;
  return [
    [
      [lng - half, lat - half],
      [lng + half, lat - half],
      [lng + half, lat + half],
      [lng - half, lat + half],
      [lng - half, lat - half], // close
    ],
  ];
}

/** Create a polygon ring displaced from another by dx, dy */
function makeSquareAt(base: PolygonRing[], dx: number, dy: number): PolygonRing[] {
  return base.map((ring) =>
    ring.map(([lng, lat]) => [lng + dx, lat + dy] as [number, number])
  );
}

function makeTerritory(
  id: string,
  clubId: string | null,
  rings: PolygonRing[]
): TerritoryAdjacencyInput {
  return { id, ownerClubId: clubId, outerRings: rings };
}

// ─── UnionFind Tests ────────────────────────────────────

describe("UnionFind", () => {
  it("each element is its own component initially", () => {
    const uf = new UnionFind(["a", "b", "c"]);
    const components = uf.getComponents();
    expect(components).toHaveLength(3);
  });

  it("union merges two elements", () => {
    const uf = new UnionFind(["a", "b", "c"]);
    uf.union("a", "b");
    const components = uf.getComponents();
    expect(components).toHaveLength(2);
    const hasAB = components.some((c) => c.includes("a") && c.includes("b"));
    expect(hasAB).toBe(true);
  });

  it("chained union merges all", () => {
    const uf = new UnionFind(["a", "b", "c"]);
    uf.union("a", "b");
    uf.union("b", "c");
    const components = uf.getComponents();
    expect(components).toHaveLength(1);
    expect(components[0]).toContain("a");
    expect(components[0]).toContain("b");
    expect(components[0]).toContain("c");
  });
});

// ─── BBox Tests ─────────────────────────────────────────

describe("getBBox", () => {
  it("computes bbox from a square ring", () => {
    const rings = makeSquare(120, 30, 0.01);
    const bbox = getBBox(rings);
    expect(bbox).not.toBeNull();
    expect(bbox!.minLng).toBeCloseTo(119.995);
    expect(bbox!.maxLng).toBeCloseTo(120.005);
    expect(bbox!.minLat).toBeCloseTo(29.995);
    expect(bbox!.maxLat).toBeCloseTo(30.005);
  });

  it("returns null for empty rings", () => {
    expect(getBBox([])).toBeNull();
  });
});

describe("bboxesIntersect", () => {
  it("overlapping bboxes return true", () => {
    const a = { minLng: 0, maxLng: 10, minLat: 0, maxLat: 10 };
    const b = { minLng: 5, maxLng: 15, minLat: 5, maxLat: 15 };
    expect(bboxesIntersect(a, b)).toBe(true);
  });

  it("separated bboxes return false", () => {
    const a = { minLng: 0, maxLng: 5, minLat: 0, maxLat: 5 };
    const b = { minLng: 10, maxLng: 15, minLat: 10, maxLat: 15 };
    expect(bboxesIntersect(a, b)).toBe(false);
  });
});

// ─── Adjacency Tests ────────────────────────────────────

describe("areTerritoriesAdjacent", () => {
  it("intersecting polygons → adjacent", () => {
    const a = makeSquare(120, 30, 0.01);
    // b overlaps with a by half
    const b = makeSquareAt(a, 0.005, 0.005);
    expect(areTerritoriesAdjacent(a, b)).toBe(true);
  });

  it("touching polygons (shared boundary) → adjacent", () => {
    const a = makeSquare(120, 30, 0.01);
    // b shares boundary with a (slightly overlap to avoid floating point issues)
    const b = makeSquareAt(a, 0.0099, 0);
    expect(areTerritoriesAdjacent(a, b)).toBe(true);
  });

  it("separated polygons → not adjacent", () => {
    const a = makeSquare(120, 30, 0.01);
    const b = makeSquare(120.05, 30, 0.01);
    expect(areTerritoriesAdjacent(a, b)).toBe(false);
  });

  it("tiny gap with buffer=false → not adjacent", () => {
    const a = makeSquare(120, 30, 0.01);
    // 3m gap (0.00003 degrees ≈ 3m)
    const b = makeSquareAt(a, 0.01003, 0);
    expect(areTerritoriesAdjacent(a, b, false)).toBe(false);
  });

  it("tiny gap with buffer=true → adjacent", () => {
    const a = makeSquare(120, 30, 0.01);
    // 3m gap — buffer should bridge it
    const b = makeSquareAt(a, 0.01003, 0);
    expect(areTerritoriesAdjacent(a, b, true)).toBe(true);
  });

  it("empty rings → not adjacent", () => {
    expect(areTerritoriesAdjacent([], [])).toBe(false);
  });
});

// ─── Connected Components Tests ─────────────────────────

describe("groupClubTerritoriesByConnectedComponents", () => {
  it("single territory → 1 component", () => {
    const t = makeTerritory("t1", "club-a", makeSquare(120, 30, 0.01));
    const result = groupClubTerritoriesByConnectedComponents([t]);
    const components = result.get("club-a");
    expect(components).toHaveLength(1);
    expect(components![0]).toEqual(["t1"]);
  });

  it("two adjacent territories, same club → 1 component", () => {
    const base = makeSquare(120, 30, 0.01);
    const t1 = makeTerritory("t1", "club-a", base);
    const t2 = makeTerritory("t2", "club-a", makeSquareAt(base, 0.005, 0.005));
    const result = groupClubTerritoriesByConnectedComponents([t1, t2]);
    const components = result.get("club-a");
    expect(components).toHaveLength(1);
    expect(components![0]).toContain("t1");
    expect(components![0]).toContain("t2");
  });

  it("two separated territories, same club → 2 components", () => {
    const t1 = makeTerritory("t1", "club-a", makeSquare(120, 30, 0.01));
    const t2 = makeTerritory("t2", "club-a", makeSquare(120.1, 30, 0.01));
    const result = groupClubTerritoriesByConnectedComponents([t1, t2]);
    const components = result.get("club-a");
    expect(components).toHaveLength(2);
  });

  it("three territories, A-B-C chain, A and C separated → 1 component", () => {
    const base = makeSquare(120, 30, 0.01);
    const t1 = makeTerritory("t1", "club-a", base);
    // t2 overlaps with t1
    const t2 = makeTerritory("t2", "club-a", makeSquareAt(base, 0.009, 0));
    // t3 overlaps with t2 but not t1
    const t3 = makeTerritory("t3", "club-a", makeSquareAt(base, 0.018, 0));
    const result = groupClubTerritoriesByConnectedComponents([t1, t2, t3]);
    const components = result.get("club-a");
    expect(components).toHaveLength(1);
  });

  it("different clubIds → never merged", () => {
    const base = makeSquare(120, 30, 0.01);
    const t1 = makeTerritory("t1", "club-a", base);
    const t2 = makeTerritory("t2", "club-b", makeSquareAt(base, 0.005, 0.005));
    const result = groupClubTerritoriesByConnectedComponents([t1, t2]);
    const compA = result.get("club-a");
    const compB = result.get("club-b");
    expect(compA).toHaveLength(1);
    expect(compB).toHaveLength(1);
  });

  it("no ownerClubId → excluded from club components", () => {
    const base = makeSquare(120, 30, 0.01);
    const t1 = makeTerritory("t1", null, base);
    const t2 = makeTerritory("t2", "club-a", makeSquareAt(base, 0.005, 0.005));
    const result = groupClubTerritoriesByConnectedComponents([t1, t2]);
    expect(result.has("club-a")).toBe(true);
    // t1 should not appear in any club component
    const allIds = Array.from(result.values()).flat(2);
    expect(allIds).not.toContain("t1");
  });

  it("three disconnected islands, same club → 3 components", () => {
    const t1 = makeTerritory("t1", "club-a", makeSquare(120, 30, 0.01));
    const t2 = makeTerritory("t2", "club-a", makeSquare(121, 30, 0.01));
    const t3 = makeTerritory("t3", "club-a", makeSquare(122, 30, 0.01));
    const result = groupClubTerritoriesByConnectedComponents([t1, t2, t3]);
    const components = result.get("club-a");
    expect(components).toHaveLength(3);
  });

  it("invalid geojson (empty rings) → does not crash, becomes standalone component", () => {
    const t1 = makeTerritory("t1", "club-a", makeSquare(120, 30, 0.01));
    const t2: TerritoryAdjacencyInput = { id: "t2", ownerClubId: "club-a", outerRings: [] };
    const result = groupClubTerritoriesByConnectedComponents([t1, t2]);
    const components = result.get("club-a");
    expect(components).toHaveLength(2);
    // t2 is standalone since it has no geometry
    const hasStandaloneT2 = components!.some((c) => c.length === 1 && c[0] === "t2");
    expect(hasStandaloneT2).toBe(true);
  });
});