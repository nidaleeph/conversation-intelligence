import { PgBoss } from "pg-boss";

let boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;

  // pg-boss v12: constructor accepts DatabaseOptions + SchedulingOptions + MaintenanceOptions.
  // Job-level defaults (retryLimit, expireInSeconds, deleteAfterSeconds) are set per-queue
  // or per-job at send/work time — they are not constructor options in v12.
  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
  });

  boss.on("error", (err: Error) => {
    console.error("pg-boss error:", err);
  });

  await boss.start();
  console.log("pg-boss started");
  return boss;
}

export async function stopBoss(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}
