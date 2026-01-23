use crate::error::{AppError, AppResult};
use crate::state::AppState;
use probe_rs::flashing::{download_file_with_options, erase_all, FlashProgress, Format, DownloadOptions, BinOptions};
use probe_rs::MemoryInterface;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{Emitter, State, Window};

/// 擦除模式
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub enum EraseMode {
    #[default]
    ChipErase,    // 整片擦除
    SectorErase,  // 扇区擦除
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashOptions {
    pub file_path: String,
    pub verify: bool,
    pub skip_erase: bool,
    pub reset_after: bool,
    #[serde(default)]
    pub erase_mode: EraseMode,
    // 自定义烧录地址
    pub use_custom_address: Option<bool>,
    pub custom_flash_address: Option<u64>,
    pub custom_flash_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FlashProgressEvent {
    pub phase: String,
    pub progress: f32,
    pub message: String,
}

#[tauri::command]
pub async fn flash_firmware(
    options: FlashOptions,
    state: State<'_, AppState>,
    window: Window,
) -> AppResult<()> {
    let mut session_guard = state.session.lock();
    let session = session_guard
        .as_mut()
        .ok_or(AppError::NotConnected)?;

    let path = Path::new(&options.file_path);
    if !path.exists() {
        return Err(AppError::FileError("文件不存在".to_string()));
    }

    // 创建进度回调 (当前API版本不支持自定义进度回调)
    let window_clone = window.clone();
    let _progress_callback = FlashProgress::new(move |event| {
        let (phase, progress, message) = match event {
            probe_rs::flashing::ProgressEvent::Initialized { .. } => {
                ("init".to_string(), 0.0, "初始化Flash编程器".to_string())
            }
            probe_rs::flashing::ProgressEvent::StartedFilling => {
                ("fill".to_string(), 0.0, "开始填充数据".to_string())
            }
            probe_rs::flashing::ProgressEvent::PageFilled { size, .. } => {
                ("fill".to_string(), 0.5, format!("已填充 {} 字节", size))
            }
            probe_rs::flashing::ProgressEvent::FailedFilling => {
                ("fill".to_string(), 0.0, "填充失败".to_string())
            }
            probe_rs::flashing::ProgressEvent::FinishedFilling => {
                ("fill".to_string(), 1.0, "填充完成".to_string())
            }
            probe_rs::flashing::ProgressEvent::StartedErasing => {
                ("erase".to_string(), 0.0, "开始擦除".to_string())
            }
            probe_rs::flashing::ProgressEvent::SectorErased { size, .. } => {
                ("erase".to_string(), 0.5, format!("已擦除 {} 字节", size))
            }
            probe_rs::flashing::ProgressEvent::FailedErasing => {
                ("erase".to_string(), 0.0, "擦除失败".to_string())
            }
            probe_rs::flashing::ProgressEvent::FinishedErasing => {
                ("erase".to_string(), 1.0, "擦除完成".to_string())
            }
            probe_rs::flashing::ProgressEvent::StartedProgramming { length } => {
                ("program".to_string(), 0.0, format!("开始编程 {} 字节", length))
            }
            probe_rs::flashing::ProgressEvent::PageProgrammed { size, .. } => {
                ("program".to_string(), 0.5, format!("已编程 {} 字节", size))
            }
            probe_rs::flashing::ProgressEvent::FailedProgramming => {
                ("program".to_string(), 0.0, "编程失败".to_string())
            }
            probe_rs::flashing::ProgressEvent::FinishedProgramming => {
                ("program".to_string(), 1.0, "编程完成".to_string())
            }
            _ => ("unknown".to_string(), 0.0, "处理中".to_string()),
        };

        let _ = window_clone.emit(
            "flash-progress",
            FlashProgressEvent {
                phase,
                progress,
                message,
            },
        );
    });

    // 根据文件扩展名确定格式
    let format = match path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()).as_deref() {
        Some("hex") | Some("ihex") => Format::Hex,
        Some("bin") => {
            // BIN文件需要指定基地址
            let base_address = if options.use_custom_address.unwrap_or(false) {
                // 使用自定义地址
                options.custom_flash_address.unwrap_or(0x08000000)
            } else {
                // 自动从目标内存映射获取Flash起始地址
                session.target().memory_map.iter()
                    .find_map(|region| {
                        if let probe_rs::config::MemoryRegion::Nvm(r) = region {
                            Some(r.range.start)
                        } else {
                            None
                        }
                    })
                    .unwrap_or(0x08000000) // 默认STM32 Flash地址
            };
            Format::Bin(BinOptions { base_address: Some(base_address), skip: 0 })
        }
        _ => Format::Elf, // 默认尝试ELF格式
    };

    // 根据擦除模式配置下载选项
    let mut download_options = DownloadOptions::default();
    if options.skip_erase {
        download_options.skip_erase = true;
    } else {
        match options.erase_mode {
            EraseMode::ChipErase => {
                download_options.do_chip_erase = true;
            }
            EraseMode::SectorErase => {
                download_options.do_chip_erase = false;
                // probe-rs 默认使用扇区擦除
            }
        }
    }
    download_options.verify = options.verify;

    // 执行下载
    download_file_with_options(session, path, format, download_options)
        .map_err(|e| AppError::FlashError(e.to_string()))?;

    // 重置芯片
    if options.reset_after {
        let mut core = session.core(0).map_err(|e| AppError::FlashError(e.to_string()))?;
        core.reset().map_err(|e| AppError::FlashError(e.to_string()))?;
    }

    let _ = window.emit(
        "flash-progress",
        FlashProgressEvent {
            phase: "complete".to_string(),
            progress: 1.0,
            message: "烧录完成".to_string(),
        },
    );

    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct EraseChipOptions {
    #[serde(default)]
    pub erase_mode: EraseMode,
}

#[tauri::command]
pub async fn erase_chip(
    options: Option<EraseChipOptions>,
    state: State<'_, AppState>,
    window: Window,
) -> AppResult<()> {
    let mut session_guard = state.session.lock();
    let session = session_guard
        .as_mut()
        .ok_or(AppError::NotConnected)?;

    let erase_mode = options.map(|o| o.erase_mode).unwrap_or(EraseMode::ChipErase);

    match erase_mode {
        EraseMode::ChipErase => {
            let _ = window.emit(
                "flash-progress",
                FlashProgressEvent {
                    phase: "erase".to_string(),
                    progress: 0.0,
                    message: "开始全片擦除".to_string(),
                },
            );

            let progress = FlashProgress::new(|_| {});
            erase_all(session, progress).map_err(|e| AppError::FlashError(e.to_string()))?;

            let _ = window.emit(
                "flash-progress",
                FlashProgressEvent {
                    phase: "complete".to_string(),
                    progress: 1.0,
                    message: "全片擦除完成".to_string(),
                },
            );
        }
        EraseMode::SectorErase => {
            let _ = window.emit(
                "flash-progress",
                FlashProgressEvent {
                    phase: "erase".to_string(),
                    progress: 0.0,
                    message: "开始扇区擦除".to_string(),
                },
            );

            // 获取所有 Flash 区域并逐个扇区擦除
            let flash_regions: Vec<_> = session.target().memory_map.iter()
                .filter_map(|region| {
                    if let probe_rs::config::MemoryRegion::Nvm(r) = region {
                        Some((r.range.start, r.range.end - r.range.start))
                    } else {
                        None
                    }
                })
                .collect();

            for (address, size) in flash_regions {
                // 使用 FlashLoader 进行扇区擦除
                let mut loader = session.target().flash_loader();

                // 添加 0xFF 数据来触发扇区擦除
                let erase_data = vec![0xFFu8; size as usize];
                loader.add_data(address, &erase_data)
                    .map_err(|e| AppError::FlashError(e.to_string()))?;

                let mut download_options = DownloadOptions::default();
                download_options.do_chip_erase = false; // 使用扇区擦除
                download_options.skip_erase = false;

                loader.commit(session, download_options)
                    .map_err(|e| AppError::FlashError(e.to_string()))?;
            }

            let _ = window.emit(
                "flash-progress",
                FlashProgressEvent {
                    phase: "complete".to_string(),
                    progress: 1.0,
                    message: "扇区擦除完成".to_string(),
                },
            );
        }
    }

    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct EraseSectorOptions {
    pub address: u64,
    pub size: u64,
}

#[tauri::command]
pub async fn erase_sector(
    options: EraseSectorOptions,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let mut session_guard = state.session.lock();
    let session = session_guard
        .as_mut()
        .ok_or(AppError::NotConnected)?;

    // 使用 probe-rs 的扇区擦除功能
    let mut loader = session
        .target()
        .flash_loader();

    // 添加要擦除的区域
    loader.add_data(options.address, &vec![0xFF; options.size as usize])
        .map_err(|e| AppError::FlashError(e.to_string()))?;

    // 执行擦除
    loader.commit(session, DownloadOptions::default())
        .map_err(|e| AppError::FlashError(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub async fn verify_firmware(
    file_path: String,
    state: State<'_, AppState>,
    window: Window,
) -> AppResult<bool> {
    let mut session_guard = state.session.lock();
    let session = session_guard
        .as_mut()
        .ok_or(AppError::NotConnected)?;

    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(AppError::FileError("文件不存在".to_string()));
    }

    let _ = window.emit(
        "flash-progress",
        FlashProgressEvent {
            phase: "verify".to_string(),
            progress: 0.0,
            message: "开始校验".to_string(),
        },
    );

    // 读取文件并与Flash内容比较
    let file_data = std::fs::read(path)?;

    // 获取Flash起始地址（假设是主Flash区域）
    let target = session.target();
    let flash_start = target.memory_map.iter()
        .find_map(|region| {
            if let probe_rs::config::MemoryRegion::Nvm(r) = region {
                Some(r.range.start)
            } else {
                None
            }
        })
        .unwrap_or(0x08000000); // 默认STM32 Flash地址

    let mut core = session.core(0).map_err(|e| AppError::FlashError(e.to_string()))?;

    let mut flash_data = vec![0u8; file_data.len()];
    core.read(flash_start, &mut flash_data)
        .map_err(|e| AppError::FlashError(e.to_string()))?;

    let result = file_data == flash_data;

    if result {
        let _ = window.emit(
            "flash-progress",
            FlashProgressEvent {
                phase: "complete".to_string(),
                progress: 1.0,
                message: "校验通过".to_string(),
            },
        );
    } else {
        let _ = window.emit(
            "flash-progress",
            FlashProgressEvent {
                phase: "error".to_string(),
                progress: 0.0,
                message: "校验失败：内容不匹配".to_string(),
            },
        );
    }

    Ok(result)
}

#[derive(Debug, Deserialize)]
pub struct ReadFlashOptions {
    pub address: u64,
    pub size: u64,
}

#[tauri::command]
pub async fn read_flash(
    options: ReadFlashOptions,
    state: State<'_, AppState>,
) -> AppResult<Vec<u8>> {
    let mut session_guard = state.session.lock();
    let session = session_guard
        .as_mut()
        .ok_or(AppError::NotConnected)?;

    let mut core = session.core(0).map_err(|e| AppError::FlashError(e.to_string()))?;

    let mut data = vec![0u8; options.size as usize];
    core.read(options.address, &mut data)
        .map_err(|e| AppError::FlashError(e.to_string()))?;

    Ok(data)
}
