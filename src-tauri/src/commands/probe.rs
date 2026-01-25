use crate::error::{AppError, AppResult};
use crate::state::{AppState, ConnectionInfo, ConnectMode, InterfaceType};
use probe_rs::{
    architecture::arm::dp::{DpAddress, DpRegisterAddress},
    probe::{list::Lister, WireProtocol},
    MemoryInterface, Permissions, Session,
};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProbeInfo {
    pub probe_id: String,
    pub identifier: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub serial_number: Option<String>,
    pub probe_type: String,
    pub dap_version: Option<String>,
    pub debug_info: Option<String>,  // 诊断信息
}

/// USB 设备诊断信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbDeviceInfo {
    pub vendor_id: u16,
    pub product_id: u16,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub serial_number: Option<String>,
    pub bus_number: u8,
    pub device_address: u8,
    pub interfaces: Vec<UsbInterfaceInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbInterfaceInfo {
    pub interface_number: u8,
    pub class: u8,
    pub subclass: u8,
    pub protocol: u8,
    pub interface_string: Option<String>,
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

#[derive(Debug, Clone)]
struct CmsisDapCaps {
    vendor_id: u16,
    product_id: u16,
    serial_number: Option<String>,
    has_hid: bool,
    has_v2: bool,
    debug_info: String,  // 诊断信息
}

fn is_cmsis_dap_str(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("cmsis-dap") || lower.contains("cmsis_dap")
}

fn collect_cmsis_dap_caps() -> Vec<CmsisDapCaps> {
    let mut caps = Vec::new();

    let devices = match nusb::list_devices() {
        Ok(devices) => devices,
        Err(e) => {
            log::warn!("nusb list_devices failed: {}", e);
            return caps;
        }
    };

    for device in devices {
        let vid = device.vendor_id();
        let pid = device.product_id();
        let product_str = device.product_string().unwrap_or("");
        let product_is_cmsis = is_cmsis_dap_str(product_str);

        // 只处理可能是 CMSIS-DAP 的设备
        let dominated_vid = vid == 0xFAED || vid == 0x0D28 || vid == 0xC251 || vid == 0x1366 || vid == 0x0483;
        if !dominated_vid && !product_is_cmsis {
            continue;
        }

        let mut debug_lines = Vec::new();
        debug_lines.push(format!("VID={:#06x} PID={:#06x}", vid, pid));
        debug_lines.push(format!("Product: {:?}", product_str));

        let mut has_hid = false;
        let mut has_v2 = false;

        for iface in device.interfaces() {
            let iface_num = iface.interface_number();
            let iface_class = iface.class();
            let iface_subclass = iface.subclass();
            let iface_protocol = iface.protocol();
            let iface_str = iface.interface_string().unwrap_or("");
            let iface_is_cmsis = is_cmsis_dap_str(iface_str);

            debug_lines.push(format!(
                "Interface {}: class={:#04x} sub={:#04x} proto={:#04x} str={:?}",
                iface_num, iface_class, iface_subclass, iface_protocol, iface_str
            ));

            // HID class = 0x03, Vendor Specific class = 0xFF
            if iface_class == 0x03 && (iface_is_cmsis || product_is_cmsis) {
                debug_lines.push(format!("  -> HID interface (DAPv1)"));
                has_hid = true;
            } else if iface_class == 0xFF && (iface_is_cmsis || product_is_cmsis) {
                debug_lines.push(format!("  -> Vendor Specific (potential DAPv2)"));
                has_v2 = true;
            }
        }

        debug_lines.push(format!("Summary: has_hid={}, has_v2={}", has_hid, has_v2));

        if product_is_cmsis || has_hid || has_v2 {
            caps.push(CmsisDapCaps {
                vendor_id: vid,
                product_id: pid,
                serial_number: device.serial_number().map(|s| s.to_string()).filter(|s| !s.is_empty()),
                has_hid,
                has_v2,
                debug_info: debug_lines.join("\n"),
            });
        }
    }

    caps
}

fn match_caps_for_probe<'a>(
    probe: &probe_rs::probe::DebugProbeInfo,
    caps: &'a [CmsisDapCaps],
) -> Option<&'a CmsisDapCaps> {
    let probe_serial = probe.serial_number.as_deref().filter(|s| !s.is_empty());

    let direct_match = caps.iter().find(|c| {
        if c.vendor_id != probe.vendor_id || c.product_id != probe.product_id {
            return false;
        }
        let cap_serial = c.serial_number.as_deref().filter(|s| !s.is_empty());
        match (probe_serial, cap_serial) {
            (Some(p), Some(c)) => p == c,
            (None, None) => true,
            _ => false,
        }
    });

    if direct_match.is_some() {
        return direct_match;
    }

    if probe_serial.is_none() {
        return caps
            .iter()
            .find(|c| c.vendor_id == probe.vendor_id && c.product_id == probe.product_id);
    }

    None
}

