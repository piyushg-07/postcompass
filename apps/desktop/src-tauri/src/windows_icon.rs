//! Gives the main window sharp icons on Windows.
//!
//! Tauri only sets the window's *small* icon (title bar). Without a *big* icon (`ICON_BIG`), the
//! taskbar and Alt+Tab stretch the 16 px title-bar icon up to 24–32 px, which looks blurry. Tauri
//! doesn't expose a way to set the big icon, so we load both sizes straight from the `.ico` that
//! `tauri-build` embeds in the executable, at exactly the sizes Windows asks for, and set them here.
#![allow(unsafe_code)] // Win32 FFI, limited to this module

use std::ptr::null;

use windows_sys::Win32::Foundation::HWND;
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetSystemMetrics, ICON_BIG, ICON_SMALL, IMAGE_ICON, LR_DEFAULTCOLOR, LoadImageW, SM_CXICON, SM_CXSMICON,
    SM_CYICON, SM_CYSMICON, SendMessageW, WM_SETICON,
};

/// The id `tauri-build` gives the embedded application icon (`tauri_utils::platform::WINDOWS_APP_ICON_RESOURCE_ID`).
const APP_ICON_RESOURCE_ID: u16 = 32512;

pub fn apply(window: &tauri::WebviewWindow) {
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    let hwnd = hwnd.0 as HWND;

    // SAFETY: plain Win32 calls with a valid window handle owned by this process. The resource id
    // is passed as an integer resource (MAKEINTRESOURCE). Icons stay loaded for the app's lifetime.
    unsafe {
        let module = GetModuleHandleW(null());
        let load = |width, height| {
            LoadImageW(
                module,
                APP_ICON_RESOURCE_ID as usize as *const u16,
                IMAGE_ICON,
                GetSystemMetrics(width),
                GetSystemMetrics(height),
                LR_DEFAULTCOLOR,
            )
        };
        let big = load(SM_CXICON, SM_CYICON);
        let small = load(SM_CXSMICON, SM_CYSMICON);
        if !big.is_null() {
            SendMessageW(hwnd, WM_SETICON, ICON_BIG as usize, big as isize);
        }
        if !small.is_null() {
            SendMessageW(hwnd, WM_SETICON, ICON_SMALL as usize, small as isize);
        }
    }
}
