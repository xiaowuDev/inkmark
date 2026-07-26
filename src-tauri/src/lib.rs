mod filesystem;
mod printing;

#[tauri::command]
async fn print_document(webview: tauri::WebviewWindow) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || printing::print_document(&webview))
        .await
        .map_err(|error| format!("打印任务意外结束：{error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            filesystem::list_directory,
            filesystem::read_document,
            filesystem::write_document,
            print_document
        ])
        .run(tauri::generate_context!())
        .expect("InkMark failed to start");
}
