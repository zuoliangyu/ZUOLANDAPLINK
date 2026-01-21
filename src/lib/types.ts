// 探针信息
export interface ProbeInfo {
  identifier: string;
  vendor_id: number;
  product_id: number;
  serial_number: string | null;
  probe_type: string;
}

// 连接选项
export interface ConnectOptions {
  probe_identifier: string;
  target: string;
  interface_type: "Swd" | "Jtag";
  clock_speed: number | null;
  connect_mode: "Normal" | "UnderReset";
}

// 目标信息
export interface TargetInfo {
  name: string;
  core_type: string;
  memory_regions: MemoryRegion[];
  flash_algorithms: string[];
}

// 内存区域
export interface MemoryRegion {
  name: string;
  kind: string;
  address: number;
  size: number;
}

// 连接状态
export interface ConnectionStatus {
  connected: boolean;
  info: ConnectionInfo | null;
}

export interface ConnectionInfo {
  probe_name: string;
  target_name: string;
  core_type: string;
  chip_id: number | null;
}

// 芯片信息
export interface ChipInfo {
  name: string;
  vendor: string;
  family: string;
  cores: CoreInfo[];
  memory_regions: MemoryRegionInfo[];
  flash_algorithms: FlashAlgorithmInfo[];
}

export interface CoreInfo {
  name: string;
  core_type: string;
}

export interface MemoryRegionInfo {
  name: string;
  kind: string;
  address: number;
  size: number;
  page_size: number | null;
  sector_size: number | null;
}

export interface FlashAlgorithmInfo {
  name: string;
  default: boolean;
  load_address: number;
  data_section_offset: number;
}

// Flash烧录选项
export interface FlashOptions {
  file_path: string;
  verify: boolean;
  skip_erase: boolean;
  reset_after: boolean;
}

// Flash进度事件
export interface FlashProgressEvent {
  phase: string;
  progress: number;
  message: string;
}

// Pack信息
export interface PackInfo {
  name: string;
  vendor: string;
  version: string;
  description: string;
  device_count: number;
}

// 项目配置
export interface ProjectConfig {
  name: string;
  chip: string;
  interface_type: string;
  clock_speed: number;
  firmware_path: string | null;
  verify_after_flash: boolean;
  reset_after_flash: boolean;
}

// RTT通道
export interface RttChannel {
  index: number;
  name: string;
  buffer_size: number;
}

// RTT配置
export interface RttConfig {
  channels: RttChannel[];
}

// 寄存器值
export interface RegisterValue {
  name: string;
  value: number;
}

// 设备设置
export interface DeviceSettings {
  interfaceType: "SWD" | "JTAG";
  clockSpeed: number;
  connectMode: "Normal" | "UnderReset";
  resetMode: "Software" | "Hardware";
  voltage: number;
}

// 日志条目
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "warn" | "error" | "success";
  message: string;
}
