"use client";

import { useEffect, useRef, useState } from 'react';
import { getClubKingdom, type ClubKingdomData } from '@/app/actions/club-service';

interface ClubKingdomLayerProps {
    map: any | null;
    userId: string | null;
}

/**
 * ClubKingdomLayer: Renders club territories with tiled logo pattern fill
 * 
 * Uses AMap.CustomLayer + Canvas2D to:
 * 1. Load club logo image
 * 2. Create ctx.createPattern(image, 'repeat') 
 * 3. Draw polygons with the pattern as fillStyle
 * 4. Redraws on every map render (zoom/pan)
 * 
 * Result: Logo tiles inside polygon boundaries, clipped neatly.
 * As map zooms in, polygon grows revealing more tiles.
 */
export function ClubKingdomLayer({ map, userId }: ClubKingdomLayerProps) {
    const [data, setData] = useState<ClubKingdomData | null>(null);
    const customLayerRef = useRef<any>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const patternImageRef = useRef<HTMLImageElement | null>(null);
    const patternReadyRef = useRef(false);

    // Fetch club data
    useEffect(() => {
        if (!userId) return;
        getClubKingdom(userId).then(result => {
            setData(result);
        });
    }, [userId]);

    // Preload club logo image
    useEffect(() => {
        if (!data?.clubLogoUrl) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            patternImageRef.current = img;
            patternReadyRef.current = true;
            // Trigger re-render of custom layer
            if (customLayerRef.current) {
                customLayerRef.current.render();
            }
        };
        img.onerror = () => {
            console.warn('[ClubKingdomLayer] Failed to load club logo:', data.clubLogoUrl);
            patternReadyRef.current = false;
        };
        img.src = data.clubLogoUrl;

        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [data?.clubLogoUrl]);

    // Create CustomLayer
    useEffect(() => {
        if (!map || !window.AMap || !data || data.polygons.length === 0) return;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvasRef.current = canvas;

        // Create custom layer
        const customLayer = new window.AMap.CustomLayer(canvas, {
            zIndex: 36, // Between personal kingdom (35) and session claims (40)
            zooms: [3, 20],
        });

        customLayerRef.current = customLayer;

        // Render function - called on every map redraw
        customLayer.render = () => {
            const ctx = canvas.getContext('2d');
            if (!ctx || !patternReadyRef.current || !patternImageRef.current) return;

            // Match canvas size to map container
            const size = map.getSize();
            canvas.width = size.width;
            canvas.height = size.height;

            // Clear
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Create pattern from logo
            const pattern = ctx.createPattern(patternImageRef.current, 'repeat');
            if (!pattern) return;

            // Draw each polygon
            data.polygons.forEach(polygon => {
                if (!polygon.coordinates || polygon.coordinates.length < 3) return;

                ctx.beginPath();

                polygon.coordinates.forEach((coord, i) => {
                    // Convert lng/lat to pixel coordinates on the container
                    const pixel = map.lngLatToContainer(
                        new window.AMap.LngLat(coord.lng, coord.lat)
                    );

                    if (i === 0) {
                        ctx.moveTo(pixel.getX(), pixel.getY());
                    } else {
                        ctx.lineTo(pixel.getX(), pixel.getY());
                    }
                });

                ctx.closePath();

                // Fill with tiled pattern
                ctx.globalAlpha = 0.35;
                ctx.fillStyle = pattern;
                ctx.fill();

                // Stroke with white border
                ctx.globalAlpha = 0.6;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });

            ctx.globalAlpha = 1;
        };

        map.add(customLayer);

        return () => {
            if (map && customLayer) {
                try {
                    map?.remove?.(customLayer);
                } catch (e) {
                    console.warn('[ClubKingdomLayer] Cleanup error:', e);
                }
            }
            customLayerRef.current = null;
        };
    }, [map, data]);

    return null;
}
