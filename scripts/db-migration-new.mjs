#!/usr/bin/env node
/**
 * 在 supabase/migrations/ 下创建空迁移文件。
 * 文件名前缀 YYYYMMDDHHmmss 使用本机时区墙钟（与进程 TZ 一致，例如 TZ=UTC 则为 UTC）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** 本地（或 TZ 指定）墙钟 → YYYYMMDDHHmmss */
function localMigrationStamp() {
  const d = new Date();
  return (
    `${d.getFullYear()}` +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    pad2(d.getHours()) +
    pad2(d.getMinutes()) +
    pad2(d.getSeconds())
  );
}

function sanitizeMigrationName(raw) {
  const s = raw.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return s;
}

function usage() {
  console.error("用法: pnpm run db:migration:new -- <migration_name>");
  console.error("示例: pnpm run db:migration:new -- add_user_prefs");
  console.error("多词会以下划线连接: pnpm run db:migration:new -- add user prefs → add_user_prefs");
}

const rawName = process.argv.slice(2).join("_").trim();
if (!rawName) {
  usage();
  process.exit(1);
}

const safeName = sanitizeMigrationName(rawName);
if (!safeName) {
  console.error("错误: 迁移名称清洗后为空，请使用字母、数字、下划线或连字符。");
  process.exit(1);
}

const stamp = localMigrationStamp();
const fileName = `${stamp}_${safeName}.sql`;
const filePath = path.join(migrationsDir, fileName);

if (fs.existsSync(filePath)) {
  console.error(`错误: 文件已存在，未写入: ${path.relative(repoRoot, filePath)}`);
  process.exit(1);
}

fs.mkdirSync(migrationsDir, { recursive: true });

const body = `-- ${safeName}\n`;
fs.writeFileSync(filePath, body, "utf8");

console.log(`已创建: ${path.relative(repoRoot, filePath)}`);
