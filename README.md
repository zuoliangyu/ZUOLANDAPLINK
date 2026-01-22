# ZUOLAN DAPLINK 烧录工具

一个开源的第三方DAPLINK烧录软件，基于Tauri + React + Rust技术栈开发，使用probe-rs作为底层调试库。

## 功能特性

- **探针检测** - 自动检测连接的DAPLINK/CMSIS-DAP设备
- **多接口支持** - 支持SWD和JTAG调试接口
- **固件烧录** - 支持ELF/HEX/BIN格式固件烧录
- **Flash操作** - 支持全片擦除、扇区擦除、读取、校验
- **内存访问** - 支持内存读写和寄存器查看
- **RTT调试** - 支持Segger RTT实时日志输出
- **芯片数据库** - 内置100+常用芯片，支持Keil CMSIS-Pack扩展

## 支持的芯片

### 内置支持

| 厂商 | 系列 |
|------|------|
| ST | STM32F0/F1/F2/F3/F4, STM32G0/G4, STM32L0/L4 |
| GigaDevice | GD32F1/F3 |
| Nordic | nRF51822, nRF52832/52833/52840 |
| Raspberry Pi | RP2040 |
| Espressif | ESP32-C3/C6/S3 |

### 扩展支持

可通过导入Keil CMSIS-Pack (.pack文件) 添加更多芯片支持。

## 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS
- **后端**: Rust + Tauri 2.0
- **调试库**: probe-rs 0.27
- **Pack解析**: quick-xml + zip

## 项目结构

```
ZUOLANDAPLINK/
├── src/                          # React 前端源码
│   ├── components/               # UI组件
│   │   ├── layout/              # 布局组件 (Header, Sidebar, MainArea)
│   │   ├── rtt/                 # RTT 终端组件
│   │   ├── log/                 # 日志面板
│   │   └── ui/                  # 基础UI组件
│   ├── stores/                  # Zustand 状态管理
│   ├── hooks/                   # React Hooks
│   ├── lib/                     # 工具库和类型定义
│   ├── App.tsx                  # 主应用组件
│   └── main.tsx                 # 入口文件
├── src-tauri/                   # Rust 后端源码
│   ├── src/
│   │   ├── commands/            # Tauri 命令
│   │   │   ├── probe.rs         # 探针管理
│   │   │   ├── flash.rs         # 烧录操作
│   │   │   ├── memory.rs        # 内存操作
│   │   │   ├── rtt.rs           # RTT调试
│   │   │   └── config.rs        # 芯片配置
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

## 开发环境搭建

### 前置要求

- Node.js 18+
- Rust 1.70+
- pnpm (推荐) 或 npm

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

## 使用说明

### 1. 连接探针

1. 将DAPLINK/CMSIS-DAP探针连接到电脑USB
2. 点击"刷新"按钮检测探针
3. 从下拉列表选择探针

### 2. 选择目标芯片

1. 在芯片搜索框输入芯片型号（如 STM32F103C8）
2. 从搜索结果中选择正确的芯片
3. 点击"获取信息"查看芯片Flash映射

### 3. 配置接口

- **接口类型**: SWD（推荐）或 JTAG
- **时钟速度**: 默认4MHz，可根据需要调整
- **连接模式**: 正常模式或复位下连接

### 4. 烧录固件

1. 点击工具栏"打开"按钮选择固件文件
2. 点击"连接"按钮连接目标
3. 点击"烧录"按钮开始烧录
4. 等待烧录完成，查看日志确认结果

### 5. 其他操作

- **擦除**: 全片擦除Flash
- **校验**: 校验Flash内容与文件一致
- **读取**: 读取Flash内容
- **复位**: 复位目标芯片

## 导入Keil Pack

1. 从Keil官网下载所需芯片的Pack文件 (.pack)
2. 点击"导入Pack"按钮
3. 选择下载的.pack文件
4. 导入成功后，芯片列表将包含Pack中的设备

## 已知限制

- 当前版本不支持进度回调显示（probe-rs API限制）
- ESP32系列需要特殊的烧录流程
- 部分国产芯片可能需要导入对应的Pack

## RTT 使用说明

### 功能特性

- **实时日志输出** - 通过 SWD/JTAG 接口直接读取目标内存，无需额外串口
- **ANSI 颜色支持** - 支持终端颜色代码，可显示彩色日志
- **多通道支持** - 支持多个 RTT 上行/下行通道
- **高速传输** - 比传统 UART 打印快数倍
- **自动滚动** - 自动滚动到最新日志
- **搜索过滤** - 支持关键字搜索和通道过滤
- **数据导出** - 支持导出为 TXT/CSV 格式

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

## 开源协议

MIT License

## 致谢

- [probe-rs](https://probe.rs/) - Rust嵌入式调试库
- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [DAPLinkUtility](https://github.com/) - 功能参考
