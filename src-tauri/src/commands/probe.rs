use crate::error::{AppError, AppResult};
use crate::state::{AppState, ConnectionInfo, ConnectMode, InterfaceType};
use probe_rs::{
    probe::{list::Lister, WireProtocol},
    MemoryInterface, Permissions, Session,
};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProbeInfo {
    pub identifier: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub serial_number: Option<String>,
    pub probe_type: String,
    pub dap_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetInfo {
    pub name: String,
    pub core_type: String,
    pub memory_regions: Vec<MemoryRegion>,
    pub flash_algorithms: Vec<String>,
    pub chip_id: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryRegion {
    pub name: String,
    pub kind: String,
    pub address: u64,
    pub size: u64,
}

/// Try to read the chip IDCODE
/// Different chip families have different IDCODE register addresses
fn read_chip_id(session: &mut Session) -> Option<u32> {
    let mut core = session.core(0).ok()?;

    // Common chip IDCODE address list
    let id_addresses: &[(u64, &str)] = &[
        (0xE0042000, "STM32 DBGMCU_IDCODE"),     // Most STM32 chips
        (0x40015800, "STM32G0/G4 DBG_IDCODE"),   // STM32G0/G4 series
        (0x1FFFF7E8, "STM32 UID"),               // Backup: Unique ID
        (0x10000060, "nRF FICR.INFO.PART"),      // Nordic nRF
        (0x40000FF8, "RP2040 CHIPID"),           // Raspberry Pi RP2040
    ];

    for (addr, _name) in id_addresses {
        if let Ok(id) = core.read_word_32(*addr) {
            // Exclude invalid values
            if id != 0 && id != 0xFFFFFFFF {
                return Some(id);
            }
        }
    }

    None
}

#[tauri::command]
pub async fn list_probes() -> AppResult<Vec<ProbeInfo>> {
    let lister = Lister::new();
    let probes = lister.list_all();

    let probe_infos: Vec<ProbeInfo> = probes
        .into_iter()
        .map(|p| {
            let probe_type_str = format!("{:?}", p.probe_type());

            // 判断DAP版本：CmsisDap表示DAPv1(HID)，CmsisDapV2表示DAPv2(WinUSB)
            let dap_version = if probe_type_str.contains("CmsisDap") {
                if probe_type_str.contains("V2") {
                    Some("DAPv2 (WinUSB)".to_string())
                } else {
                    Some("DAPv1 (HID)".to_string())
                }
            } else {
                None
            };

            ProbeInfo {
                identifier: p.identifier.clone(),
                vendor_id: p.vendor_id,
                product_id: p.product_id,
                serial_number: p.serial_number.clone(),
                probe_type: probe_type_str,
                dap_version,
            }
        })
        .collect();

    Ok(probe_infos)
}

#[derive(Debug, Deserialize)]
pub struct ConnectOptions {
    pub probe_identifier: String,
    pub target: String,
    pub interface_type: InterfaceType,
    pub clock_speed: Option<u32>,
    pub connect_mode: ConnectMode,
}

#[tauri::command]
pub async fn connect_target(
    options: ConnectOptions,
    state: State<'_, AppState>,
) -> AppResult<TargetInfo> {
    // 关闭现有连接
    {
        let mut session_guard = state.session.lock();
        *session_guard = None;
    }

    let lister = Lister::new();
    let probes = lister.list_all();

    let probe_info = probes
        .iter()
        .find(|p| p.identifier == options.probe_identifier)
        .ok_or_else(|| AppError::ProbeError("未找到指定的探针".to_string()))?;

    let mut probe = probe_info
        .open()
        .map_err(|e| AppError::ProbeError(e.to_string()))?;

    // 设置协议
    let protocol = match options.interface_type {
        InterfaceType::Swd => WireProtocol::Swd,
        InterfaceType::Jtag => WireProtocol::Jtag,
    };
    probe
        .select_protocol(protocol)
        .map_err(|e| AppError::ProbeError(e.to_string()))?;

    // 设置时钟速度
    if let Some(speed) = options.clock_speed {
        probe
            .set_speed(speed)
            .map_err(|e| AppError::ProbeError(e.to_string()))?;
    }

    // 尝试在连接前读取目标IDCODE
    // 注意：probe-rs 0.27版本的API不直接暴露DP IDCODE读取
    // IDCODE在连接时由probe-rs内部读取，但无法通过公开API获取
    // 这是probe-rs的已知限制，未来版本可能会改进
    let target_idcode: Option<u32> = None;

    // 连接目标
    let mut session = if options.connect_mode == ConnectMode::UnderReset {
        probe
            .attach_under_reset(&options.target, Permissions::default())
            .map_err(|e| AppError::ProbeError(e.to_string()))?
    } else {
        probe
            .attach(&options.target, Permissions::default())
            .map_err(|e| AppError::ProbeError(e.to_string()))?
    };

    // 读取芯片ID（DBGMCU_IDCODE）
    let chip_id = read_chip_id(&mut session);

    // 获取目标信息
    let target = session.target();
    let target_info = TargetInfo {
        name: target.name.clone(),
        core_type: format!("{:?}", target.cores.first().map(|c| c.core_type)),
        memory_regions: target
            .memory_map
            .iter()
            .map(|region| {
                let (name, kind, address, size) = match region {
                    probe_rs::config::MemoryRegion::Ram(r) => {
                        (r.name.clone().unwrap_or_default(), "RAM", r.range.start, r.range.end - r.range.start)
                    }
                    probe_rs::config::MemoryRegion::Nvm(r) => {
                        (r.name.clone().unwrap_or_default(), "Flash", r.range.start, r.range.end - r.range.start)
                    }
                    probe_rs::config::MemoryRegion::Generic(r) => {
                        (r.name.clone().unwrap_or_default(), "Generic", r.range.start, r.range.end - r.range.start)
                    }
                };
                MemoryRegion {
                    name,
                    kind: kind.to_string(),
                    address,
                    size,
                }
            })
            .collect(),
        flash_algorithms: target
            .flash_algorithms
            .iter()
            .map(|a| a.name.clone())
            .collect(),
        chip_id,
    };

    // 存储连接信息
    {
        let mut conn_info = state.connection_info.lock();
        *conn_info = Some(ConnectionInfo {
            probe_name: options.probe_identifier.clone(),
            probe_serial: probe_info.serial_number.clone(),  // 保存探针序列号
            target_name: options.target.clone(),
            core_type: target_info.core_type.clone(),
            chip_id,
            target_idcode,  // 保存目标IDCODE
        });
    }

    // 存储session
    {
        let mut session_guard = state.session.lock();
        *session_guard = Some(session);
    }

    Ok(target_info)
}

#[tauri::command]
pub async fn disconnect(state: State<'_, AppState>) -> AppResult<()> {
    // 简单地释放session，让probe-rs自动处理清理
    {
        let mut session_guard = state.session.lock();
        if let Some(session) = session_guard.as_mut() {
            // 尝试让芯片恢复运行（不做复位操作，避免触发probe-rs的bug）
            if let Ok(mut core) = session.core(0) {
                let _ = core.run();
            }
        }
        // 释放session，这会自动关闭探针
        *session_guard = None;
    }

    // 清除连接信息
    let mut conn_info = state.connection_info.lock();
    *conn_info = None;

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStatus {
    pub connected: bool,
    pub info: Option<ConnectionInfo>,
}

#[tauri::command]
pub async fn get_connection_status(state: State<'_, AppState>) -> AppResult<ConnectionStatus> {
    let session_guard = state.session.lock();
    let connected = session_guard.is_some();

    let conn_info = state.connection_info.lock();

    Ok(ConnectionStatus {
        connected,
        info: conn_info.clone(),
    })
}
