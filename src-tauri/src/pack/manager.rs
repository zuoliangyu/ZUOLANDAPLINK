use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use zip::ZipArchive;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackInfo {
    pub name: String,
    pub vendor: String,
    pub version: String,
    pub description: String,
    pub device_count: usize,
}

pub struct PackManager {
    packs_dir: PathBuf,
}

impl PackManager {
    pub fn new() -> AppResult<Self> {
        // 使用可执行文件同级的 data/packs 目录
        let packs_dir = if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                exe_dir.join("data").join("packs")
            } else {
                PathBuf::from("./data/packs")
            }
        } else {
            PathBuf::from("./data/packs")
        };

        // 确保目录存在
        fs::create_dir_all(&packs_dir)?;

        Ok(Self { packs_dir })
    }

    pub fn import_pack(&self, pack_path: &Path) -> AppResult<PackInfo> {
        log::info!("🔄 开始导入 Pack: {:?}", pack_path);

        let file = fs::File::open(pack_path)?;
        let mut archive = ZipArchive::new(file)
            .map_err(|e| AppError::PackError(format!("无法打开Pack文件: {}", e)))?;

        // 查找.pdsc文件
        let mut pdsc_content = String::new();

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| AppError::PackError(e.to_string()))?;

            if file.name().ends_with(".pdsc") {
                log::info!("📄 找到 PDSC 文件: {}", file.name());
                std::io::Read::read_to_string(&mut file, &mut pdsc_content)?;
                break;
            }
        }

        if pdsc_content.is_empty() {
            return Err(AppError::PackError("Pack文件中未找到.pdsc文件".to_string()));
        }

        // 解析.pdsc获取基本信息
        log::info!("🔍 开始解析 PDSC 文件...");
        let pack_info = super::parser::parse_pdsc(&pdsc_content)?;

        // 创建Pack目录
        let pack_dir = self.packs_dir.join(&pack_info.name);
        log::info!("📁 创建 Pack 目录: {:?}", pack_dir);
        fs::create_dir_all(&pack_dir)?;

        // 解压Pack
        log::info!("📦 开始解压 Pack 文件...");
        let file = fs::File::open(pack_path)?;
        let mut archive = ZipArchive::new(file)
            .map_err(|e| AppError::PackError(format!("无法打开Pack文件: {}", e)))?;

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| AppError::PackError(e.to_string()))?;

            let outpath = pack_dir.join(file.name());

            if file.name().ends_with('/') {
                fs::create_dir_all(&outpath)?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p)?;
                    }
                }
                let mut outfile = fs::File::create(&outpath)?;
                std::io::copy(&mut file, &mut outfile)?;
            }
        }

        log::info!("✅ Pack 导入成功!");
        Ok(pack_info)
    }

    pub fn list_packs(&self) -> AppResult<Vec<PackInfo>> {
        log::info!("📋 开始列出已导入的 Pack...");
        let mut packs = Vec::new();

        if !self.packs_dir.exists() {
            log::warn!("⚠️  Pack 目录不存在: {:?}", self.packs_dir);
            return Ok(packs);
        }

        for entry in fs::read_dir(&self.packs_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                log::debug!("🔍 扫描目录: {:?}", path);
                // 查找.pdsc文件
                for pdsc_entry in fs::read_dir(&path)? {
                    let pdsc_entry = pdsc_entry?;
                    let pdsc_path = pdsc_entry.path();

                    if pdsc_path.extension().map_or(false, |ext| ext == "pdsc") {
                        log::info!("📄 找到 PDSC 文件: {:?}", pdsc_path);
                        let content = fs::read_to_string(&pdsc_path)?;
                        if let Ok(info) = super::parser::parse_pdsc(&content) {
                            packs.push(info);
                        }
                        break;
                    }
                }
            }
        }

        log::info!("✅ 共找到 {} 个 Pack", packs.len());
        Ok(packs)
    }

    pub fn get_pack_dir(&self, pack_name: &str) -> PathBuf {
        self.packs_dir.join(pack_name)
    }

    pub fn delete_pack(&self, pack_name: &str) -> AppResult<()> {
        let pack_dir = self.get_pack_dir(pack_name);

        if !pack_dir.exists() {
            return Err(AppError::PackError(format!("Pack不存在: {}", pack_name)));
        }

        fs::remove_dir_all(&pack_dir)
            .map_err(|e| AppError::PackError(format!("删除Pack失败: {}", e)))?;

        Ok(())
    }
}
