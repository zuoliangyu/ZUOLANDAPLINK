import { create } from "zustand";
import type { ChipInfo, MemoryRegionInfo, FlashAlgorithmInfo } from "@/lib/types";

interface ChipState {
  // 状态
  chips: string[];
  searchResults: string[];
  selectedChip: string | null;
  chipInfo: ChipInfo | null;
  memoryRegions: MemoryRegionInfo[];
  flashAlgorithms: FlashAlgorithmInfo[];
  selectedFlashAlgorithm: string | null; // 选中的烧录算法名称
  loading: boolean;
  searchQuery: string;

  // 操作
  setChips: (chips: string[]) => void;
  setSearchResults: (results: string[]) => void;
  selectChip: (chip: string | null) => void;
  setChipInfo: (info: ChipInfo | null) => void;
  setMemoryRegions: (regions: MemoryRegionInfo[]) => void;
  setFlashAlgorithms: (algorithms: FlashAlgorithmInfo[]) => void;
  selectFlashAlgorithm: (algorithmName: string | null) => void;
  setLoading: (loading: boolean) => void;
  setSearchQuery: (query: string) => void;
  reset: () => void;
}

export const useChipStore = create<ChipState>((set) => ({
  chips: [],
  searchResults: [],
  selectedChip: null,
  chipInfo: null,
  memoryRegions: [],
  flashAlgorithms: [],
  selectedFlashAlgorithm: null,
  loading: false,
  searchQuery: "",

  setChips: (chips) => set({ chips }),

  setSearchResults: (searchResults) => set({ searchResults }),

  selectChip: (chip) => set({ selectedChip: chip }),

  setChipInfo: (chipInfo) => {
    // 自动选择默认算法
    const defaultAlgo = chipInfo?.flash_algorithms.find((a) => a.default);
    const selectedAlgo = defaultAlgo?.name || chipInfo?.flash_algorithms[0]?.name || null;

    set({
      chipInfo,
      memoryRegions: chipInfo?.memory_regions || [],
      flashAlgorithms: chipInfo?.flash_algorithms || [],
      selectedFlashAlgorithm: selectedAlgo,
    });
  },

  setMemoryRegions: (memoryRegions) => set({ memoryRegions }),

  setFlashAlgorithms: (flashAlgorithms) => set({ flashAlgorithms }),

  selectFlashAlgorithm: (algorithmName) => set({ selectedFlashAlgorithm: algorithmName }),

  setLoading: (loading) => set({ loading }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  reset: () =>
    set({
      searchResults: [],
      selectedChip: null,
      chipInfo: null,
      memoryRegions: [],
      flashAlgorithms: [],
      selectedFlashAlgorithm: null,
      searchQuery: "",
    }),
}));
