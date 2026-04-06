import { query } from "../../db/connection.js";
import { scoreMatch } from "./scorer.js";

const MATCH_PAIRS: Record<string, string> = {
  "Buyer Search": "Property for Sale",
  "Property for Sale": "Buyer Search",
  "Tenant Search": "Property for Rent",
  "Property for Rent": "Tenant Search",
};

const MATCH_THRESHOLD = 0.5;

interface MatchResult {
  matchesFound: number;
  alertsCreated: number;
}

export async function findAndStoreMatches(signalId: string): Promise<MatchResult> {
  const signalResult = await query(
    `SELECT id, type, location, budget_min, budget_max, bedrooms,
            property_type, created_at, message_id
     FROM signals WHERE id = $1`,
    [signalId]
  );

  const signal = signalResult.rows[0];
  if (!signal) return { matchesFound: 0, alertsCreated: 0 };

  const oppositeType = MATCH_PAIRS[signal.type];
  if (!oppositeType) return { matchesFound: 0, alertsCreated: 0 };

  const candidatesResult = await query(
    `SELECT id, type, location, budget_min, budget_max, bedrooms,
            property_type, created_at, message_id
     FROM signals
     WHERE type = $1 AND actionable = true
       AND created_at > now() - interval '60 days'
       AND id != $2
     ORDER BY created_at DESC LIMIT 100`,
    [oppositeType, signalId]
  );

  let matchesFound = 0;
  let alertsCreated = 0;
  const isDemand = signal.type === "Buyer Search" || signal.type === "Tenant Search";

  for (const candidate of candidatesResult.rows) {
    const demand = isDemand ? signal : candidate;
    const supply = isDemand ? candidate : signal;

    const { score, reasons } = scoreMatch(
      {
        id: demand.id, type: demand.type, location: demand.location,
        budgetMin: demand.budget_min, budgetMax: demand.budget_max,
        bedrooms: demand.bedrooms, propertyType: demand.property_type,
        createdAt: demand.created_at,
      },
      {
        id: supply.id, type: supply.type, location: supply.location,
        budgetMin: supply.budget_min, budgetMax: supply.budget_max,
        bedrooms: supply.bedrooms, propertyType: supply.property_type,
        createdAt: supply.created_at,
      }
    );

    if (score < MATCH_THRESHOLD) continue;

    const existingMatch = await query(
      `SELECT id FROM matches
       WHERE (signal_a_id = $1 AND signal_b_id = $2)
          OR (signal_a_id = $2 AND signal_b_id = $1)`,
      [demand.id, supply.id]
    );
    if (existingMatch.rows.length > 0) continue;

    const matchResult = await query(
      `INSERT INTO matches (signal_a_id, signal_b_id, match_score, match_reasons)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [demand.id, supply.id, score, reasons]
    );
    matchesFound++;

    const matchId = matchResult.rows[0].id;

    import("../audit/service.js").then(({ logAudit }) =>
      logAudit({ agentId: null, action: "match_found", entityType: "match", entityId: matchId })
    ).catch(() => {});

    try {
      const { broadcast: wsBroadcast } = await import("../notifications/websocket.js");
      wsBroadcast({
        type: "match:new",
        data: { matchId, score, reasons, demandId: demand.id, supplyId: supply.id },
      });
    } catch {}
    const demandSender = await query("SELECT sender_name FROM messages WHERE id = $1", [demand.message_id]);
    const supplySender = await query("SELECT sender_name FROM messages WHERE id = $1", [supply.message_id]);

    const allLocations = Array.from(new Set([...demand.location, ...supply.location]));

    if (allLocations.length > 0) {
      const agentsResult = await query(
        `SELECT id, name FROM agents WHERE is_active = true AND coverage_areas && $1`,
        [allLocations]
      );

      for (const agent of agentsResult.rows) {
        const demandName = demandSender.rows[0]?.sender_name ?? "Unknown";
        const supplyName = supplySender.rows[0]?.sender_name ?? "Unknown";
        const summary = isDemand
          ? `${demandName}'s ${demand.type} matches ${supplyName}'s ${supply.type} in ${allLocations.join(", ")} (score: ${score})`
          : `${supplyName}'s ${supply.type} matches ${demandName}'s ${demand.type} in ${allLocations.join(", ")} (score: ${score})`;

        const alertResult = await query(
          `INSERT INTO alerts (agent_id, signal_id, match_id, type, priority, summary)
           VALUES ($1, $2, $3, 'match_found', $4, $5) RETURNING id`,
          [agent.id, signal.id, matchId, score >= 0.8 ? "high" : score >= 0.6 ? "medium" : "low", summary]
        );
        alertsCreated++;

        try {
          const { sendToAgent } = await import("../notifications/websocket.js");
          sendToAgent(agent.id, {
            type: "alert:new",
            data: {
              alertId: alertResult.rows[0].id,
              matchId,
              priority: score >= 0.8 ? "high" : score >= 0.6 ? "medium" : "low",
              summary,
            },
          });
        } catch {}

        // Dispatch email notifications
        try {
          const { dispatchNotifications } = await import("../notifications/dispatcher.js");
          await dispatchNotifications({
            alertId: alertResult.rows[0].id,
            agentId: agent.id,
            summary,
            priority: score >= 0.8 ? "high" : score >= 0.6 ? "medium" : "low",
            alertType: "match_found",
          });
        } catch {}
      }
    }
  }

  return { matchesFound, alertsCreated };
}
