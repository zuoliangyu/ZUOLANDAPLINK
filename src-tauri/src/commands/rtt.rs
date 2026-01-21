use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RttChannel {
    pub index: usize,
    pub name: String,
    pub buffer_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RttConfig {
    pub channels: Vec<RttChannel>,
}

#[tauri::command]
pub async fn start_rtt(state: State<'_, AppState>) -> AppResult<RttConfig> {
    let mut session_guard = state.session.lock();
    let session = session_guard
        .as_mut()
        .ok_or(AppError::NotConnected)?;

    let mut core = session.core(0).map_err(|e| AppError::RttError(e.to_string()))?;

    // 尝试附加RTT
    let rtt_scan_region = probe_rs::rtt::ScanRegion::Exact(0x20000000); // 默认从RAM开始搜索

    let mut rtt = probe_rs::rtt::Rtt::attach_region(&mut core, &rtt_scan_region)
        .map_err(|e| AppError::RttError(format!("无法附加RTT: {}", e)))?;

    // 获取通道信息
    let mut channels = Vec::new();

    for channel in rtt.up_channels().iter() {
        channels.push(RttChannel {
            index: channel.number(),
            name: channel.name().unwrap_or("").to_string(),
            buffer_size: channel.buffer_size(),
        });
    }

    // 设置RTT运行标志
    *state.rtt_running.lock() = true;

    Ok(RttConfig { channels })
}

#[tauri::command]
pub async fn stop_rtt(state: State<'_, AppState>) -> AppResult<()> {
    *state.rtt_running.lock() = false;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct ReadRttOptions {
    pub channel: usize,
}

#[tauri::command]
pub async fn read_rtt(
    options: ReadRttOptions,
    state: State<'_, AppState>,
) -> AppResult<Vec<u8>> {
    let mut session_guard = state.session.lock();
    let session = session_guard
        .as_mut()
        .ok_or(AppError::NotConnected)?;

    let mut core = session.core(0).map_err(|e| AppError::RttError(e.to_string()))?;

    // 重新附加RTT（probe-rs RTT需要每次重新获取）
    let rtt_scan_region = probe_rs::rtt::ScanRegion::Exact(0x20000000);

    let mut rtt = probe_rs::rtt::Rtt::attach_region(&mut core, &rtt_scan_region)
        .map_err(|e| AppError::RttError(format!("无法附加RTT: {}", e)))?;

    let mut buffer = vec![0u8; 1024];
    let channel = rtt
        .up_channels()
        .get_mut(options.channel)
        .ok_or_else(|| AppError::RttError("通道不存在".to_string()))?;

    let read_count = channel
        .read(&mut core, &mut buffer)
        .map_err(|e| AppError::RttError(e.to_string()))?;

    buffer.truncate(read_count);
    Ok(buffer)
}

#[derive(Debug, Deserialize)]
pub struct WriteRttOptions {
    pub channel: usize,
    pub data: Vec<u8>,
}

#[tauri::command]
pub async fn write_rtt(
    options: WriteRttOptions,
    state: State<'_, AppState>,
) -> AppResult<usize> {
    let mut session_guard = state.session.lock();
    let session = session_guard
        .as_mut()
        .ok_or(AppError::NotConnected)?;

    let mut core = session.core(0).map_err(|e| AppError::RttError(e.to_string()))?;

    // 重新附加RTT
    let rtt_scan_region = probe_rs::rtt::ScanRegion::Exact(0x20000000);

    let mut rtt = probe_rs::rtt::Rtt::attach_region(&mut core, &rtt_scan_region)
        .map_err(|e| AppError::RttError(format!("无法附加RTT: {}", e)))?;

    let channel = rtt
        .down_channels()
        .get_mut(options.channel)
        .ok_or_else(|| AppError::RttError("通道不存在".to_string()))?;

    let written = channel
        .write(&mut core, &options.data)
        .map_err(|e| AppError::RttError(e.to_string()))?;

    Ok(written)
}
