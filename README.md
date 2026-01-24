# ZUOLAN DAPLINK RTTVIEW

一个开源的第三方DAPLINK烧录软件，基于Tauri + React + Rust技术栈开发，使用probe-rs作为底层调试库。

![Version](https://img.shields.io/badge/version-0.4.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 功能特性

### 核心功能
- **探针检测** - 自动检测连接的DAPLINK/CMSIS-DAP设备，显示DAP版本（DAPv1 HID / DAPv2 WinUSB）
- **多接口支持** - 支持SWD和JTAG调试接口，可调节时钟速度（100kHz - 10MHz）
- **固件烧录** - 支持ELF/HEX/BIN格式固件烧录，支持全片擦除和扇区擦除
- **Flash算法选择** - 支持手动选择Flash算法，可从CMSIS-Pack导入自定义算法
- **Flash操作** - 支持Flash读取、校验、擦除等完整操作
- **内存访问** - 支持内存读写和寄存器查看
- **芯片数据库** - 内置150+常用芯片，支持Keil CMSIS-Pack扩展

### RTT调试功能
- **实时日志输出** - 通过SWD/JTAG接口直接读取目标内存，无需额外串口
- **图表可视化** - 实时数据图表，支持折线图、柱状图、散点图、XY散点图
- **智能配置** - 一键检测数据格式（单数值/XY/CSV/JSON）并自动配置图表
- **图表交互** - 支持缩放、拖动、统计信息显示
- **双模式显示** - 支持文本和十六进制（Hex）两种显示模式，可一键切换
- **ANSI颜色支持** - 支持终端颜色代码和自定义颜色标记，可显示彩色日志
- **多通道支持** - 支持多个RTT上行/下行通道，可按通道过滤
- **高速传输** - 比传统UART打印快数倍
- **智能功能** - 自动滚动、关键字搜索、日志级别识别
- **数据导出** - 支持导出为TXT和CSV格式

### 智能管理
- **自动断开** - 可配置无操作自动断开连接（5-300秒可选），RTT运行时自动禁用
- **实时状态** - 实时显示连接状态、芯片信息、DAP版本
- **日志系统** - 完整的操作日志记录，支持不同级别（info/warn/error/success）

## 🎯 支持的芯片

### 内置支持

| 厂商 | 系列 | 数量 |
|------|------|------|
| **ST** | STM32F0/F1/F2/F3/F4, STM32G0/G4, STM32L0/L4 | 100+ |
| **兆易创新 (GigaDevice)** | GD32F0/F1/F2/F3/F4, GD32E, GD32L | 40+ |
| **武汉芯源 (CW32)** | CW32F003/F030/F103, CW32L031/L052 | 8+ |
| **Nordic** | nRF51822, nRF52832/52833/52840 | 6+ |
| **Raspberry Pi** | RP2040 | 1 |
| **Espressif** | ESP32-C3/C6/S3 | 3 |

#### GD32系列详细支持
- **GD32F0**: GD32F150, GD32F190
- **GD32F1**: GD32F103 (兼容STM32F1)
- **GD32F2**: GD32F205, GD32F207
- **GD32F3**: GD32F303, GD32F305, GD32F307
- **GD32F4**: GD32F405, GD32F407, GD32F450
- **GD32E**: GD32E103, GD32E230
- **GD32L**: GD32L233 (低功耗系列)

#### CW32系列详细支持
- **CW32F0**: CW32F003, CW32F030
- **CW32F1**: CW32F103
- **CW32L**: CW32L031, CW32L052 (低功耗系列)

### 扩展支持

可通过导入Keil CMSIS-Pack (.pack文件) 添加更多芯片支持。在侧边栏"CMSIS-Pack 管理"中点击"导入 Pack"按钮即可。

## 🛠️ 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS + Zustand
- **UI组件**: Radix UI + Lucide Icons
- **后端**: Rust + Tauri 2.0
- **调试库**: probe-rs 0.27
- **Pack解析**: quick-xml + zip

## 📁 项目结构

```
ZUOLANDAPLINK/
├── src/                          # React 前端源码
│   ├── components/               # UI组件
│   │   ├── layout/              # 布局组件 (Header, Sidebar, MainArea)
│   │   ├── rtt/                 # RTT 终端组件
│   │   ├── log/                 # 日志面板
│   │   └── ui/                  # 基础UI组件 (shadcn/ui)
│   ├── stores/                  # Zustand 状态管理
│   │   ├── probeStore.ts        # 探针状态
│   │   ├── chipStore.ts         # 芯片状态
│   │   ├── flashStore.ts        # 烧录状态
│   │   ├── rttStore.ts          # RTT状态
│   │   └── logStore.ts          # 日志状态
│   ├── hooks/                   # React Hooks
│   │   ├── useRttEvents.ts      # RTT事件监听
│   │   └── useUserActivity.ts   # 用户活动检测
│   ├── lib/                     # 工具库和类型定义
│   │   ├── tauri.ts             # Tauri API封装
│   │   ├── types.ts             # TypeScript类型定义
│   │   └── utils.ts             # 工具函数
│   ├── App.tsx                  # 主应用组件
│   └── main.tsx                 # 入口文件
├── src-tauri/                   # Rust 后端源码
│   ├── src/
│   │   ├── commands/            # Tauri 命令
│   │   │   ├── probe.rs         # 探针管理（检测、连接、断开）
│   │   │   ├── flash.rs         # 烧录操作（烧录、擦除、校验）
│   │   │   ├── memory.rs        # 内存操作（读写、寄存器）
│   │   │   ├── rtt.rs           # RTT调试（启动、停止、数据传输）
│   │   │   └── config.rs        # 芯片配置（搜索、信息查询）
│   │   ├── pack/                # CMSIS-Pack 处理
│   │   │   ├── manager.rs       # Pack管理器
│   │   │   └── parser.rs        # PDSC解析器
│   │   ├── error.rs             # 错误定义
│   │   ├── state.rs             # 应用状态
│   │   └── lib.rs               # 库入口
│   ├── icons/                   # 应用图标
│   ├── Cargo.toml               # Rust依赖
│   └── tauri.conf.json          # Tauri配置
├── RTTBSP/                      # SEGGER RTT 库文件（可直接复制到工程）
│   ├── SEGGER_RTT.c
│   ├── SEGGER_RTT.h
│   ├── SEGGER_RTT_Conf.h
│   └── SEGGER_RTT_printf.c
├── docs/                        # 文档
│   └── RTT_USER_MANUAL.md       # RTT 用户手册
├── packs/                       # 用户导入的Pack存放目录
├── package.json                 # Node.js依赖
└── README.md                    # 本文件
```

## 🚀 开发环境搭建

### 前置要求

- **Node.js** 18+
- **Rust** 1.70+
- **pnpm** (推荐) 或 npm

### 安装依赖

```bash
# 安装前端依赖
pnpm install

# Rust依赖会在首次构建时自动安装
```

### 开发模式运行

```bash
pnpm tauri dev
```

### 构建发布版本

```bash
pnpm tauri build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录：
- `msi/` - Windows MSI安装包
- `nsis/` - Windows NSIS安装包

## 📖 使用说明

### 1. 连接探针

1. 将DAPLINK/CMSIS-DAP探针连接到电脑USB
2. 点击"刷新"按钮检测探针
3. 从下拉列表选择探针（会显示DAP版本：DAPv1 HID 或 DAPv2 WinUSB）

### 2. 选择目标芯片

1. 在芯片搜索框输入芯片型号（如 `STM32F103C8` 或 `GD32F103C8` 或 `CW32F030C8`）
2. 从搜索结果中选择正确的芯片
3. 系统会自动加载芯片配置信息

### 3. 配置接口

- **接口类型**: SWD（推荐）或 JTAG
- **时钟速度**: 默认1MHz，可选100kHz - 10MHz
- **连接模式**: 正常模式或复位下连接
- **复位方式**: 软件复位或硬件复位

### 4. 配置自动断开（可选）

在侧边栏"自动断开"卡片中：
- **启用/禁用**: 点击按钮切换
- **超时时间**: 可选5/10/30/60/120/300秒
- **说明**: 无操作超时后自动断开连接，RTT运行时不会断开

### 5. 烧录固件

1. 点击工具栏"打开"按钮选择固件文件（支持.bin/.hex/.elf）
2. 点击"连接"按钮连接目标
3. 点击"烧录"按钮开始烧录
4. 等待烧录完成，查看日志确认结果

### 6. 其他操作

- **擦除**: 全片擦除Flash
- **校验**: 校验Flash内容与文件一致
- **读取**: 读取Flash内容到文件
- **复位**: 复位目标芯片

## 🔍 RTT 使用说明

### 功能特性

- **实时日志输出** - 通过 SWD/JTAG 接口直接读取目标内存，无需额外串口
- **双模式显示** - 支持文本和Hex两种显示模式
  - **文本模式**: 显示可读文本，支持ANSI颜色
  - **Hex模式**: 显示十六进制字节（如 `48 65 6C 6C 6F` 对应 "Hello"）
- **ANSI 颜色支持** - 支持终端颜色代码，可显示彩色日志
- **多通道支持** - 支持多个 RTT 上行/下行通道
- **高速传输** - 比传统 UART 打印快数倍
- **自动滚动** - 自动滚动到最新日志
- **搜索过滤** - 支持关键字搜索和通道过滤
- **数据导出** - 支持导出为 TXT 格式

### 使用步骤

1. **连接目标** - 先连接探针和目标芯片
2. **启动RTT** - 点击RTT面板的"启动"按钮
3. **查看日志** - 实时查看目标输出的日志
4. **切换显示** - 点击"文本/Hex"按钮切换显示模式
5. **搜索过滤** - 使用搜索框过滤日志内容
6. **导出数据** - 点击"导出"按钮保存日志

### 目标固件要求

RTT 功能需要目标固件集成 SEGGER RTT 库。本项目已在 `RTTBSP/` 目录提供所需文件，可直接复制到工程中使用。

详细使用方法请参考 **[RTT 用户手册](docs/RTT_USER_MANUAL.md)**。

### CMSIS-DAP 注意事项

使用 CMSIS-DAP/DAPLINK 探针时，RTT 读取需要暂停目标芯片才能安全访问内存。这与 J-Link 不同（J-Link 有硬件加速可以不暂停直接读取）。

**影响：**
- RTT 读取时目标芯片会被短暂暂停（约 1-2ms），然后恢复运行
- 对于大多数应用没有明显影响
- 对于时序敏感的应用（如高速通信、精确定时），可能会有轻微影响

**重要配置：**
- **必须配置为非阻塞模式**，否则缓冲区满时目标会卡死
- 轮询间隔默认 10ms，可根据需要调整
- 如果目标程序对实时性要求极高，建议使用 J-Link 探针

## 📦 导入Keil Pack

1. 从Keil官网下载所需芯片的Pack文件 (.pack)
2. 在侧边栏找到"CMSIS-Pack 管理"卡片
3. 点击"导入 Pack"按钮
4. 选择下载的.pack文件
5. 导入成功后，芯片列表将包含Pack中的设备

### 自定义ROM地址（Keil风格）

在"烧录设置"卡片中可以配置自定义ROM地址：

1. 勾选"自定义ROM地址"复选框
2. 配置IROM1起始地址（如 `0x08000000`）
3. 配置IROM1大小（如 `0x100000` = 1MB）
4. 或点击"使用芯片默认值"按钮自动填充

**参考配置（Keil风格）：**
- IROM1: 0x08000000, 0x100000 (1MB)
- IRAM1: 0x20000000, 0x1C000 (112KB)

注：烧录时仅需配置ROM区域。

## ⚠️ 已知限制

- ESP32系列需要特殊的烧录流程
- 部分国产芯片可能需要导入对应的Pack
- 目标IDCODE读取受probe-rs API限制（需通过Keil等工具查看）

## 🆕 更新日志

查看完整的更新日志请访问 [CHANGELOG.md](CHANGELOG.md)

### 最新版本 v0.3.2 (2026-01-23)

- 🎨 实现真实的Flash烧录进度跟踪，显示准确的进度百分比和字节数
- 🎨 优化进度计算逻辑，擦除阶段0-30%，编程阶段30-95%
- 🐛 修复未使用的导入警告

### v0.3.1 (2026-01-23)

- 🐛 修复Flash进度条显示错误（之前显示5500%）
- 🐛 修复日志面板拖动方向
- ✨ 高级擦除对话框（全片擦除/自定义范围擦除）
- ✨ 新增GD32F470系列支持（6个型号）
- 🎨 优化工具栏布局，添加"烧录模式"标签

[查看完整更新日志 →](CHANGELOG.md)

## 📄 开源协议

MIT License

## 🙏 致谢

- [probe-rs](https://probe.rs/) - Rust嵌入式调试库
- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [React](https://react.dev/) - 用户界面库
- [Radix UI](https://www.radix-ui.com/) - 无样式UI组件
- [Tailwind CSS](https://tailwindcss.com/) - CSS框架

## 📮 反馈与贡献

欢迎提交Issue和Pull Request！

---

**Made with ❤️ by ZUOLAN**
