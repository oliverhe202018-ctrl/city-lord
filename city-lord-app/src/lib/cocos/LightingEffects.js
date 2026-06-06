/**
 * LightingEffects.js
 * 光效系统 - 提供呼吸灯、发光混合模式等特效工具
 * 优化：提供低性能回退方案
 */

var createLightingEffects = function(cc) {
    var LightingEffects = {
        assetLoader: null,

        /**
         * Initialize with asset loader
         */
        init: function(loader) {
            this.assetLoader = loader;
        },

        /**
         * 为节点添加呼吸灯效果 (周期性透明度变化)
         * @param {cc.Node} targetNode - 目标节点
         * @param {Number} duration - 单次呼吸周期(秒)
         * @param {Number} minOpacity - 最小透明度 (0-255)
         * @param {Number} maxOpacity - 最大透明度 (0-255)
         */
        addBreathingEffect: function(targetNode, duration, minOpacity, maxOpacity) {
            if (!targetNode) return;
            
            duration = duration || 1.5;
            minOpacity = minOpacity !== undefined ? minOpacity : 100;
            maxOpacity = maxOpacity !== undefined ? maxOpacity : 255;

            // 停止之前的动作，避免冲突
            targetNode.stopActionByTag(LightingEffects.TAG_BREATHING);

            var fadeOut = cc.fadeTo(duration, minOpacity);
            var fadeIn = cc.fadeTo(duration, maxOpacity);
            var seq = cc.sequence(fadeOut, fadeIn);
            var repeat = cc.repeatForever(seq);
            
            repeat.setTag(LightingEffects.TAG_BREATHING);
            targetNode.runAction(repeat);
        },

        /**
         * 创建发光层 (使用 additive blending)
         * @param {cc.Sprite|cc.Node} targetNode - 需要发光的源节点
         * @param {cc.Color} color - 发光颜色
         * @param {Number} scale - 发光范围缩放系数
         * @param {Boolean} isLowPower - 是否低性能模式 (若为真，可能跳过复杂的混合模式或仅使用简单半透明层)
         * @returns {cc.Sprite} - 返回创建的发光精灵，已添加到 targetNode 的父节点或 targetNode 上
         */
        createGlow: function(targetNode, color, scale, isLowPower) {
            // 如果是极低端设备，直接忽略光效
            if (isLowPower) return null;

            // 创建一个用于发光的 Sprite
            // 这里为了通用性，我们使用一个简单的圆形渐变纹理，或者复用 targetNode 的纹理
            // 假设我们复用纹理但使用 One, One 混合
            
            var glowSprite;
            if (targetNode instanceof cc.Sprite) {
                glowSprite = new cc.Sprite(targetNode.getTexture());
            } else {
                // 如果不是 Sprite，创建一个纯色光晕 (需要 glow 资源)
                if (LightingEffects.assetLoader) {
                    // Try to load 'res/glow_circle.png' which should be defined in MapConfig/resource.js
                    // If missing, AssetLoader will use the SVG fallback
                    glowSprite = LightingEffects.assetLoader.createSafeSprite("res/glow_circle.png");
                } else {
                    // Fallback if no loader
                    glowSprite = new cc.LayerColor(color, 50, 50); 
                    glowSprite.ignoreAnchorPointForPosition(false);
                }
            }

            glowSprite.setColor(color);
            glowSprite.setOpacity(150);
            glowSprite.setScale(scale || 1.2);
            
            // 关键：设置混合模式为叠加 (Additive)
            // SRC_ALPHA = 770, ONE = 1
            if (glowSprite.setBlendFunc) {
                glowSprite.setBlendFunc(cc.SRC_ALPHA, cc.ONE);
            }

            // 将光晕放在目标节点后面 (z-order -1)
            targetNode.addChild(glowSprite, -1);
            
            return glowSprite;
        },

        TAG_BREATHING: 9999
    };

    return LightingEffects;
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = createLightingEffects;
}
