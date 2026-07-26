use serde::Serialize;
use std::{
    fs,
    io::Write,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};
use tempfile::NamedTempFile;

const MAX_DOCUMENT_BYTES: u64 = 32 * 1024 * 1024;
const MARKDOWN_EXTENSIONS: &[&str] = &["md", "markdown", "mdown", "mkd", "txt"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub kind: EntryKind,
    pub modified_at_ms: Option<u128>,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    Directory,
    Document,
}

impl EntryKind {
    /// 目录排在文稿前面。仅 Android 的 SAF 列目录用到。
    #[cfg_attr(not(target_os = "android"), allow(dead_code))]
    pub fn sort_rank(&self) -> u8 {
        match self {
            Self::Directory => 0,
            Self::Document => 1,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveReceipt {
    bytes_written: usize,
    modified_at_ms: u128,
    path: String,
}

impl SaveReceipt {
    #[cfg_attr(not(target_os = "android"), allow(dead_code))]
    pub fn new(bytes_written: usize, modified_at_ms: u128, path: String) -> Self {
        Self {
            bytes_written,
            modified_at_ms,
            path,
        }
    }
}

fn user_facing_error(operation: &str, path: &Path, error: impl std::fmt::Display) -> String {
    format!("{operation}失败：{}（{error}）", path.display())
}

fn system_time_ms(time: SystemTime) -> Option<u128> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis())
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

fn is_markdown_document(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            MARKDOWN_EXTENSIONS
                .iter()
                .any(|allowed| extension.eq_ignore_ascii_case(allowed))
        })
}

fn ensure_markdown_document(path: &Path) -> Result<(), String> {
    if is_markdown_document(path) {
        Ok(())
    } else {
        Err(format!(
            "不支持的文件类型：{}。InkMark 仅处理 Markdown 和纯文本文件。",
            path.display()
        ))
    }
}

fn read_directory_entries(path: &Path) -> Result<Vec<DirectoryEntry>, String> {
    if !path.is_dir() {
        return Err(format!("目录不存在：{}", path.display()));
    }

    let iterator =
        fs::read_dir(path).map_err(|error| user_facing_error("读取目录", path, error))?;
    let mut entries = Vec::new();

    for item in iterator {
        let item = item.map_err(|error| user_facing_error("读取目录项", path, error))?;
        let item_path = item.path();
        let file_name = item.file_name().to_string_lossy().into_owned();

        if is_hidden(&file_name) {
            continue;
        }

        let file_type = item
            .file_type()
            .map_err(|error| user_facing_error("读取文件类型", &item_path, error))?;
        let is_directory = file_type.is_dir();
        if !is_directory && !is_markdown_document(&item_path) {
            continue;
        }

        let metadata = item.metadata().ok();
        entries.push(DirectoryEntry {
            name: file_name,
            path: item_path.to_string_lossy().into_owned(),
            kind: if is_directory {
                EntryKind::Directory
            } else {
                EntryKind::Document
            },
            modified_at_ms: metadata
                .as_ref()
                .and_then(|value| value.modified().ok())
                .and_then(system_time_ms),
            size_bytes: metadata
                .as_ref()
                .filter(|_| !is_directory)
                .map(fs::Metadata::len),
        });
    }

    entries.sort_unstable_by(|left, right| {
        let left_rank = matches!(left.kind, EntryKind::Document);
        let right_rank = matches!(right.kind, EntryKind::Document);
        left_rank
            .cmp(&right_rank)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });

    Ok(entries)
}

fn read_document_contents(path: &Path) -> Result<String, String> {
    ensure_markdown_document(path)?;
    let metadata =
        fs::metadata(path).map_err(|error| user_facing_error("读取文稿信息", path, error))?;

    if metadata.len() > MAX_DOCUMENT_BYTES {
        return Err(format!(
            "文稿过大（{:.1} MB），当前安全上限为 32 MB。",
            metadata.len() as f64 / 1024.0 / 1024.0
        ));
    }

    fs::read_to_string(path).map_err(|error| user_facing_error("读取文稿", path, error))
}

