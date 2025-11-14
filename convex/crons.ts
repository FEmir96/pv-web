// convex/crons.ts
import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

const isDev = (process.env.CONVEX_DEPLOYMENT ?? "").startsWith("dev:");
const DAY_BATCH = Number(process.env.SWEEP_BATCH_SIZE ?? (isDev ? 50 : 300));
const NIGHT_BATCH = Number(process.env.SWEEP_BATCH_SIZE_NIGHT ?? (isDev ? 100 : 1000));

// ↓ DESACTIVADO: barrido cada 10 minutos
// crons.cron(
//   "sweep-expirations-every-10-min",
//   "*/10 * * * *",
//   api.mutations.sweepExpirations.sweepExpirations,
//   { batchSize: DAY_BATCH }
// );

// Se mantienen los otros crons
crons.cron(
  "sweep-expirations-midnight",
  "0 0 * * *",
  api.mutations.sweepExpirations.sweepExpirations,
  { batchSize: NIGHT_BATCH }
);

crons.cron(
  "pre-expiry-reminders-daily-09utc",
  "0 9 * * *",
  api.mutations.preExpiryReminders.sendPreExpiryReminders,
  {}
);

export default crons;