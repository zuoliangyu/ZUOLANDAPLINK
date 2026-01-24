pub mod commands;
pub mod error;
pub mod pack;
pub mod state;

use commands::{config, flash, memory, probe, rtt};
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            app.manage(AppState::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 探针命令
            probe::list_probes,
            probe::connect_target,
            probe::disconnect,
            probe::get_connection_status,
            // RTT 独立连接命令
            probe::connect_rtt,
            probe::disconnect_rtt,
            probe::get_rtt_connection_status,
            // Flash命令
            flash::flash_firmware,
            flash::erase_chip,
            flash::erase_sector,
            flash::verify_firmware,
            flash::read_flash,
            // 内存命令
            memory::read_memory,
            memory::write_memory,
            memory::read_registers,
            // RTT命令
            rtt::start_rtt,
            rtt::stop_rtt,
            rtt::write_rtt,
            rtt::get_rtt_status,
            rtt::clear_rtt_buffer,
            // 配置命令
            config::get_supported_chips,
            config::search_chips,
            config::get_chip_info,
            config::init_packs,
            config::import_pack,
            config::list_imported_packs,
            config::delete_pack,
            config::get_flash_algorithms,
            config::save_project_config,
            config::load_project_config,
            config::get_pack_scan_report,
            config::get_devices_without_algorithm,
            // Pack版本管理命令
            config::check_outdated_packs,
            config::rescan_pack,
            config::rescan_all_outdated_packs,
        ])
        .run(tauri::generate_context!())
        .expect("启动应用程序时出错");
}