fn build_probe_id(vendor_id: u16, product_id: u16, serial_number: &Option<String>) -> String {
    let serial = serial_number.as_deref().unwrap_or("");
    format!("{:04x}:{:04x}:{}", vendor_id, product_id, serial)
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

/// Try to read the DP IDCODE (DPIDR) from the debug port
/// This identifies the debug access port implementation
fn read_dp_idcode(session: &mut Session) -> Option<u32> {
    // Get ARM interface and read DPIDR
    if let Ok(interface) = session.get_arm_interface() {
        // DPIDR register: address 0x0, no bank selection
        let dp_addr = DpAddress::Default;
        let reg_addr = DpRegisterAddress { address: 0x0, bank: None };
        if let Ok(dpidr) = interface.read_raw_dp_register(dp_addr, reg_addr) {
            if dpidr != 0 && dpidr != 0xFFFFFFFF {
                return Some(dpidr);
            }
        }
    }
    None
}

#[tauri::command]
pub async fn list_probes() -> AppResult<Vec<ProbeInfo>> {
    // 使用 nusb 收集 CMSIS-DAP 能力信息
    let caps = collect_cmsis_dap_caps();
    log::info!("=== CMSIS-DAP Capabilities from nusb ===");
    for cap in &caps {
        log::info!(
            "Device VID={:#06x}, PID={:#06x}, serial={:?}, has_hid={}, has_v2={}",
            cap.vendor_id, cap.product_id, cap.serial_number, cap.has_hid, cap.has_v2
        );
    }

    // probe-rs 枚举
    let lister = Lister::new();
    let probes = lister.list_all();

    log::info!("=== Probe enumeration (probe-rs) ===");
    log::info!("Total probes found: {}", probes.len());

    let mut probe_infos: Vec<ProbeInfo> = Vec::new();

    for p in probes {
        let probe_type_str = format!("{:?}", p.probe_type());

        log::info!(
            "Probe: identifier={}, VID={:#06x}, PID={:#06x}, serial={:?}, type={}",
            p.identifier,
            p.vendor_id,
            p.product_id,
            p.serial_number,
            probe_type_str
        );

        // 使用 nusb 能力信息来判断 DAP 版本
        let matched_caps = match_caps_for_probe(&p, &caps);

        if let Some(cap) = matched_caps {
            log::info!("  -> Matched caps: has_hid={}, has_v2={}", cap.has_hid, cap.has_v2);

            // 如果设备同时支持 HID 和 WinUSB，合并为一个条目（probe-rs 自动选择最优协议）
            if cap.has_hid && cap.has_v2 {
                probe_infos.push(ProbeInfo {
                    probe_id: build_probe_id(p.vendor_id, p.product_id, &p.serial_number),
                    identifier: p.identifier.clone(),
                    vendor_id: p.vendor_id,
                    product_id: p.product_id,
                    serial_number: p.serial_number.clone(),
                    probe_type: "CmsisDap".to_string(),
                    dap_version: Some("DAPv1+v2 (HID/WinUSB)".to_string()),
                    debug_info: Some(cap.debug_info.clone()),
                });
            } else if cap.has_v2 {
                probe_infos.push(ProbeInfo {
                    probe_id: build_probe_id(p.vendor_id, p.product_id, &p.serial_number),
                    identifier: p.identifier.clone(),
                    vendor_id: p.vendor_id,
                    product_id: p.product_id,
                    serial_number: p.serial_number.clone(),
                    probe_type: "CmsisDapV2".to_string(),
                    dap_version: Some("DAPv2 (WinUSB)".to_string()),
                    debug_info: Some(cap.debug_info.clone()),
                });
            } else if cap.has_hid {
                probe_infos.push(ProbeInfo {
                    probe_id: build_probe_id(p.vendor_id, p.product_id, &p.serial_number),
                    identifier: p.identifier.clone(),
                    vendor_id: p.vendor_id,
                    product_id: p.product_id,
                    serial_number: p.serial_number.clone(),
                    probe_type: "CmsisDap".to_string(),
                    dap_version: Some("DAPv1 (HID)".to_string()),
                    debug_info: Some(cap.debug_info.clone()),
                });
            } else {
                // 未知类型，直接添加
                probe_infos.push(ProbeInfo {
                    probe_id: build_probe_id(p.vendor_id, p.product_id, &p.serial_number),
                    identifier: p.identifier.clone(),
                    vendor_id: p.vendor_id,
                    product_id: p.product_id,
                    serial_number: p.serial_number.clone(),
                    probe_type: probe_type_str,
                    dap_version: None,
                    debug_info: Some(cap.debug_info.clone()),
                });
            }
        } else {
            // 未匹配到 nusb 能力信息，使用 probe_type 判断
            let probe_type_upper = probe_type_str.to_uppercase();
            let dap_version = if probe_type_upper.contains("CMSIS") || probe_type_upper.contains("DAP") {
                if probe_type_upper.contains("V2") {
                    Some("DAPv2 (WinUSB)".to_string())
                } else {
                    Some("DAPv1 (HID)".to_string())
                }
            } else {
                None
            };

            probe_infos.push(ProbeInfo {
                probe_id: build_probe_id(p.vendor_id, p.product_id, &p.serial_number),
                identifier: p.identifier.clone(),
                vendor_id: p.vendor_id,
                product_id: p.product_id,
                serial_number: p.serial_number.clone(),
                probe_type: probe_type_str,
                dap_version,
                debug_info: None,
            });
        }
    }

    log::info!("=== Probe enumeration end, total {} entries ===", probe_infos.len());

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

    // 设置时钟速度（前端传递的是Hz，probe-rs需要kHz）
    if let Some(speed_hz) = options.clock_speed {
        let speed_khz = speed_hz / 1000;
        probe
            .set_speed(speed_khz)
            .map_err(|e| AppError::ProbeError(format!("设置时钟速度失败 ({} kHz): {}", speed_khz, e)))?;
    }

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

    // 读取 DP IDCODE (DPIDR) - 调试端口标识码
    let target_idcode = read_dp_idcode(&mut session);

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

// ==================== RTT 独立连接命令 ====================

#[tauri::command]
pub async fn connect_rtt(
    options: ConnectOptions,
    state: State<'_, AppState>,
) -> AppResult<TargetInfo> {
    // 关闭现有 RTT 连接
    {
        let mut rtt_session_guard = state.rtt_session.lock();
        *rtt_session_guard = None;
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

    // 设置时钟速度（前端传递的是Hz，probe-rs需要kHz）
    if let Some(speed_hz) = options.clock_speed {
        let speed_khz = speed_hz / 1000;
        probe
            .set_speed(speed_khz)
            .map_err(|e| AppError::ProbeError(format!("设置时钟速度失败 ({} kHz): {}", speed_khz, e)))?;
    }

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

    // 读取芯片ID
    let chip_id = read_chip_id(&mut session);

    // 读取 DP IDCODE (DPIDR) - 调试端口标识码
    let target_idcode = read_dp_idcode(&mut session);

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

    // 存储 RTT 连接信息
    {
        let mut rtt_conn_info = state.rtt_connection_info.lock();
        *rtt_conn_info = Some(ConnectionInfo {
            probe_name: options.probe_identifier.clone(),
            probe_serial: probe_info.serial_number.clone(),
            target_name: options.target.clone(),
            core_type: target_info.core_type.clone(),
            chip_id,
            target_idcode,
        });
    }

    // 存储 RTT session
    {
        let mut rtt_session_guard = state.rtt_session.lock();
        *rtt_session_guard = Some(session);
    }

    Ok(target_info)
}

#[tauri::command]
pub async fn disconnect_rtt(state: State<'_, AppState>) -> AppResult<()> {
    // 停止 RTT
    state.rtt_state.set_running(false);

    // 释放 RTT session
    {
        let mut rtt_session_guard = state.rtt_session.lock();
        if let Some(session) = rtt_session_guard.as_mut() {
            if let Ok(mut core) = session.core(0) {
                let _ = core.run();
            }
        }
        *rtt_session_guard = None;
    }

    // 清除 RTT 连接信息
    let mut rtt_conn_info = state.rtt_connection_info.lock();
    *rtt_conn_info = None;

    Ok(())
}

#[tauri::command]
pub async fn get_rtt_connection_status(state: State<'_, AppState>) -> AppResult<ConnectionStatus> {
    let rtt_session_guard = state.rtt_session.lock();
    let connected = rtt_session_guard.is_some();

    let rtt_conn_info = state.rtt_connection_info.lock();

    Ok(ConnectionStatus {
        connected,
        info: rtt_conn_info.clone(),
    })
}

/// 诊断命令：列出所有 USB 设备（特别是 CMSIS-DAP 相关的）
#[tauri::command]
pub async fn diagnose_usb_devices() -> AppResult<Vec<UsbDeviceInfo>> {
    log::info!("=== USB Device Diagnosis Start ===");

    let mut devices = Vec::new();

    for device_info in nusb::list_devices().map_err(|e| AppError::ProbeError(e.to_string()))? {
        let vid = device_info.vendor_id();
        let pid = device_info.product_id();

        // 只显示可能是 DAP 的设备 (VID=0xFAED 或其他已知 CMSIS-DAP VID)
        let is_potential_dap = vid == 0xFAED  // Ahypnis
            || vid == 0x0D28  // ARM DAPLink
            || vid == 0xC251  // Keil
            || vid == 0x1366  // SEGGER
            || vid == 0x0483; // STMicroelectronics

        if !is_potential_dap {
            continue;
        }

        let manufacturer = device_info.manufacturer_string().map(|s| s.to_string());
        let product = device_info.product_string().map(|s| s.to_string());
        let serial = device_info.serial_number().map(|s| s.to_string());

        log::info!(
            "Found USB device: VID={:#06x}, PID={:#06x}, bus={}, addr={}",
            vid, pid,
            device_info.bus_number(),
            device_info.device_address()
        );
        log::info!("  Manufacturer: {:?}", manufacturer);
        log::info!("  Product: {:?}", product);
        log::info!("  Serial: {:?}", serial);

        // 获取接口信息
        let mut interfaces = Vec::new();
        for iface in device_info.interfaces() {
            let iface_str = iface.interface_string().map(|s| s.to_string());

            log::info!(
                "    Interface {}: class={:#04x}, subclass={:#04x}, protocol={:#04x}, string={:?}",
                iface.interface_number(),
                iface.class(),
                iface.subclass(),
                iface.protocol(),
                iface_str
            );

            // 检查是否是 CMSIS-DAP v2 (Vendor class + 包含 "CMSIS-DAP" 字符串)
            let is_cmsis_dap_v2 = iface.class() == 0xFF  // Vendor Specific
                && iface_str.as_ref().map(|s| s.contains("CMSIS-DAP")).unwrap_or(false);

            if is_cmsis_dap_v2 {
                log::info!("    ^^^ This is CMSIS-DAP v2 interface!");
            }

            interfaces.push(UsbInterfaceInfo {
                interface_number: iface.interface_number(),
                class: iface.class(),
                subclass: iface.subclass(),
                protocol: iface.protocol(),
                interface_string: iface_str,
            });
        }

        devices.push(UsbDeviceInfo {
            vendor_id: vid,
            product_id: pid,
            manufacturer,
            product,
            serial_number: serial,
            bus_number: device_info.bus_number(),
            device_address: device_info.device_address(),
            interfaces,
        });
    }

    log::info!("=== USB Device Diagnosis End ===");
    log::info!("Found {} potential DAP devices", devices.len());

    Ok(devices)
}
