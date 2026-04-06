import pg from "pg";

async function seed() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/ddre_warroom";

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // Check if admin already exists
    const existing = await client.query(
      "SELECT id FROM agents WHERE role = 'admin' LIMIT 1"
    );

    if (existing.rows.length > 0) {
      console.log("Admin agent already exists, skipping seed.");
      return;
    }

    // Create admin agent
    const result = await client.query(
      `INSERT INTO agents (name, email, role, coverage_areas)
       VALUES ($1, $2, 'admin', $3)
       RETURNING id, name, email`,
      ["Nidal", "nidaleeph@gmail.com", ["Hampstead", "Highgate", "Belsize Park"]]
    );

    const admin = result.rows[0];
    console.log(`Admin agent created: ${admin.name} (${admin.email})`);

    // Create default notification preferences for admin
    await client.query(
      "INSERT INTO notification_preferences (agent_id) VALUES ($1)",
      [admin.id]
    );

    console.log("Seed complete.");
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
