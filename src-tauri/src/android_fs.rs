//! Android 的 SAF 文件访问。
//!
//! Android 的沙箱不允许用绝对路径遍历用户目录，用户通过系统的
//! `ACTION_OPEN_DOCUMENT_TREE` 授权一棵目录树，之后所有读写都走 content URI。
//! 对前端来说 `path` 依旧是一个不透明字符串，只不过在这里它是 `FsUri` 的 JSON。

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_android_fs::{AndroidFsExt, Entry, FsUri};

use crate::filesystem::{DirectoryEntry, EntryKind, SaveReceipt};

const MAX_DOCUMENT_BYTES: u64 = 32 * 1024 * 1024;
const MARKDOWN_EXTENSIONS: &[&str] = &["md", "markdown", "mdown", "mkd", "txt"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedWorkspace {
    root_path: String,
    root_name: String,
}

fn parse_uri(path: &str) -> Result<FsUri, String> {
    FsUri::from_json_str(path).map_err(|error| format!("无法识别的文件位置：{error}"))
}

fn encode_uri(uri: &FsUri) -> Result<String, String> {
    uri.to_json_string()
        .map_err(|error| format!("无法序列化文件位置：{error}"))
}

fn has_markdown_extension(name: &str) -> bool {
    name.rsplit_once('.').is_some_and(|(_, extension)| {
        MARKDOWN_EXTENSIONS
            .iter()
            .any(|allowed| extension.eq_ignore_ascii_case(allowed))
    })
}

fn millis_since_epoch(time: std::time::SystemTime) -> Option<u128> {
    time.duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis())
}

/// 让用户授权一棵目录树，并持久化权限，重启后仍可访问。
pub async fn pick_workspace(app: AppHandle) -> Result<Option<PickedWorkspace>, String> {
    let picker = app.android_fs_async().picker();
    let Some(uri) = picker
        .pick_dir(None, false)
        .await
        .map_err(|error| format!("打开文件夹选择器失败：{error}"))?
    else {
        return Ok(None);
    };

    picker
        .persist_uri_permission(&uri)
        .await
        .map_err(|error| format!("无法保留该文件夹的访问权限：{error}"))?;

    let root_name = app
        .android_fs_async()
        .get_name(&uri)
        .await
        .unwrap_or_else(|_| "工作区".to_string());

    Ok(Some(PickedWorkspace {
        root_path: encode_uri(&uri)?,
        root_name,
    }))
}

pub async fn list_directory(app: AppHandle, path: String) -> Result<Vec<DirectoryEntry>, String> {
    let uri = parse_uri(&path)?;
    let entries = app
        .android_fs_async()
        .read_dir(&uri)
        .await
        .map_err(|error| format!("读取目录失败：{error}"))?;

    let mut listed = Vec::with_capacity(entries.len());
    for entry in entries {
        let listed_entry = match entry {
            Entry::Dir {
                uri,
                name,
                last_modified,
                ..
            } => DirectoryEntry {
                name,
                path: encode_uri(&uri)?,
                kind: EntryKind::Directory,
                modified_at_ms: millis_since_epoch(last_modified),
                size_bytes: None,
            },
            Entry::File {
                uri,
                name,
                last_modified,
                len,
                ..
            } => {
                if !has_markdown_extension(&name) {
                    continue;
                }
                DirectoryEntry {
                    name,
                    path: encode_uri(&uri)?,
                    kind: EntryKind::Document,
                    modified_at_ms: millis_since_epoch(last_modified),
                    size_bytes: Some(len),
                }
            }
            _ => continue,
        };
        listed.push(listed_entry);
    }

    listed.sort_by(|left, right| {
        left.kind
            .sort_rank()
            .cmp(&right.kind.sort_rank())
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    Ok(listed)
}

pub async fn read_document(app: AppHandle, path: String) -> Result<String, String> {
    let uri = parse_uri(&path)?;
    let android_fs = app.android_fs_async();

    if let Ok(size) = android_fs.get_len(&uri).await {
        if size > MAX_DOCUMENT_BYTES {
            return Err("文稿超过 32 MB，暂不支持打开。".to_string());
        }
    }

    android_fs
        .read_to_string(&uri)
        .await
        .map_err(|error| format!("读取文稿失败：{error}"))
}

pub async fn write_document(
    app: AppHandle,
    path: String,
    contents: String,
) -> Result<SaveReceipt, String> {
    let uri = parse_uri(&path)?;
    app.android_fs_async()
        .write(&uri, contents.as_bytes())
        .await
        .map_err(|error| format!("保存文稿失败：{error}"))?;

    Ok(SaveReceipt::new(
        contents.len(),
        millis_since_epoch(std::time::SystemTime::now()).unwrap_or_default(),
        path,
    ))
}
