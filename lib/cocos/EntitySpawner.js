/**
 * EntitySpawner.js
 * 实体生成管理器 - 适用于 Cocos2d-js / Cocos Creator
 * 功能：对象池管理、权重生成、自动回收
 */

var createEntitySpawner = function(cc) {
    return cc.Class.extend({
    /**
     * @param {cc.Node} parentNode - 父节点，实体将添加到此节点
     * @param {Object} config - 配置对象
     * @param {Object} assetLoader - 资源加载器实例
     */
    ctor: function (parentNode, config, assetLoader) {
        this.parentNode = parentNode;
        this.config = config;
        this.assetLoader = assetLoader;
        this.spawnTimer = 0;
        this.baseSpeed = config.speed || 200;
        
        this.pools = {}; // 存储所有对象池 map: id -> cc.NodePool
        this.activeEntities = []; // 存储当前活跃的实体
        
        this._initPools();
    },

    /**
     * 初始化对象池
     * @private
     */
    _initPools: function () {
        var self = this;
        this.config.types.forEach(function (typeConfig) {
            var pool = new cc.NodePool();
            self.pools[typeConfig.id] = pool;
            
            // 预生成对象 (可选，如果需要预热)
            if (typeConfig.initialPoolSize) {
                 for (var i = 0; i < typeConfig.initialPoolSize; i++) {
                     var node = self._createEntityNode(typeConfig);
                     pool.put(node);
                 }
            }
        });
    },

    /**
     * 创建实体节点（当池为空时调用）
     * @private
     */
    _createEntityNode: function (typeConfig) {
        // 这里假设是简单的 Sprite，实际项目中可能是 Prefab 或自定义类
        var node;
        if (this.assetLoader) {
            node = this.assetLoader.createSafeSprite(typeConfig.path || typeConfig.prefabPath);
        } else {
            node = new cc.Sprite(typeConfig.path || typeConfig.prefabPath);
        }
        
        node.setAnchorPoint(0.5, 0); // 底部中心对齐
        
        // 绑定类型ID方便回收时识别
        node._entityType = typeConfig.id;
        
        // 如果需要物理碰撞体或其他组件，可以在这里添加
        return node;
    },

    /**
     * 从池中获取节点
     * @private
     */
    _getFromPool: function (typeId) {
        var pool = this.pools[typeId];
        if (pool.size() > 0) {
            return pool.get();
        } else {
            // 池空了，查找配置并创建新节点
            var typeConfig = this.config.types.find(function(t) { return t.id === typeId; });
            return this._createEntityNode(typeConfig);
        }
    },

    /**
     * 回收节点到池中
     * @param {cc.Node} node 
     */
    _recycleEntity: function (node) {
        var typeId = node._entityType;
        if (this.pools[typeId]) {
            this.pools[typeId].put(node);
        } else {
            node.removeFromParent();
        }
    },

    /**
     * 基于权重的随机生成逻辑
     * @private
     */
    _selectTypeByWeight: function () {
        var totalWeight = 0;
        this.config.types.forEach(function(t) { totalWeight += t.weight; });
        
        var randomVal = Math.random() * totalWeight;
        var currentWeight = 0;
        
        for (var i = 0; i < this.config.types.length; i++) {
            var type = this.config.types[i];
            currentWeight += type.weight;
            if (randomVal <= currentWeight) {
                return type;
            }
        }
        return this.config.types[0]; // Fallback
    },

    /**
     * 生成一个实体
     */
    spawnEntity: function () {
        var typeConfig = this._selectTypeByWeight();
        var entity = this._getFromPool(typeConfig.id);
        
        // 设置位置
        // X轴：屏幕右侧外
        var startX = cc.winSize.width + 50;
        
        // Y轴：根据配置对齐（Phase 2 视觉坐标）
        var startY = 0;
        if (this.config.yPositions && this.config.yPositions.length > 0) {
            var randIdx = Math.floor(Math.random() * this.config.yPositions.length);
            startY = this.config.yPositions[randIdx];
        }
        
        entity.setPosition(startX, startY);
        this.parentNode.addChild(entity);
        this.activeEntities.push(entity);
        
        // 可以在这里重置实体的状态，例如血量、动画等
    },

    /**
     * 每帧更新
     * @param {Number} dt 
     */
    update: function (dt) {
        // 1. 生成逻辑
        this.spawnTimer += dt;
        if (this.spawnTimer >= this.config.spawnInterval) {
            this.spawnEntity();
            this.spawnTimer = 0;
        }

        // 2. 移动与回收逻辑
        // 倒序遍历以便安全删除
        for (var i = this.activeEntities.length - 1; i >= 0; i--) {
            var entity = this.activeEntities[i];
            
            // 移动
            entity.x -= this.baseSpeed * dt;
            
            // 检测是否移出屏幕左侧
            // 假设实体宽度不超过 100，设置一个安全阈值
            if (entity.x < -100) {
                // 回收
                this._recycleEntity(entity);
                // 从活跃列表中移除
                this.activeEntities.splice(i, 1);
            }
        }
    },

    /**
     * 动态调整速度
     */
    updateSpeed: function (newSpeed) {
        this.baseSpeed = newSpeed;
    },

    /**
     * 清理所有实体
     */
    clearAll: function () {
        for (var i = 0; i < this.activeEntities.length; i++) {
            this._recycleEntity(this.activeEntities[i]);
        }
        this.activeEntities = [];
        
        // 清空对象池（如果需要释放内存）
        for (var key in this.pools) {
            this.pools[key].clear();
        }
    }
    });
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = createEntitySpawner;
}
