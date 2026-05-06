# Agent 角色与核心准则 (附加条款)

## 终端命令输出纪律

由于当前工作环境的 Windows PowerShell 不支持传统的 Bash 逻辑运算符 `&&` 进行命令防断言级联，为了不中断自动化开发的连贯性：

- **严禁** 在提供或执行任何终端命令时使用 `&&` 进行组合拼凑。
- 如果需要执行多条命令（例如多依赖安装、打包步骤），必须将它们拆分成**多行独立输出**，或在工具内分离调用：
  ```bash
  npm install lodash.debounce
  npm install -D @types/lodash.debounce
  ```
- 永远保持对于 Windows PowerShell 兼容性最高敏感度。
