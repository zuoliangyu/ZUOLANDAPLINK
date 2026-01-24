# 更新功能使用说明

## 当前状态

✅ 更新功能已完全集成到应用中
⚠️ 需要在GitHub Releases中配置才能正常工作

## 为什么显示"检查更新失败"?

这是正常的!因为GitHub Releases中还没有 `latest.json` 文件。

应用启动时会**静默检查更新**(不显示错误),只有手动点击"检查更新"按钮时才会显示错误信息。

## 如何启用更新功能?

### 方法1: 发布正式版本(推荐)

1. **准备发布**
   ```bash
   # 更新版本号(5个文件)
   # - package.json
   # - src-tauri/Cargo.toml
   # - src-tauri/tauri.conf.json
   # - README.md
   # - CHANGELOG.md

   # 构建应用
   npm run tauri build
   ```

2. **创建 latest.json**

   基于 `.github/latest.json.template` 创建文件:
   ```json
   {
     "version": "v0.5.0",
     "notes": "更新内容:\n- 修复 CMSIS Pack 解析bug\n- 添加 Pack 扫描进度反馈\n- 添加应用自动更新功能",
     "pub_date": "2026-01-24T12:00:00Z",
     "platforms": {
       "windows-x86_64": {
         "signature": "",
         "url": "https://github.com/zuoliangyu/ZUOLANDAPLINK/releases/download/v0.5.0/ZUOLAN.DAPLINK_0.5.0_x64_en-US.msi.zip"
       }
     }
   }
   ```

3. **发布到GitHub**
   - 创建新的Release (标签: v0.5.0)
   - 上传构建的安装包(.msi.zip)
   - 上传 `latest.json` 文件
   - 发布Release

### 方法2: 暂时禁用自动检查

如果暂时不需要更新功能,可以注释掉自动检查:

在 `src/components/UpdateChecker.tsx` 中:
```typescript
// 启动时自动检查更新(静默模式)
useEffect(() => {
  // checkForUpdates(true);  // 注释掉这行
}, []);
```

用户仍然可以手动点击"检查更新"按钮。

## 更新流程

```
用户启动应用
    ↓
静默检查更新(不显示错误)
    ↓
如果有新版本 → 显示更新对话框
    ↓
用户点击"立即更新"
    ↓
下载 → 安装 → 自动重启
```

## 测试更新功能

1. 在GitHub Releases中创建一个测试版本
2. 上传 latest.json 和安装包
3. 修改 latest.json 中的版本号为更高版本(如 v0.5.1)
4. 运行应用,应该会检测到更新

## 注意事项

- ✅ 启动时的检查是静默的,不会打扰用户
- ✅ 手动检查会显示详细的错误信息
- ✅ 只有发现新版本时才会弹出对话框
- ⚠️ 确保 latest.json 中的下载URL正确
- ⚠️ 安装包必须是压缩格式(.zip, .tar.gz)

## 相关文档

详细的发布流程请参考: `docs/UPDATE_GUIDE.md`
