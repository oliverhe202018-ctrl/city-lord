import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Define interfaces for type safety
export interface TerritoryData {
  id: string;
  cityId: string;
  ownerId: string;
  geojson: any; // Parsed GeoJSON object
  status?: string;
  health?: number;
  level?: number;
}

export interface CreateTerritoryInput {
  id: string;
  cityId: string;
  ownerId: string;
  geojson: string; // GeoJSON string to be passed to ST_GeomFromGeoJSON
  h3Index?: string;
  status?: string;
}

/**
 * MapService handles raw SQL queries for PostGIS geometry types
 * which are not fully supported by Prisma's generated client.
 */
export const MapService = {
  /**
   * Retrieves all territories with their geometry parsed as GeoJSON
   */
  async getTerritories(): Promise<TerritoryData[]> {
    try {
      // Use ST_AsGeoJSON to get the geometry as a JSON string
      const rows = await prisma.$queryRaw<any[]>`
        SELECT 
          id, 
          city_id as "cityId", 
          owner_id as "ownerId", 
          status,
          health,
          level,
          ST_AsGeoJSON(geojson) as geojson 
        FROM territories 
        WHERE geojson IS NOT NULL
      `;

      // Parse the GeoJSON string into an object
      return rows.map((row) => ({
        ...row,
        geojson: row.geojson ? JSON.parse(row.geojson) : null,
      }));
    } catch (error) {
      console.error("Error fetching territories:", error);
      throw error;
    }
  },

  /**
   * Saves a user's location using PostGIS geometry
   * @param userId The user's ID
   * @param lat Latitude
   * @param lng Longitude
   */
  async saveUserLocation(userId: string, lat: number, lng: number): Promise<void> {
    try {
      // Use ST_SetSRID and ST_MakePoint to create a geometry point (SRID 4326 for WGS84)
      await prisma.$executeRaw`
        INSERT INTO user_locations (user_id, location, updated_at)
        VALUES (
          ${userId}::uuid, 
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326), 
          NOW()
        )
      `;
    } catch (error) {
      console.error("Error saving user location:", error);
      throw error;
    }
  },

  /**
   * Creates a new territory with geometry
   * @param data The territory data including GeoJSON string
   */
  async createTerritory(data: CreateTerritoryInput): Promise<void> {
    try {
      const { id, cityId, ownerId, geojson, h3Index, status = 'active' } = data;

      // Use ST_GeomFromGeoJSON to convert JSON string to geometry
      await prisma.$executeRaw`
        INSERT INTO territories (
          id, 
          city_id, 
          owner_id, 
          geojson, 
          h3_index, 
          status, 
          captured_at, 
          last_maintained_at, 
          health, 
          level
        )
        VALUES (
          ${id}, 
          ${cityId}, 
          ${ownerId}::uuid, 
          ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326), 
          ${h3Index || null}, 
          ${status}, 
          NOW(), 
          NOW(), 
          100, 
          1
        )
      `;
    } catch (error) {
      console.error("Error creating territory:", error);
      throw error;
    }
  },

  /**
   * Updates an existing territory's geometry
   * @param id Territory ID
   * @param geojson GeoJSON string
   */
  async updateTerritoryGeometry(id: string, geojson: string): Promise<void> {
    try {
      await prisma.$executeRaw`
        UPDATE territories 
        SET geojson = ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326),
            last_maintained_at = NOW()
        WHERE id = ${id}
      `;
    } catch (error) {
      console.error("Error updating territory geometry:", error);
      throw error;
    }
  }
};
