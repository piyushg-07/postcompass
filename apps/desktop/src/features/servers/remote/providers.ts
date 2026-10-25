import type { SslMode } from "../../../lib/bindings";

export type Provider = {
  id: string;
  label: string;
  shortLabel: string;
  defaultSsl: SslMode;
  hostHint?: string;
  /** When the provider doesn't listen on 5432. */
  defaultPort?: number;
};

export const PROVIDERS: Provider[] = [
  { id: "aws",          label: "AWS RDS / Aurora",              shortLabel: "AWS RDS",      defaultSsl: "require",  hostHint: "e.g. mydb.us-east-1.rds.amazonaws.com" },
  { id: "gcp",          label: "Google Cloud SQL",              shortLabel: "Cloud SQL",    defaultSsl: "require",  hostHint: "e.g. 34.xx.xx.xx (Cloud SQL public IP)" },
  { id: "azure",        label: "Azure Database for PostgreSQL", shortLabel: "Azure DB",     defaultSsl: "require",  hostHint: "e.g. myserver.postgres.database.azure.com" },
  { id: "cloudflare",   label: "Cloudflare Hyperdrive",         shortLabel: "Hyperdrive",   defaultSsl: "require",  hostHint: "e.g. <UUID>.hyperdrive.io" },
  { id: "alibaba",      label: "Alibaba Cloud (RDS / PolarDB)", shortLabel: "Alibaba",      defaultSsl: "require",  hostHint: "e.g. pgm-xxxx.pg.rds.aliyuncs.com" },
  { id: "oracle",       label: "Oracle Cloud (OCI)",            shortLabel: "Oracle",       defaultSsl: "require",  hostHint: "e.g. your DB system's endpoint or private IP" },
  { id: "digitalocean", label: "DigitalOcean",                  shortLabel: "DigitalOcean", defaultSsl: "require",  hostHint: "e.g. db-postgresql-nyc3-12345-do-user-0.db.ondigitalocean.com", defaultPort: 25060 },
  { id: "heroku",       label: "Heroku Postgres",               shortLabel: "Heroku",       defaultSsl: "require",  hostHint: "e.g. ec2-xx-xx-xx-xx.compute-1.amazonaws.com" },
  { id: "neon",         label: "Neon",                          shortLabel: "Neon",         defaultSsl: "require",  hostHint: "e.g. ep-xxxx.us-east-2.aws.neon.tech" },
  { id: "railway",      label: "Railway",                       shortLabel: "Railway",      defaultSsl: "require",  hostHint: "e.g. roundhouse.proxy.rlwy.net" },
  { id: "render",       label: "Render",                        shortLabel: "Render",       defaultSsl: "require",  hostHint: "e.g. dpg-xxx.render.com" },
  { id: "other",        label: "Other / Self-hosted",           shortLabel: "PostgreSQL",   defaultSsl: "prefer" },
];

/** "Other / Self-hosted": the fallback for unknown provider ids. */
export const OTHER_PROVIDER = PROVIDERS[PROVIDERS.length - 1]!;

export function providerById(id: string) {
  return PROVIDERS.find((p) => p.id === id) ?? OTHER_PROVIDER;
}
