use std::net::{TcpStream, ToSocketAddrs};
use std::process::Command;
use std::sync::Mutex;
use std::time::Duration;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, RunEvent};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const DEFAULT_PORT: u16 = 24096;
const SERVER_URL: &str = "http://127.0.0.1:24096";

struct ServerState(Mutex<Option<CommandChild>>);

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let urls: Vec<String> = argv.into_iter().filter(|arg| arg.starts_with("numas://")).collect();
            if urls.is_empty() {
                ensure_server_running(app.clone(), DEFAULT_PORT);
                return;
            }
            handle_deep_links(app, &urls);
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(ServerState(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();

            #[cfg(target_os = "macos")]
            cleanup_stale_registrations();

            #[cfg(any(target_os = "linux", all(debug_assertions, target_os = "macos")))]
            {
                if let Err(error) = app.deep_link().register("numas") {
                    eprintln!("[numas] failed to register numas:// scheme: {error}");
                }
            }

            let open_item = MenuItem::with_id(app, "open", "打开", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            TrayIconBuilder::with_id("main-tray")
                .icon(tray_icon())
                .icon_as_template(true)
                .tooltip("numas")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => open_when_ready(app.clone(), DEFAULT_PORT),
                    "quit" => {
                        stop_server(app);
                        cleanup_registrations_now();
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            let urls: Vec<String> = std::env::args().filter(|arg| arg.starts_with("numas://")).collect();
            if urls.is_empty() {
                ensure_server_running(handle.clone(), DEFAULT_PORT);
            } else {
                handle_deep_links(&handle, &urls);
            }

            let handle = handle.clone();
            app.deep_link().on_open_url(move |event| {
                let urls: Vec<String> = event.urls().iter().map(|url| url.to_string()).collect();
                handle_deep_links(&handle, &urls);
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building numas desktop shell")
        .run(|app, event| match event {
            RunEvent::ExitRequested { .. } => stop_server(app),
            RunEvent::Exit => stop_server(app),
            RunEvent::Reopen { .. } => ensure_server_running(app.clone(), DEFAULT_PORT),
            RunEvent::Opened { urls } => {
                let list: Vec<String> = urls.iter().map(|u| u.to_string()).collect();
                handle_deep_links(&app, &list);
            }
            _ => {}
        });
}

fn ensure_server_running(app: AppHandle, port: u16) {
    std::thread::spawn(move || {
        ensure_server(&app, port);
        for _ in 0..120 {
            if port_listening(port) {
                break;
            }
            std::thread::sleep(Duration::from_millis(250));
        }
    });
}

fn open_when_ready(app: AppHandle, port: u16) {
    std::thread::spawn(move || {
        ensure_server(&app, port);
        for _ in 0..120 {
            if port_listening(port) {
                break;
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        std::thread::sleep(Duration::from_millis(500));
        open_browser(&app);
    });
}

fn open_browser(app: &AppHandle) {
    if let Err(error) = app.opener().open_url(SERVER_URL, None::<&str>) {
        eprintln!("[numas] failed to open browser: {error}");
    }
}

fn ensure_server(app: &AppHandle, port: u16) {
    let state = app.state::<ServerState>();
    let mut guard = match state.0.lock() {
        Ok(guard) => guard,
        Err(_) => return,
    };
    if guard.is_some() || port_listening(port) {
        return;
    }

    let port_arg = port.to_string();
    let spawned = app
        .shell()
        .sidecar("numas")
        .and_then(|command| {
            command
                .args([
                    "serve",
                    "--port",
                    port_arg.as_str(),
                    "--hostname",
                    "0.0.0.0",
                    "--cors",
                    "*",
                ])
                .spawn()
        });

    match spawned {
        Ok((mut events, child)) => {
            *guard = Some(child);
            tauri::async_runtime::spawn(async move {
                while let Some(event) = events.recv().await {
                    match event {
                        CommandEvent::Stderr(line) => eprintln!("[numas] {}", String::from_utf8_lossy(&line)),
                        CommandEvent::Error(error) => eprintln!("[numas] sidecar error: {error}"),
                        CommandEvent::Terminated(payload) => {
                            eprintln!("[numas] sidecar exited: {:?}", payload.code)
                        }
                        _ => {}
                    }
                }
            });
        }
        Err(error) => eprintln!("[numas] failed to start numas server: {error}"),
    }
}

fn stop_server(app: &AppHandle) {
    // 1) 停自己拉起的 sidecar (若存在)
    let state = app.state::<ServerState>();
    let child = state.0.lock().ok().and_then(|mut guard| guard.take());
    if let Some(child) = child {
        let _ = child.kill();
    }
    // 2) 无条件停 24096 进程 (不管是否自己拉起的), 确保端口干净释放
    if port_listening(DEFAULT_PORT) {
        #[cfg(target_os = "macos")]
        {
            let _ = Command::new("pkill")
                .args(["-f", "numas serve --port 24096"])
                .output();
        }
        #[cfg(target_os = "linux")]
        {
            let _ = Command::new("pkill")
                .args(["-f", "numas serve --port 24096"])
                .output();
        }
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("taskkill")
                .args(["/F", "/FI", "WINDOWTITLE eq numas*"])
                .output();
        }
    }
}

/// [退出] 时同步清理 LaunchServices 中除当前 app 外的所有 numas.app 注册.
#[cfg(target_os = "macos")]
fn cleanup_registrations_now() {
    let lsreg = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
    let current = std::env::current_exe()
        .ok()
        .and_then(|p| p.ancestors().nth(2).map(|d| d.to_path_buf()))
        .and_then(|p| {
            if p.extension().map(|e| e == "app").unwrap_or(false) {
                Some(p)
            } else {
                None
            }
        });

    let Ok(output) = Command::new(lsreg).arg("-dump").output() else {
        return;
    };
    let Ok(text) = String::from_utf8(output.stdout) else {
        return;
    };

    for line in text.lines() {
        let Some(rest) = line.strip_prefix("path:") else { continue };
        let path = rest.trim();
        if !path.ends_with(".app") || !path.contains("numas") {
            continue;
        }
        if current.as_ref().is_some_and(|c| c.to_string_lossy() == path) {
            continue;
        }
        let _ = Command::new(lsreg).arg("-u").arg(path).output();
    }
}

fn handle_deep_links(app: &AppHandle, urls: &[String]) {
    let port = urls.iter().find_map(|url| parse_port(url)).unwrap_or(DEFAULT_PORT);
    ensure_server(app, port);
}

fn parse_port(url: &str) -> Option<u16> {
    let query = url.split_once('?')?.1;
    query.split('&').find_map(|pair| {
        let (key, value) = pair.split_once('=')?;
        if key == "port" {
            value.parse().ok()
        } else {
            None
        }
    })
}

fn port_listening(port: u16) -> bool {
    let address = format!("127.0.0.1:{port}");
    match address.to_socket_addrs() {
        Ok(mut addresses) => addresses
            .next()
            .map(|address| TcpStream::connect_timeout(&address, Duration::from_millis(300)).is_ok())
            .unwrap_or(false),
        Err(_) => false,
    }
}

fn tray_icon() -> tauri::image::Image<'static> {
    tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png")).expect("invalid tray icon")
}

/// 启动时清理 LaunchServices 中 numas.app 的陈旧注册 (macOS only).
///
/// 背景: 拖拽 / 脚本 / 手动安装 numas.app 后, 旧的废弃拷贝 (如 `.Trash/`, 旧路径)
/// 仍留在 LaunchServices 注册表里, 系统按 bundle id (dev.numas.app) 记忆 Accessory/Dock
/// 状态, 可能把新装的 app 带偏 (托盘非单色 / Dock 闪现 / 状态继承). 每次启动清理一遍:
///   - **继承当前**: 正在运行的 app 自身保留注册
///   - **移除旧的**: 除当前运行 app 外的所有 numas.app 注册全部卸载
///     (同一 bundle id 同一时刻只应有一个活跃 app; 其它路径的注册都是旧的/冲突的)
/// 纯后台线程执行, 不阻塞启动; 失败静默忽略.
#[cfg(target_os = "macos")]
fn cleanup_stale_registrations() {
    std::thread::spawn(|| {
        let lsreg = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
        let current = std::env::current_exe().ok().and_then(|p| {
            // current_exe 是 Contents/MacOS/numas-tauri; 向上两级拿 .app
            p.ancestors()
                .nth(2)
                .map(|d| d.to_path_buf())
        });
        let current_app = current.and_then(|p| {
            if p.extension().map(|e| e == "app").unwrap_or(false) {
                Some(p)
            } else {
                None
            }
        });

        let Ok(output) = Command::new(lsreg).arg("-dump").output() else {
            return;
        };
        let Ok(text) = String::from_utf8(output.stdout) else {
            return;
        };

        for line in text.lines() {
            let Some(rest) = line.strip_prefix("path:") else { continue };
            let path = rest.trim();
            if !path.ends_with(".app") || !path.contains("numas") {
                continue;
            }
            // 继承当前运行中的 app, 其余 (旧版本 / 其它路径 / 残留) 一律移除
            if current_app.as_ref().is_some_and(|c| c.to_string_lossy() == path) {
                continue;
            }
            eprintln!("[numas] 移除 LaunchServices 注册: {path}");
            let _ = Command::new(lsreg).arg("-u").arg(path).output();
        }
    });
}
