# InkMark

InkMark 是一个面向 macOS 的轻量、本地优先 Markdown 编辑器。它直接读写普通
`.md` 文件，提供即时渲染、工作区文件树、多标签页、可靠的自动保存，以及可选的
DeepSeek 工作区知识助手。

## 技术架构

- **Tauri 2 + Rust**：窗口、系统对话框、目录读取和原子文件写入。
- **React 19 + TypeScript**：界面与工作区状态。
- **Vditor**：Typora 风格即时渲染、GFM、Mermaid 和 KaTeX。
- **Vite**：按需拆分编辑器代码和生产构建压缩。
- **GitHub Releases**：签名更新包、自动版本号和应用内零点击更新。
- **GitHub Markdown 主题**：正文、代码、引用与表格保持熟悉的 GitHub 排版。
- **DeepSeek V4**：围绕当前文稿或整个工作区对话，回答中可直接引用并打开来源文件。
- **AI 知识网络**：自动提取文档、人物、项目、主题及其关系，生成可交互知识图谱。
- **macOS 钥匙串**：DeepSeek API Key 不进入前端持久化、文稿、日志或 Git 仓库。

高频输入内容保留在编辑器和 `ref` 中，避免每次按键重绘文件树；目录按展开动作
懒加载，重型编辑器只在真正打开文稿后下载和初始化。

工具栏的“导出 PDF”会生成独立的 GitHub 风格打印稿，再交给 macOS 原生打印面板
保存为 PDF；应用侧栏、标签页和编辑标记不会进入文档。

界面固定使用纯白主题。DeepSeek 面板按需加载，普通写作时不会初始化 AI
组件；聊天使用流式响应并按动画帧批量更新，工作区上下文在 Rust 层递归构建。

## DeepSeek 助手

点击标题栏右侧的 AI 图标，或按 `⇧⌘I` 打开助手。首次使用时输入 DeepSeek API
Key，InkMark 会将它保存到 macOS 钥匙串并立即测试连接。

- 对话会读取当前未保存内容和工作区内可读的 UTF-8 文本。
- 每次回答要求使用 `[[相对路径]]` 标注文件依据，点击即可回到原文。
- 打开“知识网络”后，AI 会自动构建图谱；结果按工作区缓存在本机，可手动刷新。
- 隐藏目录、`node_modules`、`target`、`dist`、二进制文件和构建产物不会发送。
- 为控制延迟和费用，单次上下文限制为 800 个文本文件、约 2.4 MB；超限文件会均匀
  截取，并在面板显示实际读取数量和大小。

DeepSeek 是可选云端功能。只有在提问、测试连接或构建知识网络时，相关文本才会发送
到 `https://api.deepseek.com`；本地编辑、保存和 PDF 导出不依赖网络。

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
