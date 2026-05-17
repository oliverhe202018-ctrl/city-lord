
/**
 * SvgTextureGenerator.js
 * 
 * Helper to generate Cocos2d textures from SVG paths using HTML5 Canvas.
 * This allows using vector paths for game assets without external image files.
 */
var createSvgTextureGenerator = function(cc) {
    return {
        /**
         * Generates a texture from an SVG path string and caches it.
         * 
         * @param {string} key - The texture cache key (e.g. "res/coin.png")
         * @param {string} pathData - SVG path data (d attribute)
         * @param {number} width - Canvas width
         * @param {number} height - Canvas height
         * @param {string} fillColor - Fill color (hex, rgba, or gradient)
         * @param {string} strokeColor - Stroke color (optional)
         * @param {number} lineWidth - Stroke width (optional)
         * @returns {cc.Texture2D} The generated texture
         */
        generate: function(key, pathData, width, height, fillColor, strokeColor, lineWidth) {
            // 1. Create offscreen canvas
            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext('2d');

            // 2. Draw SVG Path
            // Note: Path2D is supported in most modern browsers (Chrome, Firefox, Edge, Safari)
            if (window.Path2D) {
                var path = new Path2D(pathData);
                
                // Clear
                ctx.clearRect(0, 0, width, height);
                
                // Style
                if (fillColor) {
                    ctx.fillStyle = fillColor;
                    ctx.fill(path);
                }
                
                if (strokeColor) {
                    ctx.strokeStyle = strokeColor;
                    ctx.lineWidth = lineWidth || 1;
                    ctx.stroke(path);
                }
            } else {
                // Fallback for very old browsers (unlikely in this context)
                console.warn("[SvgTextureGenerator] Path2D not supported.");
                // Draw a simple rect as fallback
                ctx.fillStyle = fillColor || '#FF00FF';
                ctx.fillRect(0, 0, width, height);
            }

            // 3. Create Cocos Texture
            var texture = new cc.Texture2D();
            texture.initWithElement(canvas);
            texture.handleLoadedTexture();

            // 4. Cache it so we can create Sprites from it later
            // Use the file path as key so existing code referencing "res/coin.png" works
            cc.textureCache.cacheTexture(key, texture);
            
            return texture;
        },

        /**
         * Helper to generate specific game shapes if path is not provided
         */
        generateShape: function(key, type, width, height, color) {
            // Reuse generate with preset paths or custom drawing
            // This is just a convenience wrapper
            // ...
        }
    };
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = createSvgTextureGenerator;
}
