
var res = require('./resource');

var MapConfig = {
    resources: res,
    parallax: [
        { key: 'bg_sky', path: res.bg_sky, factor: 0.0, fallbackColor: [135, 206, 235] }, // SkyBlue (Static)
        { key: 'bg_far', path: res.bg_far, factor: 0.2, fallbackColor: [100, 149, 237] }, // CornflowerBlue
        { key: 'bg_mid', path: res.bg_mid, factor: 0.5, fallbackColor: [60, 179, 113] }, // MediumSeaGreen
        { key: 'bg_near', path: res.bg_near, factor: 0.8, fallbackColor: [34, 139, 34] }, // ForestGreen
        { key: 'ground', path: res.ground, factor: 1.0, fallbackColor: [105, 105, 105] } // DimGray
    ],
    spawner: {
        spawnInterval: 1.5,
        speed: 300,
        yPositions: [100, 200, 300],
        initialPoolSize: 20,
        types: [
            { 
                id: 'coin', 
                weight: 50, 
                path: res.coin, 
                poolSize: 20, 
                fallbackColor: [255, 215, 0],
                // Simple Circle
                svgPath: "M 32 4 A 28 28 0 1 1 32 60 A 28 28 0 1 1 32 4 Z",
                svgSize: { w: 64, h: 64 },
                svgColor: "#FFD700",
                svgStroke: "#FFA500",
                svgStrokeWidth: 4
            }, 
            { 
                id: 'obstacle', 
                weight: 30, 
                path: res.obstacle, 
                poolSize: 10, 
                fallbackColor: [255, 69, 0],
                // Spike/Triangle
                svgPath: "M 32 4 L 60 60 L 4 60 Z",
                svgSize: { w: 64, h: 64 },
                svgColor: "#FF4500",
                svgStroke: "#8B0000",
                svgStrokeWidth: 4
            },
            {
                id: 'item_magnet',
                weight: 10,
                path: res.item_magnet,
                poolSize: 5,
                fallbackColor: [255, 0, 255],
                // U-shape Magnet
                svgPath: "M 16 16 V 32 A 16 16 0 0 0 48 32 V 16 L 40 16 V 32 A 8 8 0 0 1 24 32 V 16 Z",
                svgSize: { w: 64, h: 64 },
                svgColor: "#FF00FF",
                svgStroke: "#C0C0C0",
                svgStrokeWidth: 2
            },
            {
                id: 'item_shield',
                weight: 10,
                path: res.item_shield,
                poolSize: 5,
                fallbackColor: [0, 255, 255],
                // Shield Shape
                svgPath: "M 32 4 L 56 16 V 32 C 56 48 32 60 32 60 C 32 60 8 48 8 32 V 16 Z",
                svgSize: { w: 64, h: 64 },
                svgColor: "#00FFFF",
                svgStroke: "#0000FF",
                svgStrokeWidth: 2
            }
        ]
    },
    effects: {
        glow: {
            path: res.glow_circle,
            // Soft Circle
            svgPath: "M 32 4 A 28 28 0 1 1 32 60 A 28 28 0 1 1 32 4 Z",
            svgSize: { w: 64, h: 64 },
            svgColor: "rgba(255, 255, 255, 0.5)", // Semi-transparent
            svgStroke: "rgba(255, 255, 255, 0.2)",
            svgStrokeWidth: 0
        },
        particle_star: {
            path: res.particle_star,
            // Star Shape
            svgPath: "M 32 4 L 40 24 L 60 24 L 44 36 L 50 56 L 32 44 L 14 56 L 20 36 L 4 24 L 24 24 Z",
            svgSize: { w: 64, h: 64 },
            svgColor: "#FFFF00"
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapConfig;
}
