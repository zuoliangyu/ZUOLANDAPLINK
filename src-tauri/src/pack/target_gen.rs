// Pack 到 probe-rs 目标定义的转换模块
// 参考 probe-rs 的 target-gen 工具实现

use crate::error::{AppError, AppResult};
use crate::pack::flash_algo;
use quick_xml::events::Event;
use quick_xml::Reader;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// 设备定义（从 PDSC 解析）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceDefinition {
    pub name: String,
    pub processor: ProcessorInfo,
    pub memory: MemoryInfo,
    pub flash_algorithm: Option<String>, // Flash 算法文件名
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessorInfo {
    pub core: String,      // Cortex-M0, Cortex-M3, Cortex-M4, etc.
    pub fpu: bool,
    pub mpu: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryInfo {
    pub ram_start: u64,
    pub ram_size: u64,
    pub flash_start: u64,
    pub flash_size: u64,
}

/// 从 Pack 目录解析所有设备定义
pub fn parse_devices_from_pack(pack_dir: &Path) -> AppResult<Vec<DeviceDefinition>> {
    // 查找 PDSC 文件
    let pdsc_path = find_pdsc_file(pack_dir)?;
    let content = fs::read_to_string(&pdsc_path)?;

    parse_devices_from_pdsc(&content)
}

/// 查找 Pack 目录中的 PDSC 文件
fn find_pdsc_file(pack_dir: &Path) -> AppResult<std::path::PathBuf> {
    for entry in fs::read_dir(pack_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.extension().map_or(false, |ext| ext == "pdsc") {
            return Ok(path);
        }
    }

    Err(AppError::PackError("未找到 PDSC 文件".to_string()))
}

/// 从 PDSC 内容解析设备定义
pub fn parse_devices_from_pdsc(content: &str) -> AppResult<Vec<DeviceDefinition>> {
    let mut reader = Reader::from_str(content);
    reader.config_mut().trim_text(true);

    let mut devices = Vec::new();
    let mut buf = Vec::new();

    let mut in_devices = false;
    let mut current_device: Option<DeviceDefinition> = None;
    let mut current_processor: Option<ProcessorInfo> = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                match e.name().as_ref() {
                    b"devices" => {
                        in_devices = true;
                    }
                    b"device" if in_devices => {
                        // 开始新设备
                        let mut name = String::new();

                        for attr in e.attributes() {
                            if let Ok(attr) = attr {
                                if attr.key.as_ref() == b"Dname" {
                                    name = String::from_utf8_lossy(&attr.value).to_string();
                                }
                            }
                        }

                        if !name.is_empty() {
                            current_device = Some(DeviceDefinition {
                                name,
                                processor: ProcessorInfo {
                                    core: String::new(),
                                    fpu: false,
                                    mpu: false,
                                },
                                memory: MemoryInfo {
                                    ram_start: 0,
                                    ram_size: 0,
                                    flash_start: 0,
                                    flash_size: 0,
                                },
                                flash_algorithm: None,
                            });
                        }
                    }
                    b"processor" if current_device.is_some() => {
                        let mut core = String::new();
                        let mut fpu = false;
                        let mut mpu = false;

                        for attr in e.attributes() {
                            if let Ok(attr) = attr {
                                match attr.key.as_ref() {
                                    b"Dcore" => {
                                        core = String::from_utf8_lossy(&attr.value).to_string();
                                    }
                                    b"Dfpu" => {
                                        let val = String::from_utf8_lossy(&attr.value);
                                        fpu = val == "1" || val.to_lowercase() == "true";
                                    }
                                    b"Dmpu" => {
                                        let val = String::from_utf8_lossy(&attr.value);
                                        mpu = val == "1" || val.to_lowercase() == "true";
                                    }
                                    _ => {}
                                }
                            }
                        }

                        current_processor = Some(ProcessorInfo { core, fpu, mpu });
                    }
                    b"memory" if current_device.is_some() => {
                        let mut id = String::new();
                        let mut start = 0u64;
                        let mut size = 0u64;

                        for attr in e.attributes() {
                            if let Ok(attr) = attr {
                                match attr.key.as_ref() {
                                    b"id" => {
                                        id = String::from_utf8_lossy(&attr.value).to_string();
                                    }
                                    b"start" => {
                                        let val = String::from_utf8_lossy(&attr.value);
                                        start = parse_hex_or_dec(&val).unwrap_or(0);
                                    }
                                    b"size" => {
                                        let val = String::from_utf8_lossy(&attr.value);
                                        size = parse_hex_or_dec(&val).unwrap_or(0);
                                    }
                                    _ => {}
                                }
                            }
                        }

                        // 更新当前设备的内存信息
                        if let Some(ref mut dev) = current_device {
                            if id.to_uppercase().contains("IROM") || id.to_uppercase().contains("FLASH") {
                                dev.memory.flash_start = start;
                                dev.memory.flash_size = size;
                            } else if id.to_uppercase().contains("IRAM") || id.to_uppercase().contains("RAM") {
                                dev.memory.ram_start = start;
                                dev.memory.ram_size = size;
                            }
                        }
                    }
                    b"algorithm" if current_device.is_some() => {
                        for attr in e.attributes() {
                            if let Ok(attr) = attr {
                                if attr.key.as_ref() == b"name" {
                                    let algo_name = String::from_utf8_lossy(&attr.value).to_string();
                                    if let Some(ref mut dev) = current_device {
                                        dev.flash_algorithm = Some(algo_name);
                                    }
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                match e.name().as_ref() {
                    b"devices" => {
                        in_devices = false;
                    }
                    b"device" => {
                        // 完成当前设备
                        if let Some(mut dev) = current_device.take() {
                            if let Some(proc) = current_processor.take() {
                                dev.processor = proc;
                            }
                            devices.push(dev);
                        }
                        current_processor = None;
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(AppError::PackError(format!("解析 PDSC 失败: {}", e)));
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(devices)
}

/// 解析十六进制或十进制数字
fn parse_hex_or_dec(s: &str) -> Option<u64> {
    let s = s.trim();

    if s.starts_with("0x") || s.starts_with("0X") {
        u64::from_str_radix(&s[2..], 16).ok()
    } else {
        s.parse::<u64>().ok()
    }
}

/// 生成 probe-rs YAML 格式的目标定义（包含 Flash 算法）
pub fn generate_probe_rs_yaml_with_algo(
    devices: &[DeviceDefinition],
    family_name: &str,
    pack_dir: &Path,
) -> AppResult<String> {
    let mut yaml = String::new();

    // 家族定义
    yaml.push_str(&format!("name: {}\n", family_name));
    yaml.push_str("manufacturer:\n");
    yaml.push_str(&format!("  id: 0x{:x}\n", 0)); // TODO: 从 PDSC 获取
    yaml.push_str("  cc: 0x0\n");
    yaml.push_str("generated_from_pack: true\n");
    yaml.push_str("pack_file_release: \"unknown\"\n");
    yaml.push_str("variants:\n");

    // 查找所有 FLM 文件
    let flm_files = flash_algo::find_flm_files(pack_dir)?;
    log::info!("在 Pack 中找到 {} 个 FLM 文件", flm_files.len());

    // 为每个设备生成变体
    for device in devices {
        yaml.push_str(&format!("  - name: {}\n", device.name));

        // 内存映射
        yaml.push_str("    memory_map:\n");

        // RAM
        if device.memory.ram_size > 0 {
            yaml.push_str("      - Ram:\n");
            yaml.push_str(&format!("          range:\n"));
            yaml.push_str(&format!("            start: 0x{:x}\n", device.memory.ram_start));
            yaml.push_str(&format!(
                "            end: 0x{:x}\n",
                device.memory.ram_start + device.memory.ram_size
            ));
            yaml.push_str("          is_boot_memory: false\n");
        }

        // Flash
        if device.memory.flash_size > 0 {
            yaml.push_str("      - Nvm:\n");
            yaml.push_str(&format!("          range:\n"));
            yaml.push_str(&format!("            start: 0x{:x}\n", device.memory.flash_start));
            yaml.push_str(&format!(
                "            end: 0x{:x}\n",
                device.memory.flash_start + device.memory.flash_size
            ));
            yaml.push_str("          is_boot_memory: true\n");
            yaml.push_str("          cores:\n");
            yaml.push_str("            - main\n");
        }

        // 处理器核心
        yaml.push_str("    cores:\n");
        yaml.push_str("      - name: main\n");
        yaml.push_str(&format!("        type: {}\n", map_core_type(&device.processor.core)));
        yaml.push_str("        core_access_options: !Arm\n");

        // Flash 算法
        if device.memory.flash_size > 0 {
            // 尝试为设备匹配 FLM 文件
            if let Some(flm_path) = flash_algo::match_flm_for_device(&flm_files, &device.name) {
                log::info!("为设备 {} 匹配到 FLM: {:?}", device.name, flm_path);

                match flash_algo::extract_flash_algorithm_from_flm(
                    &flm_path,
                    device.memory.flash_start,
                    device.memory.flash_size,
                ) {
                    Ok(algo) => {
                        yaml.push_str("    flash_algorithms:\n");
                        yaml.push_str("      - default: true\n");
                        yaml.push_str(&format!("        name: {}\n", algo.name));
                        yaml.push_str(&format!("        description: {}\n", algo.description));
                        yaml.push_str(&format!("        load_address: 0x{:x}\n", device.memory.ram_start));
                        yaml.push_str(&format!("        data_section_offset: 0x{:x}\n", algo.data_section_offset));
                        yaml.push_str("        transfer_encoding: raw\n");

                        // 函数指针
                        if let Some(pc_init) = algo.pc_init {
                            yaml.push_str(&format!("        pc_init: 0x{:x}\n", pc_init));
                        }
                        if let Some(pc_uninit) = algo.pc_uninit {
                            yaml.push_str(&format!("        pc_uninit: 0x{:x}\n", pc_uninit));
                        }
                        yaml.push_str(&format!("        pc_program_page: 0x{:x}\n", algo.pc_program_page));
                        yaml.push_str(&format!("        pc_erase_sector: 0x{:x}\n", algo.pc_erase_sector));
                        if let Some(pc_erase_all) = algo.pc_erase_all {
                            yaml.push_str(&format!("        pc_erase_all: 0x{:x}\n", pc_erase_all));
                        }

                        // Flash 属性
                        yaml.push_str("        flash_properties:\n");
                        yaml.push_str("          address_range:\n");
                        yaml.push_str(&format!("            start: 0x{:x}\n", algo.flash_properties.address_range.start));
                        yaml.push_str(&format!("            end: 0x{:x}\n", algo.flash_properties.address_range.end));
                        yaml.push_str(&format!("          page_size: {}\n", algo.flash_properties.page_size));
                        yaml.push_str(&format!("          erased_byte_value: 0x{:x}\n", algo.flash_properties.erased_byte_value));
                        yaml.push_str(&format!("          program_page_timeout: {}\n", algo.flash_properties.program_page_timeout));
                        yaml.push_str(&format!("          erase_sector_timeout: {}\n", algo.flash_properties.erase_sector_timeout));

                        // 扇区信息
                        yaml.push_str("          sectors:\n");
                        for sector in &algo.flash_properties.sectors {
                            yaml.push_str(&format!("            - size: {}\n", sector.size));
                            yaml.push_str(&format!("              address: 0x{:x}\n", sector.address));
                        }

                        // Instructions (base64 编码的 ELF 数据)
                        yaml.push_str(&format!("        instructions: \"{}\"\n", algo.instructions));

                        log::info!("成功为设备 {} 生成 Flash 算法", device.name);
                    }
                    Err(e) => {
                        log::warn!("提取 Flash 算法失败: {}，设备 {} 将无法烧录", e, device.name);
                    }
                }
            } else {
                log::warn!("未找到设备 {} 的 FLM 文件", device.name);
            }
        }

        yaml.push_str("\n");
    }

    Ok(yaml)
}

/// 生成 probe-rs YAML 格式的目标定义（不包含 Flash 算法，保留用于兼容）
pub fn generate_probe_rs_yaml(devices: &[DeviceDefinition], family_name: &str) -> String {
    let mut yaml = String::new();

    // 家族定义
    yaml.push_str(&format!("name: {}\n", family_name));
    yaml.push_str("manufacturer:\n");
    yaml.push_str(&format!("  id: 0x{:x}\n", 0)); // TODO: 从 PDSC 获取
    yaml.push_str("  cc: 0x0\n");
    yaml.push_str("generated_from_pack: true\n");
    yaml.push_str("pack_file_release: \"unknown\"\n");
    yaml.push_str("variants:\n");

    // 为每个设备生成变体
    for device in devices {
        yaml.push_str(&format!("  - name: {}\n", device.name));

        // 内存映射
        yaml.push_str("    memory_map:\n");

        // RAM
        if device.memory.ram_size > 0 {
            yaml.push_str("      - Ram:\n");
            yaml.push_str(&format!("          range:\n"));
            yaml.push_str(&format!("            start: 0x{:x}\n", device.memory.ram_start));
            yaml.push_str(&format!("            end: 0x{:x}\n",
                device.memory.ram_start + device.memory.ram_size));
            yaml.push_str("          is_boot_memory: false\n");
        }

        // Flash
        if device.memory.flash_size > 0 {
            yaml.push_str("      - Nvm:\n");
            yaml.push_str(&format!("          range:\n"));
            yaml.push_str(&format!("            start: 0x{:x}\n", device.memory.flash_start));
            yaml.push_str(&format!("            end: 0x{:x}\n",
                device.memory.flash_start + device.memory.flash_size));
            yaml.push_str("          is_boot_memory: true\n");
            yaml.push_str("          cores:\n");
            yaml.push_str("            - main\n");
        }

        // 处理器核心
        yaml.push_str("    cores:\n");
        yaml.push_str("      - name: main\n");
        yaml.push_str(&format!("        type: {}\n", map_core_type(&device.processor.core)));
        yaml.push_str("        core_access_options: !Arm\n");

        // Flash 算法（如果有）
        if device.flash_algorithm.is_some() {
            yaml.push_str("    flash_algorithms:\n");
            yaml.push_str("      - default: true\n");
            yaml.push_str(&format!("        name: {}\n", device.name));
            yaml.push_str("        description: Flash algorithm\n");
            yaml.push_str(&format!("        load_address: 0x{:x}\n", 0x20000000)); // 默认 RAM 地址
            yaml.push_str("        data_section_offset: 0x0\n");
            // TODO: 添加实际的 Flash 算法数据
        }

        yaml.push_str("\n");
    }

    yaml
}

/// 映射处理器核心类型到 probe-rs 格式
fn map_core_type(core: &str) -> &'static str {
    match core.to_uppercase().as_str() {
        "CORTEX-M0" | "CM0" => "Cortex-M0",
        "CORTEX-M0+" | "CM0PLUS" | "CM0+" => "Cortex-M0Plus",
        "CORTEX-M3" | "CM3" => "Cortex-M3",
        "CORTEX-M4" | "CM4" => "Cortex-M4",
        "CORTEX-M7" | "CM7" => "Cortex-M7",
        "CORTEX-M33" | "CM33" => "Cortex-M33",
        _ => "Cortex-M4", // 默认
    }
}
