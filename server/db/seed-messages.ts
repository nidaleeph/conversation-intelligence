import pg from "pg";
import crypto from "node:crypto";

const messages = [
  { sender: "Scott Bennett", text: "I have a new buyer looking for 3 bed house in Hampstead, budget up to £3.3m. Needs a garden. Fee required please." },
  { sender: "Natalie Malka", text: "Does anyone have a rental in Marylebone 2 bed 2 bath ideally with parking £9k a month" },
  { sender: "Jonathan Singer", text: "Redington Road, NW3, £1,550,000, 3 Bed, 2 Bath, 1,375 SQFT, Share of Freehold. Fees Available." },
  { sender: "Daisy Spanbok", text: "Does anyone know any architects who are familiar with the suburbs and are reasonably priced?" },
  { sender: "Lauren Christy", text: "Have a great buyer looking for a 2 bed turnkey apartment in Hampstead, Primrose Hill, budget up to £2.5m. Needs garden." },
  { sender: "Jamie Gallagher", text: "Just listed: beautiful 3 bed house in Hampstead, £2.8m, garden, 1400 sqft, turnkey condition" },
  { sender: "Sarah Miller", text: "Beautiful 2 bed flat available to rent in Belsize Park, £3,500 pcm, parking included" },
  { sender: "Tom Richards", text: "Happy new year everyone! Hope you all had a great break." },
  { sender: "Scott Bennett", text: "New buyer searching for 4 bed detached in Highgate, budget £5m, needs parking and garden" },
  { sender: "Natalie Malka", text: "Just instructed: stunning 4 bed house in Highgate, £4.8m, off-street parking, large garden, 2200 sqft" },
  { sender: "Lauren Christy", text: "Does anyone have a 3 bed rental in Hampstead or Belsize Park? Budget £6k per month, needs outside space" },
  { sender: "Jamie Gallagher", text: "2 bed apartment available to rent in Hampstead, £4,500 pcm, balcony, newly refurbished" },
];

async function seedMessages() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/ddre_warroom";

  const client = new pg.Client({ connectionString });
  await client.connect();

  let added = 0;
  let skipped = 0;

  try {
    for (const msg of messages) {
      const normalized = msg.text.toLowerCase().replace(/\s+/g, " ").trim();
      const input = `${normalized}|${msg.sender.toLowerCase()}|ddre agents`;
      const fingerprint = crypto.createHash("sha256").update(input).digest("hex");

      // Skip duplicates
      const existing = await client.query(
        "SELECT id FROM messages WHERE fingerprint = $1",
        [fingerprint]
      );
      if (existing.rows.length > 0) {
        console.log(`  skip: "${msg.text.slice(0, 60)}..." (duplicate)`);
        skipped++;
        continue;
      }

      // Insert message
      const result = await client.query(
        `INSERT INTO messages (source_group, sender_name, sender_phone, raw_text, platform, fingerprint)
         VALUES ($1, $2, '', $3, 'whatsapp', $4)
         RETURNING id`,
        ["DDRE Agents", msg.sender, msg.text, fingerprint]
      );

      // Queue classification job via pg-boss
      await client.query(
        `INSERT INTO pgboss.job (name, data, state)
         VALUES ('classify-message', $1, 'created')`,
        [JSON.stringify({
          messageId: result.rows[0].id,
          rawText: msg.text,
          senderName: msg.sender,
          sourceGroup: "DDRE Agents",
        })]
      );

      console.log(`  added: [${msg.sender}] "${msg.text.slice(0, 60)}..."`);
      added++;
    }

    console.log(`\nDone: ${added} added, ${skipped} skipped.`);
    if (added > 0) {
      console.log("Messages queued for classification — make sure dev:server is running!");
    }
  } finally {
    await client.end();
  }
}

seedMessages().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
