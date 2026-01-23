use parking_lot::Mutex;
use probe_rs::Session;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// RTT 运行时状态
pub struct RttState {
    /// 是否正在运行
    pub running: AtomicBool,
    /// 轮询间隔 (毫秒)
    pub poll_interval_ms: Mutex<u64>,
    /// RTT 控制块地址
    pub control_block_address: Mutex<Option<u64>>,
    /// 各通道缓冲区 (用于累积未完整的行)
    pub line_buffers: Mutex<HashMap<usize, Vec<u8>>>,
    /// 各通道的读取偏移量 (用于直接内存读取)
    pub channel_read_offsets: Mutex<HashMap<usize, u32>>,
    /// 各通道的缓冲区信息 (地址, 大小)
    pub channel_buffers: Mutex<HashMap<usize, (u64, u32)>>,
}

impl Default for RttState {
    fn default() -> Self {
        Self {
            running: AtomicBool::new(false),
            poll_interval_ms: Mutex::new(10),
            control_block_address: Mutex::new(None),
            line_buffers: Mutex::new(HashMap::new()),
            channel_read_offsets: Mutex::new(HashMap::new()),
            channel_buffers: Mutex::new(HashMap::new()),
        }
    }
}

impl RttState {
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    pub fn set_running(&self, running: bool) {
        self.running.store(running, Ordering::SeqCst);
    }

    pub fn reset(&self) {
        self.running.store(false, Ordering::SeqCst);
        *self.control_block_address.lock() = None;
        self.line_buffers.lock().clear();
        self.channel_read_offsets.lock().clear();
        self.channel_buffers.lock().clear();
    }
}

pub struct AppState {
    pub session: Arc<Mutex<Option<Session>>>,           // 主连接（用于烧录）
    pub rtt_session: Arc<Mutex<Option<Session>>>,       // RTT 独立连接
    pub connection_info: Arc<Mutex<Option<ConnectionInfo>>>,
    pub rtt_connection_info: Arc<Mutex<Option<ConnectionInfo>>>, // RTT 连接信息
    pub settings: Arc<Mutex<DeviceSettings>>,
    pub rtt_state: Arc<RttState>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            session: Arc::new(Mutex::new(None)),
            rtt_session: Arc::new(Mutex::new(None)),
            connection_info: Arc::new(Mutex::new(None)),
            rtt_connection_info: Arc::new(Mutex::new(None)),
            settings: Arc::new(Mutex::new(DeviceSettings::default())),
            rtt_state: Arc::new(RttState::default()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub probe_name: String,
    pub probe_serial: Option<String>,  // 新增：DAP探针序列号
    pub target_name: String,
    pub core_type: String,
    pub chip_id: Option<u32>,          // 芯片DBGMCU_IDCODE
    pub target_idcode: Option<u32>,    // 新增：目标芯片的真实IDCODE（通过SWD读取）
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceSettings {
    pub interface_type: InterfaceType,
    pub clock_speed: u32,
    pub connect_mode: ConnectMode,
    pub reset_mode: ResetMode,
    pub voltage: f32,
}

impl Default for DeviceSettings {
    fn default() -> Self {
        Self {
            interface_type: InterfaceType::Swd,
            clock_speed: 1000000, // 1MHz
            connect_mode: ConnectMode::Normal,
            reset_mode: ResetMode::Software,
            voltage: 3.3,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum InterfaceType {
    Swd,
    Jtag,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConnectMode {
    Normal,
    UnderReset,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ResetMode {
    Software,
    Hardware,
}
