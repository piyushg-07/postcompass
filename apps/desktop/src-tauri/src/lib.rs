mod commands;
mod runtimes;
mod secrets;
mod state;

use tauri::{Manager, RunEvent};
use tauri_specta::{Builder, collect_commands};

use crate::runtimes::Runtimes;
use crate::state::Store;

/// Single source of truth for every command the UI can call.
/// In debug builds this also regenerates `src/lib/bindings.ts`.
fn specta_builder() -> Builder<tauri::Wry> {
    use commands::{app, servers, state};
    Builder::<tauri::Wry>::new().commands(collect_commands![
        app::app_info,
        state::get_state,
        state::save_profile,
        state::reset_onboarding,
        state::update_settings,
        servers::runtime_versions,
        servers::detect_local,
        servers::suggest_port,
        servers::is_port_free,
        servers::install_server,
        servers::cancel_install,
        servers::server_statuses,
        servers::start_server,
        servers::stop_server,
        servers::server_password,
        servers::uninstall_server,
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = specta_builder();

    #[cfg(debug_assertions)]
    export_bindings(&builder);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);

            let paths = app.path();
            app.manage(Store::load(paths.app_config_dir()?.join("state.json")));
            app.manage(Runtimes::new(paths.app_local_data_dir()?.join("runtimes")));

            auto_start_servers(app.handle().clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building PostCompass");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            stop_servers_on_quit(handle);
        }
    });
}

/// Starts servers marked "start with PostCompass" in the background.
fn auto_start_servers(handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let servers = handle.state::<Store>().snapshot().servers;
        let runtimes = handle.state::<Runtimes>();
        for server in servers.iter().filter(|s| s.auto_start) {
            if let Ok(runtime) = runtimes.get(server.kind)
                && let Err(e) = runtime.start(server).await
            {
                eprintln!("auto-start of {} failed: {e}", server.name);
            }
        }
    });
}

fn stop_servers_on_quit(handle: &tauri::AppHandle) {
    let snapshot = handle.state::<Store>().snapshot();
    if !snapshot.settings.stop_servers_on_quit {
        return;
    }
    let runtimes = handle.state::<Runtimes>();
    tauri::async_runtime::block_on(async {
        for server in &snapshot.servers {
            if let Ok(runtime) = runtimes.get(server.kind) {
                let _ = runtime.stop(server).await;
            }
        }
    });
}

#[cfg(debug_assertions)]
fn export_bindings(builder: &Builder<tauri::Wry>) {
    builder
        .export(
            specta_typescript::Typescript::default().header("// @ts-nocheck"),
            concat!(env!("CARGO_MANIFEST_DIR"), "/../src/lib/bindings.ts"),
        )
        .expect("failed to export TypeScript bindings");
}

#[cfg(test)]
mod tests {
    /// `cargo test` regenerates the bindings too, so CI can check they are up to date.
    #[test]
    fn export_bindings() {
        super::export_bindings(&super::specta_builder());
    }
}
