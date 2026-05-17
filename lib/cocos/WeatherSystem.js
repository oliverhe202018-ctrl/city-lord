/**
 * WeatherSystem.js
 * 天气系统 - 使用粒子系统实现雨/雪/落叶效果
 * 优化：支持根据性能模式调整粒子数量
 */

var createWeatherSystem = function(cc) {
    return cc.Class.extend({
        /**
         * @param {cc.Node} parentNode - 父节点
         * @param {Object} config - 配置
         * @param {Boolean} isLowPowerMode - 是否为低性能模式
         */
        ctor: function (parentNode, config, isLowPowerMode) {
            this.parentNode = parentNode;
            this.config = config || {};
            this.isLowPowerMode = isLowPowerMode || false;
            this.currentParticle = null;
            
            // 预定义天气类型
            this.types = {
                RAIN: 'rain',
                SNOW: 'snow',
                LEAVES: 'leaves'
            };
        },

        /**
         * 设置天气
         * @param {String} type - 'rain' | 'snow' | 'leaves'
         */
        setWeather: function (type) {
            // 清除旧天气
            if (this.currentParticle) {
                this.currentParticle.removeFromParent();
                this.currentParticle = null;
            }

            if (!type) return;

            var particle;
            var winSize = cc.winSize;

            switch (type) {
                case this.types.RAIN:
                    particle = new cc.ParticleRain();
                    // 调整纹理（实际项目中应加载图片，这里使用默认的base64或内置形状）
                    // particle.texture = cc.textureCache.addImage("res/rain.png"); 
                    
                    // 调整参数以模拟向左的风（逆着玩家奔跑方向）
                    particle.setGravity(cc.p(-500, -1000)); // x向左强风，y向下
                    particle.setSpeed(600);
                    particle.setSpeedVar(100);
                    particle.setAngle(260); // 略微向左下
                    particle.setAngleVar(10);
                    
                    // 颜色微调 (蓝白色)
                    particle.setStartColor(cc.color(200, 200, 255, 200));
                    particle.setEndColor(cc.color(200, 200, 255, 50));
                    break;

                case this.types.SNOW:
                    particle = new cc.ParticleSnow();
                    particle.setGravity(cc.p(-100, -100)); // 轻微向左
                    particle.setSpeed(150);
                    particle.setAngle(240);
                    
                    // 增加大小变化
                    particle.setStartSize(10);
                    particle.setStartSizeVar(5);
                    break;
                    
                case this.types.LEAVES:
                    // 自定义粒子系统模拟落叶
                    particle = new cc.ParticleSystem();
                    // 需要设置属性... 由于没有内置ParticleLeaves，这里模拟通用配置
                    particle.setDuration(-1);
                    particle.setGravity(cc.p(-200, -50));
                    particle.setAngle(180);
                    particle.setAngleVar(45);
                    particle.setSpeed(200);
                    particle.setSpeedVar(50);
                    
                    // 发射器位置
                    particle.setPosition(winSize.width + 50, winSize.height);
                    particle.setPosVar(cc.p(50, winSize.height / 2));
                    
                    particle.setLife(4);
                    particle.setLifeVar(1);
                    
                    particle.setStartSize(20);
                    particle.setStartSizeVar(10);
                    particle.setEndSize(10);
                    
                    // 橙黄色
                    particle.setStartColor(cc.color(255, 165, 0, 255));
                    particle.setStartColorVar(cc.color(20, 20, 0, 0));
                    particle.setEndColor(cc.color(255, 100, 0, 0));
                    
                    // 必须设置 totalParticles 否则默认为0或很小
                    particle.setTotalParticles(100);
                    particle.setEmissionRate(particle.getTotalParticles() / particle.getLife());
                    break;
            }

            if (particle) {
                // 性能优化：根据模式调整粒子数量
                if (this.isLowPowerMode) {
                    var reducedCount = Math.floor(particle.getTotalParticles() * 0.5);
                    particle.setTotalParticles(reducedCount);
                    // 重新计算发射率
                    if (particle.getLife() > 0) {
                        particle.setEmissionRate(reducedCount / particle.getLife());
                    }
                }

                // 设置通用位置 (顶部全屏宽度)
                if (type !== this.types.LEAVES) {
                    particle.setPosition(winSize.width / 2, winSize.height + 10);
                    particle.setPosVar(cc.p(winSize.width / 2, 0));
                }

                this.parentNode.addChild(particle, 20); // Z-order 较高
                this.currentParticle = particle;
            }
        },

        /**
         * 动态调整风速（例如根据玩家速度）
         * @param {Number} speedFactor - 0.0 to 2.0
         */
        updateWindSpeed: function(speedFactor) {
            if (!this.currentParticle) return;
            
            // 简单修改重力 X 分量来模拟风速变化
            var baseGravityX = -500; // 默认
            if (this.currentParticle instanceof cc.ParticleSnow) baseGravityX = -100;
            
            var currentG = this.currentParticle.getGravity();
            this.currentParticle.setGravity(cc.p(baseGravityX * speedFactor, currentG.y));
        }
    });
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = createWeatherSystem;
}
