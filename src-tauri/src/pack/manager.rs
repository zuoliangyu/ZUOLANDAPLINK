use crate::error::{AppError, AppResult};
use directories::ProjectDirs;
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
        let packs_dir = if let Some(proj_dirs) = ProjectDirs::from("com", "zuolan", "daplink") {
            proj_dirs.data_dir().join("packs")
        } else {
            PathBuf::from("./packs")
        };

        // 确保目录存在
        fs::create_dir_all(&packs_dir)?;

        Ok(Self { packs_dir })
    }

    pub fn import_pack(&self, pack_path: &Path) -> AppResult<PackInfo> {
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
                std::io::Read::read_to_string(&mut file, &mut pdsc_content)?;
                break;
            }
        }

        if pdsc_content.is_empty() {
            return Err(AppError::PackError("Pack文件中未找到.pdsc文件".to_string()));
        }

        // 解析.pdsc获取基本信息
        let pack_info = super::parser::parse_pdsc(&pdsc_content)?;

        // 创建Pack目录
        let pack_dir = self.packs_dir.join(&pack_info.name);
        fs::create_dir_all(&pack_dir)?;

        // 解压Pack
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

        Ok(pack_info)
    }

    pub fn list_packs(&self) -> AppResult<Vec<PackInfo>> {
        let mut packs = Vec::new();

        if !self.packs_dir.exists() {
            return Ok(packs);
        }

        for entry in fs::read_dir(&self.packs_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                // 查找.pdsc文件
                for pdsc_entry in fs::read_dir(&path)? {
                    let pdsc_entry = pdsc_entry?;
                    let pdsc_path = pdsc_entry.path();

                    if pdsc_path.extension().map_or(false, |ext| ext == "pdsc") {
                        let content = fs::read_to_string(&pdsc_path)?;
                        if let Ok(info) = super::parser::parse_pdsc(&content) {
                            packs.push(info);
                        }
                        break;
                    }
                }
            }
        }

        Ok(packs)
    }

    pub fn get_pack_dir(&self, pack_name: &str) -> PathBuf {
        self.packs_dir.join(pack_name)
    }
}
