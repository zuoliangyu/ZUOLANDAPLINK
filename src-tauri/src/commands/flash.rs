use crate::error::{AppError, AppResult};
use crate::state::AppState;
use probe_rs::flashing::{download_file_with_options, erase_all, FlashProgress, ProgressEvent, Format, DownloadOptions, BinOptions};
use probe_rs::MemoryInterface;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State, Window};

/// 进度跟踪状态
#[derive(Debug)]
struct ProgressState {
    erase_total: u64,
    erase_current: u64,
    program_total: u64,
    program_current: u64,
}

impl ProgressState {
    fn new() -> Self {
        Self {
            erase_total: 0,
            erase_current: 0,
            program_total: 0,
            program_current: 0,
        }
    }

    /// 计算总体进度 (0.0 - 1.0)
    /// 擦除: 0-30%, 编程: 30-95%, 完成: 95-100%
    fn calculate_progress(&self) -> f32 {
        if self.program_total > 0 {
            // 编程阶段: 30% - 95%
            0.30 + (self.program_current as f32 / self.program_total as f32) * 0.65
        } else if self.erase_total > 0 {
            // 擦除阶段: 0% - 30%
            (self.erase_current as f32 / self.erase_total as f32) * 0.30
        } else {
            0.0
        }
    }
}


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

    // 创建并设置进度回调
    let progress_state = Arc::new(Mutex::new(ProgressState::new()));
    let window_clone = window.clone();
    let progress_state_clone = Arc::clone(&progress_state);

    let progress_callback = FlashProgress::new(move |event| {
        let mut state = progress_state_clone.lock().unwrap();

        let (phase, message) = match event {
            ProgressEvent::Initialized { .. } => {
                ("init".to_string(), "初始化Flash编程器".to_string())
            }
            ProgressEvent::StartedFilling => {
                ("fill".to_string(), "开始填充数据".to_string())
            }
            ProgressEvent::PageFilled { size, .. } => {
                ("fill".to_string(), format!("已填充 {} 字节", size))
            }
            ProgressEvent::FailedFilling => {
                ("fill".to_string(), "填充失败".to_string())
            }
            ProgressEvent::FinishedFilling => {
                ("fill".to_string(), "填充完成".to_string())
            }
            ProgressEvent::StartedErasing => {
                state.erase_current = 0;
                ("erase".to_string(), "开始擦除".to_string())
            }
            ProgressEvent::SectorErased { size, .. } => {
                state.erase_current += size as u64;
                state.erase_total = state.erase_current.max(state.erase_total);
                ("erase".to_string(), format!("已擦除 {} 字节", state.erase_current))
            }
            ProgressEvent::FailedErasing => {
                ("erase".to_string(), "擦除失败".to_string())
            }
            ProgressEvent::FinishedErasing => {
                ("erase".to_string(), "擦除完成".to_string())
            }
            ProgressEvent::StartedProgramming { length } => {
                state.program_total = length as u64;
                state.program_current = 0;
                ("program".to_string(), format!("开始编程 {} 字节", length))
            }
            ProgressEvent::PageProgrammed { size, .. } => {
                state.program_current += size as u64;
                ("program".to_string(), format!("已编程 {}/{} 字节", state.program_current, state.program_total))
            }
            ProgressEvent::FailedProgramming => {
                ("program".to_string(), "编程失败".to_string())
            }
            ProgressEvent::FinishedProgramming => {
                ("program".to_string(), "编程完成".to_string())
            }
            _ => return,
        };

        let progress = state.calculate_progress();

        let _ = window_clone.emit(
            "flash-progress",
            FlashProgressEvent {
                phase,
                progress,
                message,
            },
        );
    });

    download_options.progress = Some(progress_callback);

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
