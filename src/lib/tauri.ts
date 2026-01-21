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
  RegisterValue,
  FlashAlgorithmInfo,
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

export async function eraseChip(): Promise<void> {
  return await invoke("erase_chip");
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
export async function startRtt(): Promise<RttConfig> {
  return await invoke<RttConfig>("start_rtt");
}

export async function stopRtt(): Promise<void> {
  return await invoke("stop_rtt");
}

export async function readRtt(channel: number): Promise<number[]> {
  return await invoke<number[]>("read_rtt", { options: { channel } });
}

export async function writeRtt(channel: number, data: number[]): Promise<number> {
  return await invoke<number>("write_rtt", { options: { channel, data } });
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
