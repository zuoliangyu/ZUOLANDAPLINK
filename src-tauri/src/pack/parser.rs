use super::manager::PackInfo;
use crate::error::{AppError, AppResult};
use quick_xml::events::Event;
use quick_xml::Reader;

pub fn parse_pdsc(content: &str) -> AppResult<PackInfo> {
    #[cfg(debug_assertions)]
    println!("\n🔍 开始解析 PDSC 文件 (文件大小: {} 字节)", content.len());

    let mut reader = Reader::from_str(content);
    reader.config_mut().trim_text(true);

    let mut name = String::new();
    let mut vendor = String::new();
    let mut version = String::new();
    let mut description = String::new();
    let mut device_count = 0;

    let mut in_package = false;
    let mut in_description = false;
    let mut in_devices = false;
    let mut package_description_read = false; // 标记是否已读取 package 的 description

    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => match e.name().as_ref() {
                b"package" => {
                    in_package = true;
                }
                b"name" if in_package => {}
                b"vendor" if in_package => {}
                b"version" if in_package => {}
                b"description" if in_package => {
                    in_description = true;
                }
                b"devices" => {
                    in_devices = true;
                }
                b"device" if in_devices => {
                    device_count += 1;
                }
                _ => {}
            },
            Ok(Event::Text(e)) => {
                // 只读取 package 级别的 description，忽略 subFamily 等的 description
                if in_description && in_package && !package_description_read {
                    description = e.unescape().unwrap_or_default().to_string();
                    package_description_read = true;
                    #[cfg(debug_assertions)]
                    println!("  ✓ 读取到 package description: {}", description);
                }
            }
            Ok(Event::End(ref e)) => match e.name().as_ref() {
                b"package" => {
                    in_package = false;
                }
                b"description" => {
                    in_description = false;
                }
                b"devices" => {
                    in_devices = false;
                }
                _ => {}
            },
            Ok(Event::Empty(ref e)) => {
                // 处理自闭合标签
                for attr in e.attributes() {
                    if let Ok(attr) = attr {
                        match (e.name().as_ref(), attr.key.as_ref()) {
                            (b"package", b"vendor") => {
                                vendor = String::from_utf8_lossy(&attr.value).to_string();
                            }
                            (b"package", b"name") => {
                                name = String::from_utf8_lossy(&attr.value).to_string();
                            }
                            (b"package", b"version") => {
                                version = String::from_utf8_lossy(&attr.value).to_string();
                            }
                            _ => {}
                        }
                    }
                }

                if e.name().as_ref() == b"device" && in_devices {
                    device_count += 1;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(AppError::PackError(format!(
                    "解析PDSC文件失败: {}",
                    e
                )));
            }
            _ => {}
        }
        buf.clear();
    }

    // 如果name为空，尝试从其他地方获取
    if name.is_empty() {
        // 尝试从package标签的属性获取
        let mut reader = Reader::from_str(content);
        let mut buf = Vec::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) if e.name().as_ref() == b"package" => {
                    for attr in e.attributes() {
                        if let Ok(attr) = attr {
                            match attr.key.as_ref() {
                                b"vendor" if vendor.is_empty() => {
                                    vendor = String::from_utf8_lossy(&attr.value).to_string();
                                }
                                b"name" if name.is_empty() => {
                                    name = String::from_utf8_lossy(&attr.value).to_string();
                                }
                                _ => {}
                            }
                        }
                    }
                    break;
                }
                Ok(Event::Eof) => break,
                Err(_) => break,
                _ => {}
            }
            buf.clear();
        }
    }

    // 再次尝试读取文本内容
    if name.is_empty() || vendor.is_empty() || version.is_empty() {
        let mut reader = Reader::from_str(content);
        let mut buf = Vec::new();
        let mut current_tag = String::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    current_tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                }
                Ok(Event::Text(e)) => {
                    let text = e.unescape().unwrap_or_default().to_string();
                    match current_tag.as_str() {
                        "name" if name.is_empty() => {
                            name = text.clone();
                            #[cfg(debug_assertions)]
                            println!("  ✓ 读取到 name (文本): {}", text);
                        }
                        "vendor" if vendor.is_empty() => {
                            vendor = text.clone();
                            #[cfg(debug_assertions)]
                            println!("  ✓ 读取到 vendor (文本): {}", text);
                        }
                        "version" if version.is_empty() => {
                            version = text.clone();
                            #[cfg(debug_assertions)]
                            println!("  ✓ 读取到 version (文本): {}", text);
                        }
                        _ => {}
                    }
                }
                Ok(Event::End(_)) => {
                    current_tag.clear();
                }
                Ok(Event::Eof) => break,
                Err(_) => break,
                _ => {}
            }
            buf.clear();
        }
    }

    let pack_info = PackInfo {
        name: if name.is_empty() {
            "Unknown".to_string()
        } else {
            name
        },
        vendor: if vendor.is_empty() {
            "Unknown".to_string()
        } else {
            vendor
        },
        version: if version.is_empty() {
            "1.0.0".to_string()
        } else {
            version
        },
        description: description.clone(),
        device_count,
    };

    // 打印解析结果到终端（开发模式）
    #[cfg(debug_assertions)]
    {
        println!("\n========================================");
        println!("📦 PDSC 解析结果:");
        println!("========================================");
        println!("  名称:     {}", pack_info.name);
        println!("  厂商:     {}", pack_info.vendor);
        println!("  版本:     {}", pack_info.version);
        println!("  设备数:   {}", pack_info.device_count);
        println!("  描述:     {}", if description.is_empty() { "(空)" } else { &description });
        println!("========================================\n");
    }

    // 同时使用 log（用于日志文件）
    log::info!("📦 解析 PDSC 文件成功:");
    log::info!("  ├─ 名称: {}", pack_info.name);
    log::info!("  ├─ 厂商: {}", pack_info.vendor);
    log::info!("  ├─ 版本: {}", pack_info.version);
    log::info!("  ├─ 设备数: {}", pack_info.device_count);
    log::info!("  └─ 描述: {}", if description.is_empty() { "(空)" } else { &description });

    Ok(pack_info)
}
