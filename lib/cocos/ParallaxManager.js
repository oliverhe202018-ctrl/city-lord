/**
 * ParallaxManager.js
 * 视差滚动背景管理器 - 适用于 Cocos2d-js / Cocos Creator
 */

var createParallaxManager = function(cc) {
    return cc.Class.extend({
    /**
     * @param {cc.Node} parentNode - 父节点，背景图将添加到此节点
     * @param {Array} layerConfigs - 配置数组
     * @param {Number} initialSpeed - 初始基础速度 (像素/秒)
     * @param {Object} assetLoader - 资源加载器实例
     */
    ctor: function (parentNode, layerConfigs, initialSpeed, assetLoader) {
        this.parentNode = parentNode;
        this.baseSpeed = initialSpeed || 0;
        this.layers = [];
        this.winSize = cc.winSize;
        this.assetLoader = assetLoader;

        this._initLayers(layerConfigs);
    },

    /**
     * 初始化所有图层
     * @private
     */
    _initLayers: function (configs) {
        for (var i = 0; i < configs.length; i++) {
            var config = configs[i];
            this._createLayer(config.path, config.factor, i);
        }
    },

    /**
     * 创建单个视差层（包含两个交替滚动的精灵）
     * @private
     */
    _createLayer: function (texturePath, factor, zOrder) {
        // 创建两个精灵用于循环拼接
        var sprite1, sprite2;
        
        if (this.assetLoader) {
            sprite1 = this.assetLoader.createSafeSprite(texturePath);
            sprite2 = this.assetLoader.createSafeSprite(texturePath);
        } else {
            sprite1 = new cc.Sprite(texturePath);
            sprite2 = new cc.Sprite(texturePath);
        }

        // 设置锚点为左下角，方便计算
        sprite1.setAnchorPoint(0, 0);
        sprite2.setAnchorPoint(0, 0);

        // 设置位置
        // 假设纹理宽度足以覆盖屏幕，或者需要缩放。这里假设宽度足够。
        // 如果宽度小于屏幕，可能需要更多精灵。这里假设 standard case: 2 sprites is enough.
        var width = sprite1.getContentSize().width;
        
        // 适配屏幕高度 (可选，根据需求)
        // var scaleY = this.winSize.height / sprite1.getContentSize().height;
        // sprite1.setScaleY(scaleY);
        // sprite2.setScaleY(scaleY);

        sprite1.x = 0;
        sprite2.x = width; // 紧接在第一个后面

        this.parentNode.addChild(sprite1, zOrder);
        this.parentNode.addChild(sprite2, zOrder);

        this.layers.push({
            sprites: [sprite1, sprite2],
            factor: factor,
            width: width,
            speed: 0 // 计算后的实际层速度
        });
    },

    /**
     * 每帧更新逻辑
     * @param {Number} dt - Delta Time (秒)
     */
    update: function (dt) {
        if (this.baseSpeed === 0) return;

        for (var i = 0; i < this.layers.length; i++) {
            var layer = this.layers[i];
            // 层移动距离 = 基础速度 * 视差系数 * 时间
            var moveDist = this.baseSpeed * layer.factor * dt;

            for (var j = 0; j < layer.sprites.length; j++) {
                var sprite = layer.sprites[j];
                sprite.x -= moveDist;
            }

            // 检查边界并循环
            this._checkAndLoop(layer);
        }
    },

    /**
     * 检查精灵是否移出屏幕并重置位置
     * @private
     */
    _checkAndLoop: function (layer) {
        var sprite1 = layer.sprites[0];
        var sprite2 = layer.sprites[1];

        // 假设向左滚动
        if (this.baseSpeed > 0) {
            // 如果 sprite1 完全移出左边界
            if (sprite1.x + layer.width < 0) {
                sprite1.x = sprite2.x + layer.width;
            }
            // 如果 sprite2 完全移出左边界
            if (sprite2.x + layer.width < 0) {
                sprite2.x = sprite1.x + layer.width;
            }
        } 
        // 支持向右滚动 (可选)
        else if (this.baseSpeed < 0) {
            if (sprite1.x > this.winSize.width) {
                sprite1.x = sprite2.x - layer.width;
            }
            if (sprite2.x > this.winSize.width) {
                sprite2.x = sprite1.x - layer.width;
            }
        }
    },

    /**
     * 更新基础滚动速度
     * @param {Number} newSpeed - 新的玩家速度
     */
    updateSpeed: function (newSpeed) {
        this.baseSpeed = newSpeed;
    },

    /**
     * 销毁清理
     */
    destroy: function() {
        this.layers.forEach(function(layer) {
            layer.sprites.forEach(function(sprite) {
                sprite.removeFromParent();
            });
        });
        this.layers = [];
    }
    });
};

// 如果是 CommonJS 环境 (如 Creator 3.x / Webpack)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = createParallaxManager;
}
