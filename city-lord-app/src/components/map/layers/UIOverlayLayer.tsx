"use client";

import { MapControls } from '../MapControls';

/**
 * UIOverlayLayer: UI controls and overlays
 * 
 * Renders map controls and UI elements that sit on top of the map.
 * Center overlay removed - was visual noise for running game.
 */
export function UIOverlayLayer() {
    return <MapControls />;
}
