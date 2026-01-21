use crate::error::{AppError, AppResult};
use crate::state::{AppState, ConnectionInfo, ConnectMode, InterfaceType};
use probe_rs::{
    probe::{list::Lister, WireProtocol},
    Permissions,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetInfo {
    pub name: String,
    pub core_type: String,
    pub memory_regions: Vec<MemoryRegion>,
    pub flash_algorithms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryRegion {
    pub name: String,
    pub kind: String,
    pub address: u64,
    pub size: u64,
}

#[tauri::command]
pub async fn list_probes() -> AppResult<Vec<ProbeInfo>> {
    let lister = Lister::new();
    let probes = lister.list_all();

    let probe_infos: Vec<ProbeInfo> = probes
        .into_iter()
        .map(|p| ProbeInfo {
            identifier: p.identifier.clone(),
            vendor_id: p.vendor_id,
            product_id: p.product_id,
            serial_number: p.serial_number.clone(),
            probe_type: format!("{:?}", p.probe_type()),
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

    // 连接目标
    let session = if options.connect_mode == ConnectMode::UnderReset {
        probe
            .attach_under_reset(&options.target, Permissions::default())
            .map_err(|e| AppError::ProbeError(e.to_string()))?
    } else {
        probe
            .attach(&options.target, Permissions::default())
            .map_err(|e| AppError::ProbeError(e.to_string()))?
    };

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
    };

    // 存储连接信息
    {
        let mut conn_info = state.connection_info.lock();
        *conn_info = Some(ConnectionInfo {
            probe_name: options.probe_identifier.clone(),
            target_name: options.target.clone(),
            core_type: target_info.core_type.clone(),
            chip_id: None, // TODO: 读取芯片ID
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
    let mut session_guard = state.session.lock();
    *session_guard = None;

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
