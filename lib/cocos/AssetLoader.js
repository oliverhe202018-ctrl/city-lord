
/**
 * AssetLoader.js
 * 负责资源加载和占位符处理
 */
var createAssetLoader = function(cc, svgGenerator) {
    return cc.Class.extend({
        ctor: function() {
            this.missingAssets = {};
            this.fallbackColors = {};
            this.svgConfigs = {}; // path -> svgConfig
            this.svgGenerator = svgGenerator;
        },

        /**
         * Load resources and track missing ones
         * @param {Array} resources List of file paths
         * @param {Object} config MapConfig to look up fallback colors (optional)
         * @param {Function} callback
         */
        load: function(resources, config, callback) {
            var self = this;
            var loadedCount = 0;
            var total = resources.length;
            
            if (total === 0) {
                if (callback) callback();
                return;
            }

            // Register fallback colors and SVG configs if config provided
            if (config) {
                if (config.parallax) {
                    config.parallax.forEach(function(l) { 
                        self.fallbackColors[l.path] = l.fallbackColor; 
                        // If parallax had svg paths, we'd add them here too
                    });
                }
                if (config.spawner && config.spawner.types) {
                    config.spawner.types.forEach(function(t) { 
                        self.fallbackColors[t.path] = t.fallbackColor;
                        if (t.svgPath) {
                            self._registerSvg(t.path, t);
                        }
                    });
                }
                if (config.effects) {
                    for (var key in config.effects) {
                        var eff = config.effects[key];
                        if (eff.path) {
                            if (eff.svgPath) self._registerSvg(eff.path, eff);
                        }
                    }
                }
            }

            // Helper to handle completion
            var onResourceProcessed = function() {
                loadedCount++;
                if (loadedCount >= total) {
                    self.reportMissingAssets();
                    if (callback) callback();
                }
            };

            // Iterate and load
            resources.forEach(function(path) {
                // Check if file extension is supported image
                if (!path.match(/\.(png|jpg|jpeg|bmp|gif)$/i)) {
                     onResourceProcessed();
                     return;
                }

                cc.loader.loadImg(path, {isCrossOrigin : false}, function(err, img) {
                    if (err) {
                        console.warn("[AssetLoader] Resource missing or failed to load: " + path + ". Will use placeholder.");
                        self.missingAssets[path] = true;
                    } else {
                        // console.log("[AssetLoader] Loaded: " + path);
                    }
                    onResourceProcessed();
                });
            });
        },

        /**
         * Register SVG config helper
         * @private
         */
        _registerSvg: function(path, config) {
            this.svgConfigs[path] = {
                path: config.svgPath,
                size: config.svgSize,
                color: config.svgColor,
                stroke: config.svgStroke,
                strokeWidth: config.svgStrokeWidth
            };
        },

        /**
         * Report missing assets to console
         */
        reportMissingAssets: function() {
            var missingKeys = Object.keys(this.missingAssets);
            if (missingKeys.length > 0) {
                console.group("%c[AssetLoader] Missing Resources Checklist (Phase 2)", "color: orange; font-weight: bold; font-size: 12px;");
                console.log("The following assets were not found and are being substituted with Placeholders/SVG:");
                console.table(missingKeys.map(function(k) { return { "Asset Path": k, "Status": "Using Fallback" }; }));
                console.groupEnd();
            } else {
                console.log("%c[AssetLoader] All Phase 2 assets loaded successfully!", "color: green; font-weight: bold;");
            }
        },

        /**
         * Create a sprite or a placeholder if missing
         * @param {String} path
         * @returns {cc.Node} (cc.Sprite or cc.LayerColor)
         */
        createSafeSprite: function(path) {
            if (this.missingAssets[path]) {
                // Try to generate from SVG if config exists and generator is available
                if (this.svgConfigs[path] && this.svgGenerator) {
                    var svg = this.svgConfigs[path];
                    var texture = this.svgGenerator.generate(
                        path, 
                        svg.path, 
                        svg.size ? svg.size.w : 64, 
                        svg.size ? svg.size.h : 64, 
                        svg.color,
                        svg.stroke,
                        svg.strokeWidth
                    );
                    
                    // If texture generated successfully (it should be cached by generator)
                    if (texture) {
                        return new cc.Sprite(texture);
                    }
                }

                var colorArr = this.fallbackColors[path] || [200, 200, 200];
                var color = cc.color(colorArr[0], colorArr[1], colorArr[2], 255);
                
                // Placeholder size - standard tile size or based on type?
                // Defaulting to 64x64
                var width = 64; 
                var height = 64;
                
                var node = new cc.LayerColor(color, width, height);
                node.ignoreAnchorPointForPosition(false); 
                node.setAnchorPoint(0.5, 0.5);
                
                return node;
            } else {
                return new cc.Sprite(path);
            }
        },
        
        /**
         * Get texture or fallback dummy
         */
        getTexture: function(path) {
             if (this.missingAssets[path]) {
                 return null;
             }
             return cc.textureCache.getTextureForKey(path);
        }
    });
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = createAssetLoader;
}
