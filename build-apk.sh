#!/bin/bash

# 指令式核心：固化 WSL2 项目根路径
PROJECT_PATH="/mnt/d/project/city-lord"
CONFIG_FILE="$PROJECT_PATH/capacitor.config.json"
NEXT_CONFIG="$PROJECT_PATH/next.config.js"

echo "=================================================="
echo "🚀 息壤引擎自动化编译流水线：静态大导出+生产环境版"
echo "=================================================="

# 1. 物理切入项目目录
cd "$PROJECT_PATH" || exit 1

# ==================================================
# 🛑 【核心硬核覆写 1：强制 Capacitor 脱离本地服务器】
# ==================================================
echo "⚙️ 正在动态修改配置文件，切换为室外路测远程环境..."
if [ -f "$CONFIG_FILE" ]; then
    cp "$CONFIG_FILE" "${CONFIG_FILE}.local.bak"
    
    # 彻底抹除 server 节点，禁止 APK 寻找任何本地或远程端口，强制其读取本地打包进去的 dist 资源
    node -e "
const fs = require('fs');
const config = require('$CONFIG_FILE');
if (config.server) { delete config.server; }
fs.writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2));
"
    echo "🟩 已物理清洗本地 server 调试节点"
fi

# ==================================================
# 🛑 【核心硬核覆写 2：强制 Next.js 开启全量静态导出】
# ==================================================
echo "🔧 正在拦截并强行注入 Next.js 静态导出策略..."
if [ -f "$NEXT_CONFIG" ]; then
    cp "$NEXT_CONFIG" "${NEXT_CONFIG}.local.bak"
    
    # 用 Node 脚本物理强灌 output: 'export' 进 next.config.js，确保不走任何本地端口服务
    node -e "
const fs = require('fs');
let content = fs.readFileSync('$NEXT_CONFIG', 'utf8');
if (!content.includes('output:')) {
    content = content.replace('module.exports = {', \"module.exports = {\n  output: 'export',\n  images: { unoptimized: true },\");
} else {
    content = content.replace(/output:\s*['\"].*?['\"]/, \"output: 'export'\");
}
fs.writeFileSync('$NEXT_CONFIG', content, 'utf8');
"
    echo "🟩 Next.js 静态导出机制（output: export）已被强行焊死"
fi

# 🚨 【生产环境全局变量硬核注入】
export NEXT_PUBLIC_API_URL="https://cl1.4567666.xyz"
export NODE_ENV="production"

# 2. 全量物理洗净幽灵缓存
echo "🧹 正在物理铲除历史编译残留与幽灵缓存..."
rm -rf .next dist android/app/src/main/assets/public

# 3. 纯净编译最新前端静态产物并同步进安卓壳子
echo "📦 正在执行纯静态全量生产编译..."
npm run build && CAPACITOR_TELEMETRY_DISABLED=1 npx cap sync android

# 4. 进入 Android 底层工程执行 Clean
cd android || exit 1
chmod +x gradlew
./gradlew clean

# 5. 开始原生二进制打包
echo "🏗️ 正在全速编译最新路测版 Debug APK..."
./gradlew assembleDebug

# ==================================================
# 🛑 【全量环境回滚：不耽误回办公室继续本地调试】
# ==================================================
echo "🔄 正在物理还原本地开发所有配置文件..."
cd "$PROJECT_PATH" || exit 1
if [ -f "${CONFIG_FILE}.local.bak" ]; then
    mv "${CONFIG_FILE}.local.bak" "$CONFIG_FILE"
fi
if [ -f "${NEXT_CONFIG}.local.bak" ]; then
    mv "${NEXT_CONFIG}.local.bak" "$NEXT_CONFIG"
fi
echo "🟩 本地开发环境已无感恢复"

# ==================================================
# 6. 🎯 【公网直链快递模块 - 文本直发 ClawBot 聊天窗】
# ==================================================
REAL_APK_PATH="/mnt/d/project/city-lord/android/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$REAL_APK_PATH" ]; then
    echo "🟩 真正的离线生产版物理包编译成功！"
    echo "☁️ 正在将物理包上传至公网临时托管网关..."
    
    PUBLIC_URL=$(curl -s --upload-file "$REAL_APK_PATH" "https://bashupload.com/city_lord_pure_production.apk")
    
    if [ -z "$PUBLIC_URL" ]; then
         PUBLIC_URL=$(curl -s --upload-file "$REAL_APK_PATH" "https://transfer.sh/city_lord_pure_production.apk")
    fi

    echo "🌐 公网专属下载直链已生成: $PUBLIC_URL"
    echo "📦 正在通过 ClawBot 将直链砸进微信..."
    
    curl -X POST "http://127.0.0.1:8080/api/send-message" \
      -H "Content-Type: application/json" \
      -d "{
        \"target\": \"weixin:o9cq808c6bPfYKah_UC1FBHzVuJE@im.wechat\",
        \"message\": \"✅ City Lord 纯净大编译成功！\n\n🏃‍♂️ 飞哥，【真正的脱机离线/纯公网域名版】专属固件全线通车！此包已彻底斩断本地 Node 端口依赖，数据全面绑定公网接口：cl1.4567666.xyz\n\n手机直接点击下方公网链接即可瞬间下载安装：\n${PUBLIC_URL}\"
      }"
      
    echo ""
    echo "=================================================="
    echo "🎉 终极闭环完毕！飞哥，请点击微信链接下载，这次绝对是纯外网脱机包！"
    echo "=================================================="
else
    echo "❌ 错误：在输出位置没有找到 APK 文件！"
    exit 1
fi