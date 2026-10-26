//! Shared types for PostCompass.
//!
//! Every database-specific crate (`driver-*`, `runtime-*`) depends on this crate,
//! and the desktop app only talks to databases through the types defined here.

pub mod driver;
mod error;
mod kind;
pub mod runtime;

pub use error::{CoreError, CoreResult, ErrorCode};
pub use kind::{DatabaseKind, DriverCapabilities};
