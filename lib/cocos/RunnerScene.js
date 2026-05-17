
// RunnerScene.js
// Factory function to create the RunnerScene class
// Dependencies: cc, ParallaxManager, EntitySpawner, WeatherSystem, LightingEffects

var createRunnerScene = function(cc, ParallaxManager, EntitySpawner, WeatherSystem, LightingEffects, assetLoader, mapConfig) {
    return cc.Scene.extend({
        onEnter: function () {
            this._super();
            
            this.assetLoader = assetLoader;
            this.mapConfig = mapConfig;

            // Check low power mode (simple heuristic: pixel ratio < 2 or explicit flag)
            // In browser environment, we might not know easily, default to false
            this.isLowPower = false; 
            
            // Layer
            this.gameLayer = new cc.Layer();
            this.addChild(this.gameLayer);
            
            // 1. Init Background
            this.initBackground();
            
            // 2. Init Weather (Behind entities, in front of BG)
            this.initWeather();

            // 3. Init Spawner
            this.initSpawner();
            
            // 4. Init Player (Placeholder)
            this.initPlayer();
            
            // 5. Start Update Loop
            this.scheduleUpdate();
        },

        initBackground: function () {
            // Using placeholder images or colors if images not found
            // In a real scenario, we need actual assets
            var bgConfigs = this.mapConfig ? this.mapConfig.parallax : [
                { path: "res/bg_far.png", factor: 0.2 },
                { path: "res/bg_mid.png", factor: 0.5 },
                { path: "res/ground.png", factor: 1.0 }
            ];
            
            // Create a node to hold backgrounds
            this.bgNode = new cc.Node();
            this.gameLayer.addChild(this.bgNode, 0); // zOrder 0
            
            this.parallaxManager = new ParallaxManager(this.bgNode, bgConfigs, 200, this.assetLoader);
        },

        initWeather: function() {
            this.weatherNode = new cc.Node();
            this.gameLayer.addChild(this.weatherNode, 2); // zOrder 2 (between BG and Entities)
            
            this.weatherSystem = new WeatherSystem(this.weatherNode, {}, this.isLowPower);
            
            // Start with rain
            this.weatherSystem.setWeather('rain');
        },

        initSpawner: function () {
            // Create a node to hold entities
            this.entityNode = new cc.Node();
            this.gameLayer.addChild(this.entityNode, 5); // zOrder 5
            
            var spawnConfig = this.mapConfig ? this.mapConfig.spawner : {
                spawnInterval: 1.5,
                speed: 300,
                yPositions: [100, 200, 300], // Runner lanes
                types: [
                    { id: 'coin', weight: 60, prefabPath: 'res/coin.png', poolSize: 20 },
                    { id: 'obstacle', weight: 30, prefabPath: 'res/obstacle.png', poolSize: 10 }
                ]
            };
            
            this.spawner = new EntitySpawner(this.entityNode, spawnConfig, this.assetLoader);
            
            // Hook into spawner to add effects to new entities
            // We can override or monkey-patch _createEntityNode or just handle it if Spawner emitted events
            // For now, let's modify the spawner instance's _createEntityNode method (A bit hacky but works for composition)
            var originalCreate = this.spawner._createEntityNode.bind(this.spawner);
            var self = this;
            
            this.spawner._createEntityNode = function(typeConfig) {
                var node = originalCreate(typeConfig);
                
                // Add effects based on type
                if (typeConfig.id === 'coin') {
                    // Gold Glow
                    LightingEffects.createGlow(node, cc.color(255, 215, 0), 1.5, self.isLowPower);
                    // Breathing
                    LightingEffects.addBreathingEffect(node, 1.0, 200, 255);
                } else if (typeConfig.id === 'obstacle') {
                    // Red ominous glow?
                    // LightingEffects.createGlow(node, cc.color(255, 0, 0), 1.2, self.isLowPower);
                }
                
                return node;
            };
            
            // We also need to re-init pools because they were created in constructor with original method
            // But actually _createEntityNode is called when pool is empty. 
            // The pools created in constructor might have used the original method if they pre-warmed.
            // Since we commented out pre-warming in EntitySpawner, we are safe.
        },
        
        initPlayer: function () {
            this.player = new cc.Sprite("res/player.png");
            this.player.x = 100;
            this.player.y = 100; // Lane 1
            this.gameLayer.addChild(this.player, 10);
            
            // Player aura
            LightingEffects.createGlow(this.player, cc.color(0, 255, 255), 1.3, this.isLowPower);
        },

        update: function (dt) {
            // Update managers
            if (this.parallaxManager) this.parallaxManager.update(dt);
            if (this.spawner) this.spawner.update(dt);
            
            // Update wind speed based on game speed (if variable)
            if (this.weatherSystem) {
                // Example: slightly vary wind
                // this.weatherSystem.updateWindSpeed(1.0); 
            }
            
            // Simple collision detection (Example)
            // In a real game, this would be more complex
            this.checkCollisions();
        },
        
        checkCollisions: function() {
            // Access active entities from spawner
            var entities = this.spawner.activeEntities;
            var playerRect = this.player.getBoundingBox();
            
            for (var i = 0; i < entities.length; i++) {
                var entity = entities[i];
                if (cc.rectIntersectsRect(playerRect, entity.getBoundingBox())) {
                    // Collision!
                    cc.log("Collision with " + entity._entityType);
                    
                    if (entity._entityType === 'coin') {
                        // Collect coin
                        this.spawner._recycleEntity(entity);
                        this.spawner.activeEntities.splice(i, 1);
                        i--; // Adjust index
                    } else {
                        // Hit obstacle - Game Over logic
                    }
                }
            }
        }
    });
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = createRunnerScene;
}
