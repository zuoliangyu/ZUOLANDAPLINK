# 更新日志

所有重要的项目变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.2] - 2026-01-23

### 改进
- 🎨 **Flash进度回调优化** - 实现真实的烧录进度跟踪，显示准确的进度百分比和字节数
- 🎨 优化进度计算逻辑，擦除阶段0-30%，编程阶段30-95%
- 🎨 显示详细进度信息（如"已编程 32768/65536 字节"）

### 修复
- 🐛 修复未使用的导入警告（Header.tsx中的FileDown）

### 技术细节
- 使用 `Arc<Mutex<ProgressState>>` 跟踪累积进度
- 实现 `ProgressState` 结构体，跟踪擦除和编程阶段的字节数
- 通过 `DownloadOptions.progress` 设置进度回调
- 进度回调实时发送事件到前端显示

## [0.3.1] - 2026-01-23

### 新增
- ✨ **高级擦除对话框** - 点击"擦除Flash"按钮弹出对话框，支持全片擦除和自定义范围擦除
- ✨ **GD32F470系列支持** - 新增6个GD32F470型号（VGT6/VIT6/ZGT6/ZIT6/IGT6/IIT6）
- ✨ **EraseDialog组件** - 新增擦除对话框组件 (`src/components/dialogs/EraseDialog.tsx`)
- ✨ **UI组件扩展** - 新增dialog、label、radio-group基础UI组件

### 改进
- 🎨 优化工具栏布局，添加"烧录模式:"标签，避免擦除模式选择器混淆
- 🎨 改进擦除功能，独立擦除操作使用对话框，烧录时擦除使用下拉框
- 🎨 优化进度显示，显示详细字节数（如"已编程 32768/65536 字节"）

### 修复
- 🐛 **修复Flash进度条显示错误** - 之前显示5500%，现在正确显示0-100%
- 🐛 **修复日志面板拖动方向** - 向下拖动面板变高，向上拖动面板变矮（符合直觉）

### 技术细节
- 使用 `Arc<Mutex<ProgressState>>` 跟踪Flash操作进度状态
- 根据实际字节数计算进度（填充0-20%，擦除20-50%，编程50-95%）
- 反转日志面板拖动的deltaY计算
- 添加依赖：@radix-ui/react-label, @radix-ui/react-radio-group, class-variance-authority
- 扩展 `handleEraseConfirm` 函数，支持全片擦除和自定义范围擦除

## [0.3.0] - 2026-01-23

### 新增
- ✨ **CMSIS-Pack导入UI** - 在侧边栏添加Pack管理界面，支持导入和查看Pack列表
- ✨ **自定义ROM地址配置** - 支持Keil风格的IROM1地址和大小配置
- ✨ **一键填充芯片默认值** - 自动从芯片信息读取Flash配置
- ✨ **十六进制地址输入** - 支持0x格式的地址和大小输入
- ✨ **日志面板可拖动调整大小** - 支持80-600px范围调整
- ✨ **PackManager组件** - 新增Pack管理UI组件 (`src/components/config/PackManager.tsx`)

### 改进
- 🎨 优化烧录设置界面，添加Keil风格的ROM配置
- 🎨 改进Pack管理，显示Pack详细信息（厂商、版本、设备数）
- 🎨 优化日志面板，修复滚动方向，添加拖动手柄
- 🎨 扩展flashStore状态管理，支持自定义地址配置
- 🎨 改进MainArea组件，添加自定义ROM地址配置UI

### 修复
- 🐛 修复自定义地址在BIN文件烧录时的应用逻辑
- 🐛 修复日志面板滚动到顶部的问题（现在正确滚动到底部）

### 技术细节
- 扩展 `FlashOptions` 结构，添加自定义地址字段
- 修改 `flash_firmware` 函数，支持使用自定义地址烧录BIN文件
- 新增 `useCustomAddress`, `customFlashAddress`, `customFlashSize` 状态
- 实现拖动调整日志面板高度功能

## [0.2.0] - 2026-01-23

### 新增
- ✨ **支持更多国产芯片** - 添加GD32全系列（F0/F1/F2/F3/F4/E/L）和CW32系列支持
- ✨ **DAP版本显示** - 显示探针DAP版本信息（DAPv1 HID / DAPv2 WinUSB）
- ✨ **RTT双模式显示** - 支持文本和Hex两种显示模式，可一键切换
- ✨ **自动断开连接** - 可配置无操作自动断开连接（5-300秒可选）
- ✨ **用户活动检测** - RTT运行时自动禁用断开功能
- ✨ **useUserActivity Hook** - 新增用户活动检测Hook (`src/hooks/useUserActivity.ts`)

### 改进
- 🎨 优化探针选择界面，显示更多信息（DAP版本、序列号）
- 🎨 优化RTT工具栏，添加显示模式切换按钮
- 🎨 优化侧边栏布局，添加自动断开配置卡片
- 🎨 扩展ProbeInfo结构，添加dap_version字段
- 🎨 扩展ConnectionInfo结构，添加probe_serial和target_idcode字段

### 修复
- 🐛 修复RTT数据解析中的字节对齐问题
- 🐛 修复Sidebar中ConnectionInfo类型不匹配问题

### 技术细节
- 在 `BUILTIN_CHIPS` 中添加40+国产芯片型号
- 实现DAP版本检测逻辑（基于probe_type判断）
- 扩展RttStore，添加displayMode状态和Hex格式化功能
- 实现用户活动监听（mousedown, mousemove, keydown, scroll等）
- 添加自动断开配置（autoDisconnect, autoDisconnectTimeout）

## [0.1.0] - 2026-01-22

### 新增
- 🎉 初始版本发布
- ✨ 基础探针检测和连接功能
- ✨ 固件烧录功能（支持ELF/HEX/BIN）
- ✨ RTT实时日志输出
- ✨ Flash操作（读取、校验、擦除）
- ✨ 内存访问功能
- ✨ 内置150+常用芯片支持

### 技术栈
- 前端：React 18 + TypeScript + Tailwind CSS + Zustand
- 后端：Rust + Tauri 2.0 + probe-rs 0.27
- UI组件：Radix UI + Lucide Icons

---

[0.3.2]: https://github.com/zuoliangyu/ZUOLANDAPLINK/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/zuoliangyu/ZUOLANDAPLINK/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/zuoliangyu/ZUOLANDAPLINK/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/zuoliangyu/ZUOLANDAPLINK/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/zuoliangyu/ZUOLANDAPLINK/releases/tag/v0.1.0
