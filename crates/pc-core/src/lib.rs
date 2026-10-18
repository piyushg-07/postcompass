//! Shared types for PostCompass.
//!
//! Every database-specific crate (`driver-*`, `runtime-*`) depends on this crate,
//! and the desktop app only talks to databases through the types defined here.
//! The `DatabaseDriver` trait lands here in Phase 5.

mod error;
mod kind;
pub mod runtime;

pub use error::{CoreError, CoreResult, ErrorCode};
pub use kind::{DatabaseKind, DriverCapabilities};
