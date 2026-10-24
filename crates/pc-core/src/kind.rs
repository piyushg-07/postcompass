use serde::{Deserialize, Serialize};
use specta::Type;

/// Databases PostCompass knows about. Add a variant here when a new driver crate is added.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseKind {
    Postgres,
}

impl DatabaseKind {
    pub const ALL: &'static [DatabaseKind] = &[DatabaseKind::Postgres];

    pub fn display_name(self) -> &'static str {
        match self {
            DatabaseKind::Postgres => "PostgreSQL",
        }
    }

    pub fn default_port(self) -> u16 {
        match self {
            DatabaseKind::Postgres => 5432,
        }
    }
}

/// Feature flags a driver reports. The UI shows or hides features based on these,
/// never by checking which database it is talking to.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DriverCapabilities {
    pub schemas: bool,
    pub roles: bool,
    pub extensions: bool,
    pub explain_analyze: bool,
    pub listen_notify: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_kind_has_metadata() {
        for kind in DatabaseKind::ALL {
            assert!(!kind.display_name().is_empty());
            assert!(kind.default_port() > 0);
        }
    }
}
