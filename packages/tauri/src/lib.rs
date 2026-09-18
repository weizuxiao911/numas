use std::net::{TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const DEFAULT_PORT: u16 = 24096;
const SERVER_URL: &str = "http://127.0.0.1:24096";

struct ServerState(Mutex<Option<CommandChild>>);
struct LaunchFlags(AtomicBool);

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let urls: Vec<String> = argv.into_iter().filter(|arg| arg.starts_with("numas://")).collect();
            if urls.is_empty() {
                ensure_server(app, DEFAULT_PORT);
                open_browser(app);
                return;
            }
            handle_deep_links(app, &urls);
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(ServerState(Mutex::new(None)))
        .manage(LaunchFlags(AtomicBool::new(false)))
        .setup(|app| {
            let handle = app.handle().clone();

            #[cfg(any(target_os = "linux", all(debug_assertions, target_os = "macos")))]
            {
                if let Err(error) = app.deep_link().register("numas") {
                    eprintln!("[numas] failed to register numas:// scheme: {error}");
                }
            }

            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

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
                    "open" => {
                        ensure_server(app, DEFAULT_PORT);
                        open_browser(app);
                    }
                    "quit" => {
                        stop_server(app);
                        app.exit(0);
                    }
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
                        ensure_server(app, DEFAULT_PORT);
                        open_browser(app);
                    }
                })
                .build(app)?;

            let urls: Vec<String> = std::env::args().filter(|arg| arg.starts_with("numas://")).collect();
            if urls.is_empty() {
                let handle = handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_millis(2000));
                    if handle.state::<LaunchFlags>().0.load(Ordering::SeqCst) {
                        return;
                    }
                    ensure_server(&handle, DEFAULT_PORT);
                    open_browser(&handle);
                });
            } else {
                handle_deep_links(&handle, &urls);
            }

            let handle = handle.clone();
            app.deep_link().on_open_url(move |event| {
                handle.state::<LaunchFlags>().0.store(true, Ordering::SeqCst);
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
            _ => {}
        });
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
    let state = app.state::<ServerState>();
    let child = state.0.lock().ok().and_then(|mut guard| guard.take());
    if let Some(child) = child {
        let _ = child.kill();
    }
}

fn open_browser(app: &AppHandle) {
    if let Err(error) = app.opener().open_url(SERVER_URL, None::<&str>) {
        eprintln!("[numas] failed to open browser: {error}");
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
    let bytes: &'static [u8] = if cfg!(target_os = "macos") {
        include_bytes!("../icons/tray.png")
    } else {
        include_bytes!("../icons/icon.png")
    };
    tauri::image::Image::from_bytes(bytes).expect("invalid tray icon")
}
