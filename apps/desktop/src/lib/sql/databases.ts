/* ── Databases, schemas and extensions ── */

import { ident, literal } from "./quote";

export function createSchema(name: string) {
  return `CREATE SCHEMA ${ident(name)};`;
}

export function renameSchema(name: string, newName: string) {
  return `ALTER SCHEMA ${ident(name)} RENAME TO ${ident(newName)};`;
}

export function dropSchema(name: string, cascade: boolean) {
  return `DROP SCHEMA ${ident(name)}${cascade ? " CASCADE" : ""};`;
}

export function createDatabase(name: string) {
  return `CREATE DATABASE ${ident(name)};`;
}

/** Renaming needs no open connections to the database, so close them first. */
export function renameDatabase(name: string, newName: string) {
  return (
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${literal(name)} AND pid <> pg_backend_pid();\n` +
    `ALTER DATABASE ${ident(name)} RENAME TO ${ident(newName)};`
  );
}

export function dropDatabase(name: string) {
  return `DROP DATABASE ${ident(name)} WITH (FORCE);`;
}

export function createExtension(name: string, schema?: string) {
  return `CREATE EXTENSION IF NOT EXISTS ${ident(name)}${schema ? ` SCHEMA ${ident(schema)}` : ""};`;
}

export function dropExtension(name: string) {
  return `DROP EXTENSION ${ident(name)};`;
}

export function updateExtension(name: string) {
  return `ALTER EXTENSION ${ident(name)} UPDATE;`;
}
