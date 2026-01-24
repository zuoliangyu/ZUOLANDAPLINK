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
