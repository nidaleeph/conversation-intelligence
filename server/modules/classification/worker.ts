import { PgBoss } from "pg-boss";
import { classifyMessage } from "./pipeline.js";

export async function startClassificationWorker(boss: PgBoss) {
  // pg-boss v12 requires explicit queue creation
  await boss.createQueue("classify-message");

  await boss.work(
    "classify-message",
    { localConcurrency: 5 },
    async (jobs) => {
      for (const job of jobs) {
        const { messageId, rawText, senderName, sourceGroup } = job.data as {
          messageId: string;
          rawText: string;
          senderName: string;
          sourceGroup: string;
        };

        console.log(`Classifying message ${messageId}...`);

        const result = await classifyMessage({
          messageId,
          rawText,
          senderName,
          sourceGroup,
        });

        if (result) {
          console.log(
            `  → ${result.type} (${result.method}, confidence: ${result.confidence}${result.needsReview ? ", needs review" : ""})`
          );
        } else {
          console.log(`  → no signal produced`);
        }

        // Queue matching if signal is matchable
        if (
          result &&
          result.actionable &&
          ["Buyer Search", "Tenant Search", "Property for Sale", "Property for Rent"].includes(result.type)
        ) {
          await boss.send("match-signals", { signalId: result.signalId });
        }
      }
    }
  );

  console.log("Classification worker started (listening for classify-message jobs)");
}
