import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

async function migrate() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/ddre_warroom";

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Get already-applied migrations
    const applied = await client.query(
      "SELECT version FROM schema_migrations ORDER BY version"
    );
    const appliedVersions = new Set(
      applied.rows.map((r: { version: number }) => r.version)
    );

    // Read migration files
    const __filename = fileURLToPath(import.meta.url);
    const normalizedDir = path.join(path.dirname(__filename), "migrations");

    const files = fs
      .readdirSync(normalizedDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const version = parseInt(file.split("-")[0], 10);
      if (appliedVersions.has(version)) {
        console.log(`  skip: ${file} (already applied)`);
        continue;
      }

      console.log(`  apply: ${file}`);
      const sql = fs.readFileSync(path.join(normalizedDir, file), "utf-8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
          [version, file]
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("Migrations complete.");
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
