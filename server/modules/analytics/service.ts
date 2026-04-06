import { query } from "../../db/connection.js";

export async function getKPIs() {
  const [
    totalMessages,
    totalSignals,
    actionableSignals,
    buyerSearches,
    tenantSearches,
    propertiesForSale,
    propertiesForRent,
    pendingReview,
    totalAgents,
  ] = await Promise.all([
    query("SELECT count(*) FROM messages"),
    query("SELECT count(*) FROM signals"),
    query("SELECT count(*) FROM signals WHERE actionable = true"),
    query("SELECT count(*) FROM signals WHERE type = 'Buyer Search'"),
    query("SELECT count(*) FROM signals WHERE type = 'Tenant Search'"),
    query("SELECT count(*) FROM signals WHERE type = 'Property for Sale'"),
    query("SELECT count(*) FROM signals WHERE type = 'Property for Rent'"),
    query("SELECT count(*) FROM signals WHERE confidence < 0.85 AND status = 'new'"),
    query("SELECT count(*) FROM agents WHERE is_active = true"),
  ]);

  return {
    totalMessages: parseInt(totalMessages.rows[0].count, 10),
    totalSignals: parseInt(totalSignals.rows[0].count, 10),
    actionableSignals: parseInt(actionableSignals.rows[0].count, 10),
    buyerSearches: parseInt(buyerSearches.rows[0].count, 10),
    tenantSearches: parseInt(tenantSearches.rows[0].count, 10),
    propertiesForSale: parseInt(propertiesForSale.rows[0].count, 10),
    propertiesForRent: parseInt(propertiesForRent.rows[0].count, 10),
    pendingReview: parseInt(pendingReview.rows[0].count, 10),
    totalAgents: parseInt(totalAgents.rows[0].count, 10),
  };
}

export async function getDistributions() {
  const [areaStats, budgetDist, bedroomDist, typeDist] = await Promise.all([
    query(`
      SELECT unnest(location) as area, count(*) as count
      FROM signals
      WHERE actionable = true
      GROUP BY area
      ORDER BY count DESC
      LIMIT 20
    `),
    query(`
      SELECT
        CASE
          WHEN budget_max IS NULL THEN 'Unknown'
          WHEN budget_max < 1000000 THEN 'Under £1m'
          WHEN budget_max < 2000000 THEN '£1m–£2m'
          WHEN budget_max < 3000000 THEN '£2m–£3m'
          WHEN budget_max < 5000000 THEN '£3m–£5m'
          WHEN budget_max < 10000000 THEN '£5m–£10m'
          ELSE '£10m+'
        END as range,
        count(*) as count
      FROM signals
      WHERE actionable = true AND type IN ('Buyer Search', 'Property for Sale')
      GROUP BY range
      ORDER BY count DESC
    `),
    query(`
      SELECT bedrooms, count(*) as count
      FROM signals
      WHERE bedrooms IS NOT NULL AND actionable = true
      GROUP BY bedrooms
      ORDER BY bedrooms
    `),
    query(`
      SELECT type, count(*) as count
      FROM signals
      GROUP BY type
      ORDER BY count DESC
    `),
  ]);

  return {
    areaStats: areaStats.rows.map((r: any) => ({
      area: r.area,
      count: parseInt(r.count, 10),
    })),
    budgetDistribution: budgetDist.rows.map((r: any) => ({
      range: r.range,
      count: parseInt(r.count, 10),
    })),
    bedroomDistribution: bedroomDist.rows.map((r: any) => ({
      bedrooms: r.bedrooms,
      count: parseInt(r.count, 10),
    })),
    typeDistribution: typeDist.rows.map((r: any) => ({
      type: r.type,
      count: parseInt(r.count, 10),
    })),
  };
}

export async function getClassificationHealth() {
  const [reviewQueue, avgConfidence, methodSplit, recentTrend] = await Promise.all([
    query("SELECT count(*) FROM signals WHERE confidence < 0.85 AND status = 'new'"),
    query(`
      SELECT classification_method as method,
             round(avg(confidence)::numeric, 3) as avg_confidence,
             count(*) as count
      FROM signals GROUP BY classification_method
    `),
    query(`
      SELECT classification_method as method, count(*) as count
      FROM signals GROUP BY classification_method
    `),
    query(`
      SELECT date_trunc('day', created_at)::date as day,
             round(avg(confidence)::numeric, 3) as avg_confidence,
             count(*) as count
      FROM signals WHERE created_at > now() - interval '7 days'
      GROUP BY day ORDER BY day
    `),
  ]);

  const totalSignals = methodSplit.rows.reduce((sum: number, r: any) => sum + parseInt(r.count, 10), 0);

  return {
    reviewQueueDepth: parseInt(reviewQueue.rows[0].count, 10),
    confidenceByMethod: avgConfidence.rows.map((r: any) => ({
      method: r.method, avgConfidence: parseFloat(r.avg_confidence), count: parseInt(r.count, 10),
    })),
    methodSplit: methodSplit.rows.map((r: any) => ({
      method: r.method, count: parseInt(r.count, 10),
      percentage: totalSignals > 0 ? Math.round((parseInt(r.count, 10) / totalSignals) * 100) : 0,
    })),
    confidenceTrend: recentTrend.rows.map((r: any) => ({
      day: r.day, avgConfidence: parseFloat(r.avg_confidence), count: parseInt(r.count, 10),
    })),
  };
}

export async function getAgentActivity() {
  const result = await query(`
    SELECT a.id, a.name, a.email,
           coalesce(reviews.count, 0) as reviews,
           coalesce(alert_reads.count, 0) as alerts_read,
           coalesce(match_actions.count, 0) as match_actions
    FROM agents a
    LEFT JOIN (
      SELECT reviewed_by as agent_id, count(*) FROM signals WHERE reviewed_by IS NOT NULL GROUP BY reviewed_by
    ) reviews ON reviews.agent_id = a.id
    LEFT JOIN (
      SELECT agent_id, count(*) FROM alerts WHERE read = true GROUP BY agent_id
    ) alert_reads ON alert_reads.agent_id = a.id
    LEFT JOIN (
      SELECT confirmed_by as agent_id, count(*) FROM matches WHERE confirmed_by IS NOT NULL GROUP BY confirmed_by
    ) match_actions ON match_actions.agent_id = a.id
    WHERE a.is_active = true ORDER BY reviews DESC
  `);

  return result.rows.map((r: any) => ({
    id: r.id, name: r.name, email: r.email,
    reviews: parseInt(r.reviews, 10),
    alertsRead: parseInt(r.alerts_read, 10),
    matchActions: parseInt(r.match_actions, 10),
  }));
}

export async function getSignalVolume() {
  const result = await query(`
    SELECT date_trunc('day', created_at)::date as day,
           count(*) as total,
           count(*) FILTER (WHERE actionable = true) as actionable
    FROM signals WHERE created_at > now() - interval '30 days'
    GROUP BY day ORDER BY day
  `);

  return result.rows.map((r: any) => ({
    day: r.day, total: parseInt(r.total, 10), actionable: parseInt(r.actionable, 10),
  }));
}
