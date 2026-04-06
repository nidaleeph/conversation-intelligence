import pg from "pg";

async function refresh() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/ddre_warroom";

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // Clear all data in dependency order
    console.log("Clearing all data...");
    await client.query("DELETE FROM audit_log");
    await client.query("DELETE FROM push_subscriptions");
    await client.query("DELETE FROM notification_preferences");
    await client.query("DELETE FROM alerts");
    await client.query("DELETE FROM matches");
    await client.query("DELETE FROM signals");
    await client.query("DELETE FROM messages");
    await client.query("DELETE FROM sessions");
    await client.query("DELETE FROM agents");

    console.log("All data cleared.");
    console.log("\nRun these next:");
    console.log("  npm run db:seed          # create admin agent");
    console.log("  npm run db:seed-messages  # load sample messages");
  } finally {
    await client.end();
  }
}

refresh().catch((err) => {
  console.error("Refresh failed:", err);
  process.exit(1);
});
