import pg from "pg";

interface SeedAgent {
  name: string;
  email: string;
  role: "admin" | "agent";
  coverageAreas: string[];
}

const SEED_AGENTS: SeedAgent[] = [
  {
    name: "Nidal",
    email: "nidaleeph@gmail.com",
    role: "admin",
    coverageAreas: ["Hampstead", "Highgate", "Belsize Park"],
  },
  {
    name: "Admin Test",
    email: "admin@test.com",
    role: "admin",
    coverageAreas: ["Hampstead", "Highgate", "Belsize Park", "Primrose Hill", "Muswell Hill", "Crouch End"],
  },
  {
    name: "Agent Test",
    email: "agent@test.com",
    role: "agent",
    coverageAreas: ["Hampstead", "Belsize Park"],
  },
];

async function seed() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/ddre_warroom";

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    let created = 0;
    let skipped = 0;

    for (const a of SEED_AGENTS) {
      const existing = await client.query(
        "SELECT id FROM agents WHERE email = $1",
        [a.email]
      );

      if (existing.rows.length > 0) {
        console.log(`Skip: ${a.email} (already exists)`);
        skipped++;
        continue;
      }

      const result = await client.query(
        `INSERT INTO agents (name, email, role, coverage_areas)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, role`,
        [a.name, a.email, a.role, a.coverageAreas]
      );

      const agent = result.rows[0];
      await client.query(
        "INSERT INTO notification_preferences (agent_id) VALUES ($1)",
        [agent.id]
      );

      console.log(`Created: ${agent.name} <${agent.email}> (${agent.role})`);
      created++;
    }

    console.log(`Seed complete — created ${created}, skipped ${skipped}.`);
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
