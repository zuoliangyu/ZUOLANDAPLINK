use crate::error::{AppError, AppResult};
use crate::pack::manager::{PackManager, PackInfo};
use probe_rs::config::get_target_by_name;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChipInfo {
    pub name: String,
    pub vendor: String,
    pub family: String,
    pub cores: Vec<CoreInfo>,
    pub memory_regions: Vec<MemoryRegionInfo>,
    pub flash_algorithms: Vec<FlashAlgorithmInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreInfo {
    pub name: String,
    pub core_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryRegionInfo {
    pub name: String,
    pub kind: String,
    pub address: u64,
    pub size: u64,
    pub page_size: Option<u64>,
    pub sector_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashAlgorithmInfo {
    pub name: String,
    pub default: bool,
    pub load_address: u64,
    pub data_section_offset: u64,
}

// 内置常用芯片列表（静态数据）
const BUILTIN_CHIPS: &[&str] = &[
    // STM32F0
    "STM32F030C6Tx", "STM32F030C8Tx", "STM32F030F4Px", "STM32F030K6Tx",
    "STM32F030R8Tx", "STM32F031C4Tx", "STM32F031C6Tx", "STM32F042C4Tx",
    "STM32F042C6Tx", "STM32F042K4Tx", "STM32F042K6Tx",
    // STM32F1
    "STM32F100C4Tx", "STM32F100C6Tx", "STM32F100C8Tx", "STM32F100CBTx",
    "STM32F100R4Tx", "STM32F100R6Tx", "STM32F100R8Tx", "STM32F100RBTx",
    "STM32F100RCTx", "STM32F100RDTx", "STM32F100RETx", "STM32F100V8Tx",
    "STM32F100VBTx", "STM32F100VCTx", "STM32F100VDTx", "STM32F100VETx",
    "STM32F101C4Tx", "STM32F101C6Tx", "STM32F101C8Tx", "STM32F101CBTx",
    "STM32F101R4Tx", "STM32F101R6Tx", "STM32F101R8Tx", "STM32F101RBTx",
    "STM32F101RCTx", "STM32F101RDTx", "STM32F101RETx", "STM32F101RFTx",
    "STM32F101RGTx", "STM32F101V8Tx", "STM32F101VBTx", "STM32F101VCTx",
    "STM32F103C4Tx", "STM32F103C6Tx", "STM32F103C8Tx", "STM32F103CBTx",
    "STM32F103R4Tx", "STM32F103R6Tx", "STM32F103R8Tx", "STM32F103RBTx",
    "STM32F103RCTx", "STM32F103RDTx", "STM32F103RETx", "STM32F103RFTx",
    "STM32F103RGTx", "STM32F103V8Tx", "STM32F103VBTx", "STM32F103VCTx",
    "STM32F103VDTx", "STM32F103VETx", "STM32F103VFTx", "STM32F103VGTx",
    "STM32F103ZCTx", "STM32F103ZDTx", "STM32F103ZETx", "STM32F103ZFTx",
    "STM32F103ZGTx",
    // STM32F2
    "STM32F205RBTx", "STM32F205RCTx", "STM32F205RETx", "STM32F205RFTx",
    "STM32F205RGTx", "STM32F205VBTx", "STM32F205VCTx", "STM32F205VETx",
    "STM32F205VFTx", "STM32F205VGTx", "STM32F205ZCTx", "STM32F205ZETx",
    "STM32F205ZFTx", "STM32F205ZGTx",
    // STM32F3
    "STM32F301C6Tx", "STM32F301C8Tx", "STM32F301K6Ux", "STM32F301K8Ux",
    "STM32F301R6Tx", "STM32F301R8Tx", "STM32F302C6Tx", "STM32F302C8Tx",
    "STM32F302CBTx", "STM32F302CCTx", "STM32F302K6Ux", "STM32F302K8Ux",
    "STM32F302R6Tx", "STM32F302R8Tx", "STM32F302RBTx", "STM32F302RCTx",
    "STM32F302RDTx", "STM32F302RETx",
    // STM32F4
    "STM32F401CBUx", "STM32F401CCUx", "STM32F401CDUx", "STM32F401CEUx",
    "STM32F401RBTx", "STM32F401RCTx", "STM32F401RDTx", "STM32F401RETx",
    "STM32F401VBTx", "STM32F401VCTx", "STM32F401VDTx", "STM32F401VETx",
    "STM32F405OETx", "STM32F405OGTx", "STM32F405RGTx", "STM32F405VGTx",
    "STM32F405ZGTx", "STM32F407IETx", "STM32F407IGTx", "STM32F407VETx",
    "STM32F407VGTx", "STM32F407ZETx", "STM32F407ZGTx",
    "STM32F411CCUx", "STM32F411CEUx", "STM32F411RCTx", "STM32F411RETx",
    "STM32F411VCTx", "STM32F411VETx",
    // STM32G0
    "STM32G030C6Tx", "STM32G030C8Tx", "STM32G030F6Px", "STM32G030J6Mx",
    "STM32G030K6Tx", "STM32G030K8Tx", "STM32G031C4Tx", "STM32G031C6Tx",
    "STM32G031C8Tx", "STM32G031F4Px", "STM32G031F6Px", "STM32G031F8Px",
    "STM32G031G4Ux", "STM32G031G6Ux", "STM32G031G8Ux", "STM32G031J4Mx",
    "STM32G031J6Mx", "STM32G031K4Tx", "STM32G031K6Tx", "STM32G031K8Tx",
    "STM32G031Y8Yx",
    // STM32G4
    "STM32G431C6Tx", "STM32G431C8Tx", "STM32G431CBTx", "STM32G431K6Tx",
    "STM32G431K8Tx", "STM32G431KBTx", "STM32G431R6Tx", "STM32G431R8Tx",
    "STM32G431RBTx", "STM32G431V6Tx", "STM32G431V8Tx", "STM32G431VBTx",
    // STM32L0
    "STM32L010C6Tx", "STM32L010F4Px", "STM32L010K4Tx", "STM32L010K8Tx",
    "STM32L010R8Tx", "STM32L010RBTx", "STM32L011D3Px", "STM32L011D4Px",
    "STM32L011E3Yx", "STM32L011E4Yx", "STM32L011F3Px", "STM32L011F4Px",
    "STM32L011G3Ux", "STM32L011G4Ux", "STM32L011K3Tx", "STM32L011K4Tx",
    // STM32L4
    "STM32L412C8Tx", "STM32L412CBTx", "STM32L412K8Tx", "STM32L412KBTx",
    "STM32L412R8Tx", "STM32L412RBTx", "STM32L412T8Yx", "STM32L412TBYx",
    "STM32L431CBTx", "STM32L431CCTx", "STM32L431KBUx", "STM32L431KCUx",
    "STM32L431RBTx", "STM32L431RCTx", "STM32L431VCTx",
    // GD32F1 (兼容STM32F1)
    "GD32F103C8T6", "GD32F103CBT6", "GD32F103RBT6", "GD32F103RCT6",
    "GD32F103RET6", "GD32F103VBT6", "GD32F103VCT6", "GD32F103VET6",
    // GD32F0
    "GD32F190C8T6", "GD32F190R8T6", "GD32F190T8U6",
    "GD32F150C8T6", "GD32F150R8T6", "GD32F150G8U6",
    // GD32F2
    "GD32F205RCT6", "GD32F205RET6", "GD32F205VCT6", "GD32F205VET6",
    "GD32F207RCT6", "GD32F207RET6", "GD32F207VCT6", "GD32F207VET6",
    // GD32F3
    "GD32F303CCT6", "GD32F303RCT6", "GD32F303RET6", "GD32F303VCT6",
    "GD32F303VET6", "GD32F305RCT6", "GD32F305RET6", "GD32F305VCT6",
    "GD32F307RCT6", "GD32F307RET6", "GD32F307VCT6", "GD32F307VET6",
    // GD32F4
    "GD32F405RGT6", "GD32F405VGT6", "GD32F405ZGT6",
    "GD32F407RET6", "GD32F407RGT6", "GD32F407VET6", "GD32F407VGT6",
    "GD32F407ZET6", "GD32F407ZGT6", "GD32F450VGT6", "GD32F450ZGT6",
    // GD32E
    "GD32E103C8T6", "GD32E103CBT6", "GD32E103RBT6", "GD32E103RCT6",
    "GD32E230C8T6", "GD32E230F8P6", "GD32E230G8U6",
    // GD32L (低功耗系列)
    "GD32L233C8T6", "GD32L233CCT6", "GD32L233RCT6",
    // CW32 (武汉芯源)
    "CW32F030C8T6", "CW32F030C6T6", "CW32F003F4P6", "CW32F003F6P7",
    "CW32L031C8T6", "CW32L052C8T6", "CW32F103C8T6", "CW32F103CBT6",
    // nRF
    "nRF52832_xxAA", "nRF52833_xxAA", "nRF52840_xxAA",
    "nRF51822_xxAA", "nRF51822_xxAB", "nRF51822_xxAC",
    // RP2040
    "rp2040",
    // ESP32 (probe-rs支持)
    "esp32c3", "esp32c6", "esp32s3",
];

#[tauri::command]
pub async fn get_supported_chips() -> AppResult<Vec<String>> {
    Ok(BUILTIN_CHIPS.iter().map(|s| s.to_string()).collect())
}

#[tauri::command]
pub async fn search_chips(query: String) -> AppResult<Vec<String>> {
    let query_lower = query.to_lowercase();

    let matched: Vec<String> = BUILTIN_CHIPS
        .iter()
        .filter(|chip| chip.to_lowercase().contains(&query_lower))
        .take(50)
        .map(|s| s.to_string())
        .collect();

    Ok(matched)
}

#[tauri::command]
pub async fn get_chip_info(chip_name: String) -> AppResult<ChipInfo> {
    // 尝试从probe-rs获取目标信息
    let target = get_target_by_name(&chip_name)
        .map_err(|e| AppError::ConfigError(format!("未找到芯片 {}: {}", chip_name, e)))?;

    let chip_info = ChipInfo {
        name: target.name.clone(),
        vendor: "".to_string(), // probe-rs 0.27 不直接提供厂商信息
        family: "".to_string(),
        cores: target
            .cores
            .iter()
            .map(|c| CoreInfo {
                name: c.name.clone(),
                core_type: format!("{:?}", c.core_type),
            })
            .collect(),
        memory_regions: target
            .memory_map
            .iter()
            .map(|region| match region {
                probe_rs::config::MemoryRegion::Ram(r) => MemoryRegionInfo {
                    name: r.name.clone().unwrap_or_default(),
                    kind: "RAM".to_string(),
                    address: r.range.start,
                    size: r.range.end - r.range.start,
                    page_size: None,
                    sector_size: None,
                },
                probe_rs::config::MemoryRegion::Nvm(r) => MemoryRegionInfo {
                    name: r.name.clone().unwrap_or_default(),
                    kind: "Flash".to_string(),
                    address: r.range.start,
                    size: r.range.end - r.range.start,
                    page_size: None,
                    sector_size: None,
                },
                probe_rs::config::MemoryRegion::Generic(r) => MemoryRegionInfo {
                    name: r.name.clone().unwrap_or_default(),
                    kind: "Generic".to_string(),
                    address: r.range.start,
                    size: r.range.end - r.range.start,
                    page_size: None,
                    sector_size: None,
                },
            })
            .collect(),
        flash_algorithms: target
            .flash_algorithms
            .iter()
            .map(|a| FlashAlgorithmInfo {
                name: a.name.clone(),
                default: a.default,
                load_address: a.load_address.unwrap_or(0),
                data_section_offset: a.data_section_offset,
            })
            .collect(),
    };

    Ok(chip_info)
}

#[tauri::command]
pub async fn import_pack(pack_path: String) -> AppResult<PackInfo> {
    let path = PathBuf::from(&pack_path);

    if !path.exists() {
        return Err(AppError::FileError("Pack文件不存在".to_string()));
    }

    let manager = PackManager::new()?;
    let pack_info = manager.import_pack(&path)?;

    Ok(pack_info)
}

#[tauri::command]
pub async fn list_imported_packs() -> AppResult<Vec<PackInfo>> {
    let manager = PackManager::new()?;
    let packs = manager.list_packs()?;
    Ok(packs)
}

#[tauri::command]
pub async fn get_flash_algorithms(chip_name: String) -> AppResult<Vec<FlashAlgorithmInfo>> {
    let target = get_target_by_name(&chip_name)
        .map_err(|e| AppError::ConfigError(format!("未找到芯片: {}", e)))?;

    let algorithms: Vec<FlashAlgorithmInfo> = target
        .flash_algorithms
        .iter()
        .map(|a| FlashAlgorithmInfo {
            name: a.name.clone(),
            default: a.default,
            load_address: a.load_address.unwrap_or(0),
            data_section_offset: a.data_section_offset,
        })
        .collect();

    Ok(algorithms)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub name: String,
    pub chip: String,
    pub interface_type: String,
    pub clock_speed: u32,
    pub firmware_path: Option<String>,
    pub verify_after_flash: bool,
    pub reset_after_flash: bool,
}

#[tauri::command]
pub async fn save_project_config(config: ProjectConfig, file_path: String) -> AppResult<()> {
    let json = serde_json::to_string_pretty(&config)?;
    std::fs::write(&file_path, json)?;
    Ok(())
}

#[tauri::command]
pub async fn load_project_config(file_path: String) -> AppResult<ProjectConfig> {
    let content = std::fs::read_to_string(&file_path)?;
    let config: ProjectConfig = serde_json::from_str(&content)?;
    Ok(config)
}
