// scripts/cloneConvexDevToProd.js
// Clona datos desde dev (quirky-squirrel-924) hacia prod (utmost-crocodile-673).
// Ejecuta: node scripts/cloneConvexDevToProd.js

const { ConvexHttpClient } = require("convex/browser");

const TABLES = [
  "profiles",
  "games",
  "transactions",
  "payments",
  "upgrades",
  "subscriptions",
  "scores",
  "favorites",
  "notifications",
  "pushTokens",
  "houseAds",
  "adEvents",
  "contactMessages",
  "cartItems",
  "passwordResetTokens",
  "library",
  "rentals",
  "purchases",
];

const DEV_URL = process.env.DEV_CONVEX_URL || "https://quirky-squirrel-924.convex.cloud";
const PROD_URL = process.env.PROD_CONVEX_URL || "https://utmost-crocodile-673.convex.cloud";

async function main() {
  const dev = new ConvexHttpClient(DEV_URL);
  const prod = new ConvexHttpClient(PROD_URL);

  console.log("Exportando desde", DEV_URL);
  const dump = await dev.query("admin:exportAllTables", { tables: TABLES });

  for (const { table, rows } of dump) {
    console.log(`Importando ${rows.length} filas en ${table}...`);
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      await prod.mutation("admin:importTable", { table, rows: chunk });
    }
  }
  console.log("Listo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
