//! PostgreSQL implementation of [`LocalRuntime`]: detect existing installs, install a managed
//! server without admin rights, and start/stop it.

mod detect;
mod download;
mod install;
mod platform;
mod process;
mod server;
pub mod tools;
mod versions;

use std::path::PathBuf;

use async_trait::async_trait;
use pc_core::runtime::{
    DetectionReport, InstallContext, InstallRequest, LocalRuntime, ManagedServer, RuntimeVersion, ServerStatus,
};
use pc_core::{CoreResult, DatabaseKind};

pub use detect::{first_free_port, is_postgres, port_is_free};

#[derive(Debug, Default, Clone, Copy)]
pub struct PostgresRuntime;

#[async_trait]
impl LocalRuntime for PostgresRuntime {
    fn kind(&self) -> DatabaseKind {
        DatabaseKind::Postgres
    }

    fn available_versions(&self) -> Vec<RuntimeVersion> {
        versions::available()
    }

    async fn detect(&self, managed_root: Option<PathBuf>) -> DetectionReport {
        detect::detect(managed_root).await
    }

    async fn install(&self, request: InstallRequest, ctx: InstallContext) -> CoreResult<ManagedServer> {
        install::install(request, ctx).await
    }

    async fn start(&self, server: &ManagedServer) -> CoreResult<()> {
        server::start(server).await
    }

    async fn stop(&self, server: &ManagedServer) -> CoreResult<()> {
        server::stop(server).await
    }

    async fn status(&self, server: &ManagedServer) -> ServerStatus {
        server::status(server).await
    }

    async fn uninstall(&self, server: &ManagedServer, keep_data: bool) -> CoreResult<()> {
        server::uninstall(server, keep_data).await
    }
}
