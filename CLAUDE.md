# ZUOLANDAPLINK 项目开发规范

## 文档规范

### docs/ 目录用途

**只放置面向用户的功能使用文档**

✅ **应该包含的内容**：
- 功能使用说明
- 用户操作指南
- 配置说明
- 常见问题解答（面向用户）

❌ **不应该包含的内容**：
- 实现细节和技术架构
- 问题解决过程
- 开发调试记录
- 代码实现说明
- 中间过程文档

### 示例

**好的文档标题**：
- `RTT_USAGE.md` - RTT 功能使用指南
- `PACK_IMPORT.md` - 如何导入 CMSIS-Pack
- `FLASH_GUIDE.md` - 固件烧录指南

**不好的文档标题**：
- `FLASH_ALGORITHM_IMPLEMENTATION.md` - 实现细节
- `GD32F470_SOLUTION.md` - 问题解决过程
- `PACK_INTEGRATION_GUIDE.md` - 集成开发指南

## 代码规范

### 注释语言

- 代码注释应与现有代码库保持一致
- 自动检测项目主要使用的注释语言
- 保持代码库语言统一

### 提交规范

- 遵循 Conventional Commits 规范
- 不要主动执行 git 操作，除非用户明确要求

## 版本发布清单

### 发布新版本时必须更新的文件

每次发布新版本（包括测试版）时，必须同步更新以下所有文件中的版本号：

1. **`package.json`** (第 4 行)
   ```json
   "version": "0.4.0-beta.2"
   ```

2. **`src-tauri/Cargo.toml`** (第 3 行)
   ```toml
   version = "0.4.0-beta.2"
   ```

3. **`src-tauri/tauri.conf.json`** (第 4 行)
   ```json
   "version": "0.4.0-beta.2"
   ```

4. **`README.md`** (第 5 行 - 版本徽章)
   ```markdown
   ![Version](https://img.shields.io/badge/version-0.4.0--beta.2-blue)
   ```

5. **`CHANGELOG.md`** (顶部添加新版本条目)
   ```markdown
   ## [0.4.0-beta.2] - 2026-01-24
   ```

### 版本号格式

- **正式版本**: `0.4.0`
- **测试版本**: `0.4.0-beta.1`, `0.4.0-beta.2`
- **候选版本**: `0.4.0-rc.1`
- **开发版本**: `0.4.0-alpha.1`

### 发布流程

1. 更新上述 5 个文件中的版本号
2. 更新 CHANGELOG.md 添加新版本的更新内容
3. 提交更改：`git commit -m "chore: 发布 vX.X.X"`
4. 创建 tag：`git tag -a vX.X.X -m "Release vX.X.X - 描述"`
5. 推送代码和 tag：`git push origin main && git push origin vX.X.X`

### 注意事项

⚠️ **版本号必须在所有文件中保持一致**，否则会导致构建失败！

## 开发原则

### KISS (Keep It Simple, Stupid)
- 追求代码和设计的极致简洁
- 拒绝不必要的复杂性

### YAGNI (You Aren't Gonna Need It)
- 仅实现当前明确所需的功能
- 抵制过度设计

### DRY (Don't Repeat Yourself)
- 自动识别重复代码模式
- 主动建议抽象和复用

### SOLID 原则
- 单一职责、开闭原则、里氏替换、接口隔离、依赖倒置
