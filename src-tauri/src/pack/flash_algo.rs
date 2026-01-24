// Flash 算法提取模块
// 从 .FLM 文件（ELF 格式）中提取 Flash 算法

use crate::error::{AppError, AppResult};
use base64::Engine;
use object::{Object, ObjectSection, ObjectSymbol};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Flash 算法定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashAlgorithm {
    pub name: String,
    pub description: String,
    pub default: bool,
    pub instructions: String,        // base64 编码的 ELF 数据
    pub pc_init: Option<u64>,        // Init 函数地址
    pub pc_uninit: Option<u64>,      // UnInit 函数地址
    pub pc_program_page: u64,        // ProgramPage 函数地址
    pub pc_erase_sector: u64,        // EraseSector 函数地址
    pub pc_erase_all: Option<u64>,   // EraseChip 函数地址
    pub data_section_offset: u64,
    pub flash_properties: FlashProperties,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashProperties {
    pub address_range: AddressRange,
    pub page_size: u64,
    pub erased_byte_value: u8,
    pub program_page_timeout: u64,
    pub erase_sector_timeout: u64,
    pub sectors: Vec<SectorInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddressRange {
    pub start: u64,
    pub end: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectorInfo {
    pub size: u64,
    pub address: u64,
}

/// 从 .FLM 文件提取 Flash 算法
pub fn extract_flash_algorithm_from_flm(
    flm_path: &Path,
    flash_start: u64,
    flash_size: u64,
) -> AppResult<FlashAlgorithm> {
    // 读取 FLM 文件
    let flm_data = fs::read(flm_path)?;

    // 解析 ELF 文件
    let elf_file = object::File::parse(&*flm_data)
        .map_err(|e| AppError::PackError(format!("解析 FLM 文件失败: {}", e)))?;

    // 提取符号表
    let symbols = extract_symbols(&elf_file)?;

    // 提取可加载段
    let loadable_data = extract_loadable_sections(&elf_file)?;

    // 将数据转换为 base64
    let instructions = base64::engine::general_purpose::STANDARD.encode(&loadable_data);

    // 查找数据段偏移
    let data_section_offset = find_data_section_offset(&elf_file)?;

    // 创建 Flash 算法
    Ok(FlashAlgorithm {
        name: flm_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string(),
        description: "Flash algorithm from CMSIS-Pack".to_string(),
        default: true,
        instructions,
        pc_init: symbols.get("Init").copied(),
        pc_uninit: symbols.get("UnInit").copied(),
        pc_program_page: *symbols
            .get("ProgramPage")
            .ok_or_else(|| AppError::PackError("未找到 ProgramPage 函数".to_string()))?,
        pc_erase_sector: *symbols
            .get("EraseSector")
            .ok_or_else(|| AppError::PackError("未找到 EraseSector 函数".to_string()))?,
        pc_erase_all: symbols.get("EraseChip").copied(),
        data_section_offset,
        flash_properties: FlashProperties {
            address_range: AddressRange {
                start: flash_start,
                end: flash_start + flash_size,
            },
            page_size: 256, // 默认值，应该从 PDSC 读取
            erased_byte_value: 0xFF,
            program_page_timeout: 1000,
            erase_sector_timeout: 2000,
            sectors: generate_sectors(flash_start, flash_size),
        },
    })
}

/// 提取符号表
fn extract_symbols(elf_file: &object::File) -> AppResult<std::collections::HashMap<String, u64>> {
    let mut symbols = std::collections::HashMap::new();

    for symbol in elf_file.symbols() {
        if let Ok(name) = symbol.name() {
            if let Some(address) = symbol.address().checked_sub(0) {
                // 只保留我们需要的函数
                if matches!(
                    name,
                    "Init" | "UnInit" | "ProgramPage" | "EraseSector" | "EraseChip"
                ) {
                    symbols.insert(name.to_string(), address);
                }
            }
        }
    }

    Ok(symbols)
}

/// 提取可加载段
fn extract_loadable_sections(elf_file: &object::File) -> AppResult<Vec<u8>> {
    let mut loadable_data = Vec::new();

    for section in elf_file.sections() {
        // 只提取可加载的代码和数据段
        if section.kind() == object::SectionKind::Text
            || section.kind() == object::SectionKind::Data
        {
            if let Ok(data) = section.data() {
                loadable_data.extend_from_slice(data);
            }
        }
    }

    if loadable_data.is_empty() {
        return Err(AppError::PackError(
            "FLM 文件中未找到可加载段".to_string(),
        ));
    }

    Ok(loadable_data)
}

/// 查找数据段偏移
fn find_data_section_offset(elf_file: &object::File) -> AppResult<u64> {
    for section in elf_file.sections() {
        if section.kind() == object::SectionKind::Data {
            return Ok(section.address());
        }
    }

    // 如果没有找到数据段，返回 0
    Ok(0)
}

/// 生成扇区信息（简化版本）
fn generate_sectors(flash_start: u64, flash_size: u64) -> Vec<SectorInfo> {
    // 默认使用 4KB 扇区
    let sector_size = 4096u64;
    let sector_count = (flash_size + sector_size - 1) / sector_size;

    (0..sector_count)
        .map(|i| SectorInfo {
            size: sector_size,
            address: flash_start + i * sector_size,
        })
        .collect()
}

/// 从 Pack 目录查找 FLM 文件
pub fn find_flm_files(pack_dir: &Path) -> AppResult<Vec<std::path::PathBuf>> {
    let mut flm_files = Vec::new();

    // 递归搜索 Pack 目录中的 .FLM 文件
    fn search_dir(dir: &Path, flm_files: &mut Vec<std::path::PathBuf>) -> std::io::Result<()> {
        if dir.is_dir() {
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();

                if path.is_dir() {
                    search_dir(&path, flm_files)?;
                } else if path.extension().map_or(false, |ext| {
                    ext.eq_ignore_ascii_case("flm") || ext.eq_ignore_ascii_case("FLM")
                }) {
                    flm_files.push(path);
                }
            }
        }
        Ok(())
    }

    search_dir(pack_dir, &mut flm_files)?;

    if flm_files.is_empty() {
        return Err(AppError::PackError(
            "Pack 中未找到 FLM 文件".to_string(),
        ));
    }

    Ok(flm_files)
}

/// 根据设备名称匹配 FLM 文件
pub fn match_flm_for_device(
    flm_files: &[std::path::PathBuf],
    device_name: &str,
) -> Option<std::path::PathBuf> {
    // 简单的匹配策略：查找文件名包含设备系列的 FLM
    let device_upper = device_name.to_uppercase();

    // 提取设备系列（如 GD32F470 -> GD32F4）
    let series = if device_upper.starts_with("GD32") {
        device_upper.chars().take(7).collect::<String>() // GD32F4x
    } else if device_upper.starts_with("STM32") {
        device_upper.chars().take(7).collect::<String>() // STM32F4
    } else {
        device_upper.clone()
    };

    // 查找匹配的 FLM 文件
    for flm_path in flm_files {
        if let Some(file_name) = flm_path.file_name().and_then(|s| s.to_str()) {
            let file_name_upper = file_name.to_uppercase();

            // 检查文件名是否包含设备系列
            if file_name_upper.contains(&series) || file_name_upper.contains(&device_upper) {
                return Some(flm_path.clone());
            }
        }
    }

    // 如果没有精确匹配，返回第一个 FLM 文件
    flm_files.first().cloned()
}
