use pc_core::CoreError;
use tauri::State;

use crate::state::{AppState, Profile, Settings, Store};

/// Everything the UI needs on startup.
#[tauri::command]
#[specta::specta]
pub fn get_state(store: State<'_, Store>) -> AppState {
    store.snapshot()
}

/// Saves onboarding answers; marks onboarding as complete.
#[tauri::command]
#[specta::specta]
pub fn save_profile(store: State<'_, Store>, profile: Profile) -> Result<AppState, CoreError> {
    store.update(|state| state.profile = Some(profile))?;
    Ok(store.snapshot())
}

/// Clears the onboarding profile so onboarding runs again. Servers are kept.
#[tauri::command]
#[specta::specta]
pub fn reset_onboarding(store: State<'_, Store>) -> Result<AppState, CoreError> {
    store.update(|state| state.profile = None)?;
    Ok(store.snapshot())
}

#[tauri::command]
#[specta::specta]
pub fn update_settings(store: State<'_, Store>, settings: Settings) -> Result<AppState, CoreError> {
    store.update(|state| state.settings = settings)?;
    Ok(store.snapshot())
}
