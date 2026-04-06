import { PgBoss } from "pg-boss";
import { findAndStoreMatches } from "./service.js";

export async function startMatchingWorker(boss: PgBoss) {
  await boss.createQueue("match-signals");

  await boss.work(
    "match-signals",
    { localConcurrency: 3 },
    async (jobs) => {
      for (const job of jobs) {
        const { signalId } = job.data as { signalId: string };
        console.log(`Matching signal ${signalId}...`);
        const result = await findAndStoreMatches(signalId);
        if (result.matchesFound > 0) {
          console.log(`  → ${result.matchesFound} match(es) found, ${result.alertsCreated} alert(s) created`);
        } else {
          console.log(`  → no matches`);
        }
      }
    }
  );

  console.log("Matching worker started (listening for match-signals jobs)");
}
