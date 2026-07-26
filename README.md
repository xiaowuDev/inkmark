# InkMark

InkMark 是一个面向 macOS 的轻量、本地优先 Markdown 编辑器。它直接读写普通
`.md` 文件，提供即时渲染、工作区文件树、多标签页和可靠的自动保存。

## 技术架构

- **Tauri 2 + Rust**：窗口、系统对话框、目录读取和原子文件写入。
- **React 19 + TypeScript**：界面与工作区状态。
- **Vditor**：Typora 风格即时渲染、GFM、Mermaid 和 KaTeX。
- **Vite**：按需拆分编辑器代码和生产构建压缩。
- **GitHub Releases**：签名更新包、自动版本号和应用内零点击更新。
- **GitHub Markdown 主题**：正文、代码、引用与表格保持熟悉的 GitHub 排版。

高频输入内容保留在编辑器和 `ref` 中，避免每次按键重绘文件树；目录按展开动作
懒加载，重型编辑器只在真正打开文稿后下载和初始化。

工具栏的“导出 PDF”会生成独立的 GitHub 风格打印稿，再交给 macOS 原生打印面板
保存为 PDF；应用侧栏、标签页和编辑标记不会进入文档。

## 开发

```bash
pnpm install
pnpm tauri dev
```

## 质量门

```bash
pnpm check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

## 构建 macOS 应用

```bash
pnpm tauri:build
```

产物位于 `src-tauri/target/release/bundle/`。

## 自动发布与更新

每次推送到 `main`，GitHub Actions 都会先执行前端与 Rust 全量质量门，再分配下一个
`0.1.x` 版本、构建 Apple Silicon 安装包、签名更新归档并发布 GitHub Release。

正式安装的 InkMark 会在启动后检查 `latest.json`。如果还没有打开文稿，它会自动
下载、验签、安装并重启；如果用户已经开始工作，则将更新推迟到下次启动，避免打断
编辑。

更新私钥不存放在仓库中，只保存在仓库的 `TAURI_SIGNING_PRIVATE_KEY` Actions
Secret 与维护者的安全备份中。