fn persist_temp_file(temp_file: NamedTempFile, path: &Path) -> Result<(), String> {
    temp_file
        .persist(path)
        .map(|_| ())
        .map_err(|error| user_facing_error("替换文稿", path, error.error))
}

fn write_document_contents(path: &Path, contents: &str) -> Result<SaveReceipt, String> {
    ensure_markdown_document(path)?;
    let parent = path
        .parent()
        .filter(|candidate| !candidate.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));

    fs::create_dir_all(parent).map_err(|error| user_facing_error("创建文稿目录", parent, error))?;

    let mut temp_file = NamedTempFile::new_in(parent)
        .map_err(|error| user_facing_error("创建临时文稿", parent, error))?;
    temp_file
        .write_all(contents.as_bytes())
        .and_then(|()| temp_file.as_file().sync_all())
        .map_err(|error| user_facing_error("写入文稿", path, error))?;
    persist_temp_file(temp_file, path)?;

    let modified_at_ms = fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(system_time_ms)
        .unwrap_or_else(|| system_time_ms(SystemTime::now()).unwrap_or_default());

    Ok(SaveReceipt {
        bytes_written: contents.len(),
        modified_at_ms,
        path: path.to_string_lossy().into_owned(),
    })
}

// Android 走 SAF content URI，其余平台按绝对路径走 std::fs。
#[cfg(not(target_os = "android"))]
#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<DirectoryEntry>, String> {
    read_directory_entries(Path::new(&path))
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub async fn read_document(path: String) -> Result<String, String> {
    read_document_contents(Path::new(&path))
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub async fn write_document(path: String, contents: String) -> Result<SaveReceipt, String> {
    write_document_contents(Path::new(&path), &contents)
}

#[cfg(target_os = "android")]
#[tauri::command]
pub async fn list_directory(
    app: tauri::AppHandle,
    path: String,
) -> Result<Vec<DirectoryEntry>, String> {
    crate::android_fs::list_directory(app, path).await
}

#[cfg(target_os = "android")]
#[tauri::command]
pub async fn read_document(app: tauri::AppHandle, path: String) -> Result<String, String> {
    crate::android_fs::read_document(app, path).await
}

#[cfg(target_os = "android")]
#[tauri::command]
pub async fn write_document(
    app: tauri::AppHandle,
    path: String,
    contents: String,
) -> Result<SaveReceipt, String> {
    crate::android_fs::write_document(app, path, contents).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs::File, io, path::PathBuf};

    fn create_file(path: PathBuf, contents: &str) -> io::Result<()> {
        let mut file = File::create(path)?;
        file.write_all(contents.as_bytes())
    }

    #[test]
    fn filters_hidden_and_non_markdown_entries_and_sorts_directories_first() {
        let directory = tempfile::tempdir().expect("temp directory");
        fs::create_dir(directory.path().join("Chapter")).expect("create directory");
        create_file(directory.path().join("b.md"), "B").expect("create markdown");
        create_file(directory.path().join("A.md"), "A").expect("create markdown");
        create_file(directory.path().join("image.png"), "not an image").expect("create image");
        create_file(directory.path().join(".hidden.md"), "hidden").expect("create hidden file");

        let entries = read_directory_entries(directory.path()).expect("list entries");
        let names: Vec<_> = entries.iter().map(|entry| entry.name.as_str()).collect();

        assert_eq!(names, vec!["Chapter", "A.md", "b.md"]);
    }

    #[test]
    fn writes_and_reads_utf8_markdown_atomically() {
        let directory = tempfile::tempdir().expect("temp directory");
        let path = directory.path().join("测试.md");

        let receipt = write_document_contents(&path, "# 你好\nInkMark").expect("write document");
        write_document_contents(&path, "# 已更新\nInkMark").expect("replace document");
        let contents = read_document_contents(&path).expect("read document");

        assert_eq!(contents, "# 已更新\nInkMark");
        assert_eq!(receipt.bytes_written, "# 你好\nInkMark".len());
    }

    #[test]
    fn rejects_non_markdown_files() {
        let directory = tempfile::tempdir().expect("temp directory");
        let path = directory.path().join("notes.json");

        let error = write_document_contents(&path, "{}").expect_err("reject JSON");
        assert!(error.contains("不支持的文件类型"));
    }
}
