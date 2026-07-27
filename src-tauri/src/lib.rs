mod ai;
#[cfg(target_os = "android")]
mod android_fs;
mod filesystem;
mod printing;

#[tauri::command]
async fn print_document(webview: tauri::WebviewWindow) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || printing::print_document(&webview))
        .await
        .map_err(|error| format!("打印任务意外结束：{error}"))?
}

/// Android 没有可用的文件夹选择器，改用 SAF 授权一棵目录树。
/// 其他平台由 dialog 插件处理，这里只是占位以保持命令表一致。
#[cfg(target_os = "android")]
#[tauri::command]
async fn pick_android_workspace(
    app: tauri::AppHandle,
) -> Result<Option<android_fs::PickedWorkspace>, String> {
    android_fs::pick_workspace(app).await
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn pick_android_workspace() -> Result<Option<()>, String> {
    Err("当前平台请使用系统文件夹选择器。".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(ai::AiCancelRegistry::default())
        .invoke_handler(tauri::generate_handler![
            ai::build_knowledge_graph,
            ai::cancel_ai_chat,
            ai::chat_with_workspace,
            ai::delete_deepseek_api_key,
            ai::get_ai_configuration,
            ai::list_workspace_entries,
            ai::save_deepseek_api_key,
            ai::test_deepseek_connection,
            filesystem::create_document,
            filesystem::list_directory,
            filesystem::read_document,
            filesystem::write_document,
            pick_android_workspace,
            print_document
        ]);

    #[cfg(target_os = "android")]
    let builder = builder.plugin(tauri_plugin_android_fs::init());

    // updater 只在桌面端可用。
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .run(tauri::generate_context!())
        .expect("InkMark failed to start");
}
