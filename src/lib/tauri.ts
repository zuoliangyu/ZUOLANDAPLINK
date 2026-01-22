import { invoke } from "@tauri-apps/api/core";
import type {
  ProbeInfo,
  ConnectOptions,
  TargetInfo,
  ConnectionStatus,
  ChipInfo,
  FlashOptions,
  PackInfo,
  ProjectConfig,
  RttConfig,
  RttStartOptions,
  RttStatusEvent,
  RegisterValue,
  FlashAlgorithmInfo,
  EraseMode,
} from "./types";

// 探针命令
export async function listProbes(): Promise<ProbeInfo[]> {
  return await invoke<ProbeInfo[]>("list_probes");
}

export async function connectTarget(options: ConnectOptions): Promise<TargetInfo> {
  return await invoke<TargetInfo>("connect_target", { options });
}

export async function disconnect(): Promise<void> {
  return await invoke("disconnect");
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  return await invoke<ConnectionStatus>("get_connection_status");
}

// Flash命令
export async function flashFirmware(options: FlashOptions): Promise<void> {
  return await invoke("flash_firmware", { options });
}

export async function eraseChip(eraseMode?: EraseMode): Promise<void> {
  return await invoke("erase_chip", { options: eraseMode ? { erase_mode: eraseMode } : null });
}

export async function eraseSector(address: number, size: number): Promise<void> {
  return await invoke("erase_sector", { options: { address, size } });
}

export async function verifyFirmware(filePath: string): Promise<boolean> {
  return await invoke<boolean>("verify_firmware", { filePath });
}

export async function readFlash(address: number, size: number): Promise<number[]> {
  return await invoke<number[]>("read_flash", { options: { address, size } });
}

// 内存命令
export async function readMemory(address: number, size: number): Promise<number[]> {
  return await invoke<number[]>("read_memory", { options: { address, size } });
}

export async function writeMemory(address: number, data: number[]): Promise<void> {
  return await invoke("write_memory", { options: { address, data } });
}

export async function readRegisters(): Promise<RegisterValue[]> {
  return await invoke<RegisterValue[]>("read_registers");
}

// RTT命令
export async function startRtt(options: RttStartOptions): Promise<RttConfig> {
  return await invoke<RttConfig>("start_rtt", { options });
}

export async function stopRtt(): Promise<void> {
  return await invoke("stop_rtt");
}

export async function writeRtt(channel: number, data: number[]): Promise<number> {
  return await invoke<number>("write_rtt", { channel, data });
}

export async function getRttStatus(): Promise<RttStatusEvent> {
  return await invoke<RttStatusEvent>("get_rtt_status");
}

export async function clearRttBuffer(): Promise<void> {
  return await invoke("clear_rtt_buffer");
}

// 配置命令
export async function getSupportedChips(): Promise<string[]> {
  return await invoke<string[]>("get_supported_chips");
}

export async function searchChips(query: string): Promise<string[]> {
  return await invoke<string[]>("search_chips", { query });
}

export async function getChipInfo(chipName: string): Promise<ChipInfo> {
  return await invoke<ChipInfo>("get_chip_info", { chipName });
}

export async function importPack(packPath: string): Promise<PackInfo> {
  return await invoke<PackInfo>("import_pack", { packPath });
}

export async function listImportedPacks(): Promise<PackInfo[]> {
  return await invoke<PackInfo[]>("list_imported_packs");
}

export async function getFlashAlgorithms(chipName: string): Promise<FlashAlgorithmInfo[]> {
  return await invoke<FlashAlgorithmInfo[]>("get_flash_algorithms", { chipName });
}

export async function saveProjectConfig(config: ProjectConfig, filePath: string): Promise<void> {
  return await invoke("save_project_config", { config, filePath });
}

export async function loadProjectConfig(filePath: string): Promise<ProjectConfig> {
  return await invoke<ProjectConfig>("load_project_config", { filePath });
}
