#!/bin/bash

# 城市领主代码分析脚本
# 使用 curl 调用本地 Qwen3.5 API

API_URL="http://127.0.0.1:8080/v1/chat/completions"
FILE="$1"
MODEL="Qwen3.5-9B-UD-Q4_K_XL"

# 如果未指定文件，默认分析当前目录
if [ -z "$FILE" ]; then
    FILE=$(pwd)
fi

# 构建请求
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {
        \"role\": \"user\",
        \"content\": \"请分析以下文件:\n\n```\n$(cat "$FILE" 2>/dev/null | head -500)\n```\n\n文件路径：$FILE\n\n请指出潜在问题、优化建议和改进方案。\"
      }
    ],
    \"temperature\": 0.3,
    \"max_tokens\": 2000
  }")

# 输出结果
echo "$RESPONSE" | jq -r '.choices[0].message.content // "API 响应异常"'
