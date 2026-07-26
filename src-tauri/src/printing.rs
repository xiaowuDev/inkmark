#[cfg(target_os = "macos")]
mod macos {
    use objc2::{
        define_class, msg_send, rc::Retained, runtime::NSObject, sel, MainThreadMarker,
        MainThreadOnly,
    };
    use objc2_app_kit::{NSPrintInfo, NSPrintOperation, NSWindow};
    use objc2_foundation::NSObjectProtocol;
    use objc2_web_kit::WKWebView;
    use std::{
        ffi::c_void,
        sync::mpsc::{self, SyncSender},
    };

    define_class!(
        #[unsafe(super(NSObject))]
        #[name = "InkMarkPrintDelegate"]
        #[thread_kind = MainThreadOnly]
        #[ivars = ()]
        struct PrintDelegate;

        impl PrintDelegate {
            #[unsafe(method(printOperationDidRun:success:contextInfo:))]
            fn print_operation_did_run(
                &self,
                _operation: &NSPrintOperation,
                completed: bool,
                context: *mut c_void,
            ) {
                if context.is_null() {
                    return;
                }

                let context = unsafe { Box::from_raw(context.cast::<PrintContext>()) };
                let _ = context.sender.send(completed);
            }
        }

        unsafe impl NSObjectProtocol for PrintDelegate {}
    );

    struct PrintContext {
        sender: SyncSender<bool>,
        _delegate: Retained<PrintDelegate>,
    }

    impl PrintDelegate {
        fn new(marker: MainThreadMarker) -> Retained<Self> {
            let instance = marker.alloc().set_ivars(());
            unsafe { msg_send![super(instance), init] }
        }
    }

    pub fn run(webview: &tauri::WebviewWindow) -> Result<(), String> {
        let (sender, receiver) = mpsc::sync_channel(1);
        webview
            .with_webview(move |platform_webview| {
                let marker = MainThreadMarker::new()
                    .expect("Tauri runs webview callbacks on the main thread");
                let delegate = PrintDelegate::new(marker);
                let context = Box::new(PrintContext {
                    sender,
                    _delegate: delegate.clone(),
                });

                unsafe {
                    let native_webview: &WKWebView = &*platform_webview.inner().cast();
                    let native_window: &NSWindow = &*platform_webview.ns_window().cast();
                    let print_info = NSPrintInfo::sharedPrintInfo();
                    let print_operation = native_webview.printOperationWithPrintInfo(&print_info);
                    print_operation.setCanSpawnSeparateThread(true);

                    print_operation.runOperationModalForWindow_delegate_didRunSelector_contextInfo(
                        native_window,
                        Some(&delegate),
                        Some(sel!(printOperationDidRun:success:contextInfo:)),
                        Box::into_raw(context).cast(),
                    );
                }
            })
            .map_err(|error| format!("无法准备系统打印面板：{error}"))?;

        receiver
            .recv()
            .map(|_| ())
            .map_err(|error| format!("系统打印面板意外关闭：{error}"))
    }
}

#[cfg(target_os = "macos")]
pub fn print_document(webview: &tauri::WebviewWindow) -> Result<(), String> {
    macos::run(webview)
}

#[cfg(not(target_os = "macos"))]
pub fn print_document(webview: &tauri::WebviewWindow) -> Result<(), String> {
    webview
        .print()
        .map_err(|error| format!("无法打开系统打印面板：{error}"))
}
