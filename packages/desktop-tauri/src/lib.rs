//! numas-desktop: Tauri shell wrapping the numas CLI sidecar and the codeblitz web UI.
//!
//! Two modes:
//!  - Default (frontend): open window, ensure sidecar `numas serve` is healthy on localhost:4096,
//!    navigate the window to http://localhost:4096.
//!  - Background (tray-only): no window, sidecar keeps running.
//!
//! Deep link scheme `numas://` brings the window forward (single-instance).
//! Sidecar binary lives at <bundle>/numas-<target-triple>, configured in tauri.conf.json.

use std::io::Write;
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Listener, Manager, RunEvent, WindowEvent,
};
use tauri_plugin_deep_link::DeepLinkExt;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

const PORT: u16 = 4096;
const HEALTH_URL: &str = "http://127.0.0.1:4096/health";
const FRONTEND_URL: &str = "http://localhost:4096/";

#[derive(Clone, Serialize)]
struct SidecarStatus {
    state: bool
}

struct SidecarState(Mutex<Option<Child>>);

#[tokio::main]
pub async fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .manage(SidecarState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![show_window, hide_window, sidecar_status, stop_sidecar])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                eprintln!("[numas] window CloseRequested, hiding");
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .setup(|app| {
            // Register scheme handler at runtime (macOS / Linux dev mode).
            #[cfg(any(target_os = "linux", all(debug_assertions, target_os = "macos")))]
            {
                if let Err(e) = app.deep_link().register("numas") {
                    eprintln!("[numas] failed to register scheme: {e}");
                }
            }

            // Probe listener removed (using document.title for state inspection instead)
            let _ = app;

            // Tray menu
            let show_i = MenuItem::with_id(app, "show", "前台模式", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "后台模式", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(Image::from_bytes(include_bytes!("../icons/icon.png"))?)
                .icon_as_template(true)
                .tooltip("numas")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Deep link event: bring window to front, ensure sidecar is up.
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let urls: Vec<String> = event.urls().iter().map(|u| u.to_string()).collect();
                eprintln!("[numas] deep link opened: {urls:?}");
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                let h2 = handle.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = ensure_sidecar(&h2).await {
                        eprintln!("[numas] sidecar failed: {e}");
                    }
                    if let Some(window) = h2.get_webview_window("main") {
                        let _ = window.navigate(FRONTEND_URL.parse().unwrap());
                        let _ = window.show();
                    }
                });
            });

            // Single instance: focus window if another instance is launched.
            // (tauri-plugin-single-instance if needed; omitted for simplicity in this scaffold)

            // Decide initial mode: window visible if --foreground flag present (default true).
            let foreground = std::env::args().any(|a| a == "--foreground" || a == "--fg");
            eprintln!("[numas] launched, foreground={foreground}, args={:?}", std::env::args().collect::<Vec<_>>());
            if foreground {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    eprintln!("[numas] ensure_sidecar starting...");
                    match ensure_sidecar(&handle).await {
                        Ok(()) => eprintln!("[numas] sidecar ready, navigating to {FRONTEND_URL}"),
                        Err(e) => {
                            eprintln!("[numas] sidecar failed: {e}");
                            if let Some(window) = handle.get_webview_window("main") {
                                let _ = window.eval(&format!(
                                    "document.getElementById('hint').textContent = 'sidecar 启动失败: {e}';"
                                ));
                            }
                            return;
                        }
                    }
                    if let Some(window) = handle.get_webview_window("main") {
                        // Webview 已在 tauri.conf.json 的 url 配置里直接加载 FRONTEND_URL。
                        // 这里只确保窗口激活。
                        match window.set_focus() {
                            Ok(()) => {}
                            Err(_) => {}
                        }
                        eprintln!("[numas] window shown at initial url");
                    } else {
                        eprintln!("[numas] no main window found");
                    }
                });
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                if let Some(state) = app_handle.try_state::<SidecarState>() {
                    if let Ok(mut guard) = state.0.try_lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.start_kill();
                        }
                    }
                }
            }
        });
}

#[tauri::command]
async fn show_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn hide_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn sidecar_status(_app: AppHandle) -> Result<bool, String> {
    Ok(ping_health().await)
}

#[tauri::command]
async fn stop_sidecar(app: AppHandle) -> Result<(), String> {
    let state = app.state::<SidecarState>();
    let mut guard = state.0.lock().await;
    if let Some(mut child) = guard.take() {
        let _ = child.start_kill();
    }
    Ok(())
}

/// Spawn the bundled `numas` binary as a sidecar if not already running, and wait for /health.
async fn ensure_sidecar(app: &AppHandle) -> Result<(), String> {
    if ping_health().await {
        return Ok(());
    }
    let state = app.state::<SidecarState>();
    let mut guard = state.0.lock().await;
    if let Some(child) = guard.as_mut() {
        if child.try_wait().unwrap_or(None).is_none() {
            // already running
            return Ok(());
        }
    }

    let bin = resolve_sidecar_path(app)?;
    eprintln!("[numas] spawning sidecar: {bin:?}");

    let mut cmd = Command::new(&bin);
    cmd.arg("serve").arg("--port").arg(PORT.to_string());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    cmd.kill_on_drop(true);

    let mut child = cmd.spawn().map_err(|e| format!("spawn failed: {e}"))?;

    if let Some(stdout) = child.stdout.take() {
        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                eprintln!("[numas:stdout] {line}");
                let _ = app_handle.emit("sidecar-stdout", line);
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                eprintln!("[numas:stderr] {line}");
                let _ = app_handle.emit("sidecar-stderr", line);
            }
        });
    }

    // wait for health up to 30s
    for _ in 0..60 {
        if ping_health().await {
            *guard = Some(child);
            let _ = app.emit("sidecar-status", SidecarStatus { state: true });
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    let _ = child.start_kill();
    Err("sidecar did not become healthy within 30s".into())
}

fn resolve_sidecar_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let mut path = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir: {e}"))?;
    // Tauri externalBin convention: bin/<bin-name>-<target-triple>
    let triple = current_target_triple();
    path.push(format!("numas-{triple}"));
    if !path.exists() {
        return Err(format!("sidecar binary not found at {path:?}"));
    }
    Ok(path)
}

#[cfg(target_os = "macos")]
fn current_target_triple() -> &'static str {
    if cfg!(target_arch = "aarch64") {
        "aarch64-apple-darwin"
    } else {
        "x86_64-apple-darwin"
    }
}
#[cfg(target_os = "linux")]
fn current_target_triple() -> &'static str {
    if cfg!(target_arch = "aarch64") {
        "aarch64-unknown-linux-gnu"
    } else {
        "x86_64-unknown-linux-gnu"
    }
}
#[cfg(target_os = "windows")]
fn current_target_triple() -> &'static str {
    if cfg!(target_arch = "aarch64") {
        "aarch64-pc-windows-msvc"
    } else {
        "x86_64-pc-windows-msvc"
    }
}

async fn ping_health() -> bool {
    tokio::task::spawn_blocking(ping_health_blocking)
        .await
        .unwrap_or(false)
}

fn ping_health_blocking() -> bool {
    use std::io::Read;
    use std::net::TcpStream;
    let addr = match format!("127.0.0.1:{PORT}").parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    let mut stream = match TcpStream::connect_timeout(&addr, Duration::from_millis(800)) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let req = "GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n";
    if stream.write_all(req.as_bytes()).is_err() {
        return false;
    }
    let mut buf = [0u8; 64];
    matches!(stream.read(&mut buf), Ok(n) if n > 0)
}

#[allow(dead_code)]
fn _unused_arc(_: Arc<()>) {}