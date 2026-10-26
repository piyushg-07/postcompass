use serde::Serialize;
use specta::Type;

/// Stable, machine-readable error codes. The UI maps these to messages and toasts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    Internal,
    Io,
    NotFound,
    InvalidInput,
    Network,
    ChecksumMismatch,
    Cancelled,
    PortInUse,
    InsufficientDiskSpace,
    Unsupported,
    ProcessFailed,
    Secrets,
    ConnectionFailed,
    AuthFailed,
    QueryFailed,
}

/// The single error type returned by every Tauri command.
/// Serialized to the UI as `{ code, message }`.
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("{0}")]
    Internal(String),
    #[error("{context}: {source}")]
    Io {
        context: String,
        #[source]
        source: std::io::Error,
    },
    #[error("not found: {0}")]
    NotFound(String),
    #[error("{0}")]
    InvalidInput(String),
    #[error("network error: {0}")]
    Network(String),
    #[error("download verification failed: expected SHA-256 {expected}, got {actual}")]
    ChecksumMismatch { expected: String, actual: String },
    #[error("cancelled")]
    Cancelled,
    #[error("port {0} is already in use")]
    PortInUse(u16),
    #[error("not enough disk space: {needed_mb} MB needed, {available_mb} MB available")]
    InsufficientDiskSpace { needed_mb: u64, available_mb: u64 },
    #[error("{0}")]
    Unsupported(String),
    #[error("{program} failed: {message}")]
    ProcessFailed { program: String, message: String },
    #[error("secure storage error: {0}")]
    Secrets(String),
    #[error("could not connect: {0}")]
    ConnectionFailed(String),
    #[error("{0}")]
    AuthFailed(String),
    #[error("{0}")]
    QueryFailed(String),
}

impl CoreError {
    pub fn code(&self) -> ErrorCode {
        match self {
            CoreError::Internal(_) => ErrorCode::Internal,
            CoreError::Io { .. } => ErrorCode::Io,
            CoreError::NotFound(_) => ErrorCode::NotFound,
            CoreError::InvalidInput(_) => ErrorCode::InvalidInput,
            CoreError::Network(_) => ErrorCode::Network,
            CoreError::ChecksumMismatch { .. } => ErrorCode::ChecksumMismatch,
            CoreError::Cancelled => ErrorCode::Cancelled,
            CoreError::PortInUse(_) => ErrorCode::PortInUse,
            CoreError::InsufficientDiskSpace { .. } => ErrorCode::InsufficientDiskSpace,
            CoreError::Unsupported(_) => ErrorCode::Unsupported,
            CoreError::ProcessFailed { .. } => ErrorCode::ProcessFailed,
            CoreError::Secrets(_) => ErrorCode::Secrets,
            CoreError::ConnectionFailed(_) => ErrorCode::ConnectionFailed,
            CoreError::AuthFailed(_) => ErrorCode::AuthFailed,
            CoreError::QueryFailed(_) => ErrorCode::QueryFailed,
        }
    }

    /// Wraps an I/O error with a short description of what was being done.
    pub fn io(context: impl Into<String>, source: std::io::Error) -> Self {
        CoreError::Io {
            context: context.into(),
            source,
        }
    }
}

/// Lets `?` be used on I/O calls; prefer [`CoreError::io`] when a clearer context helps the user.
impl From<std::io::Error> for CoreError {
    fn from(source: std::io::Error) -> Self {
        CoreError::io("file system error", source)
    }
}

#[derive(Serialize, Type)]
#[serde(rename = "CoreError")]
struct CoreErrorPayload {
    code: ErrorCode,
    message: String,
}

impl Serialize for CoreError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        CoreErrorPayload {
            code: self.code(),
            message: self.to_string(),
        }
        .serialize(serializer)
    }
}

impl Type for CoreError {
    fn definition(types: &mut specta::Types) -> specta::datatype::DataType {
        CoreErrorPayload::definition(types)
    }
}

pub type CoreResult<T> = Result<T, CoreError>;
