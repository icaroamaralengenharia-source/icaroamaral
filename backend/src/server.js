import "dotenv/config";
import { createApp } from "./app.js";
import { PersistentMessengerStore } from "./elo-messenger-local.js";

const isProduction = process.env.NODE_ENV === "production";

const configuredPort = process.env.PORT || (
  isProduction
    ? ""
    : process.env.ELO_MESSENGER_PORT || "8787"
);

if (!configuredPort) {
  throw new Error("PORT is required in production.");
}

const port = Number(configuredPort);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT must be a positive integer.");
}

const databasePath = process.env.ELO_MESSENGER_DB || (
  isProduction
    ? ""
    : "./data/elo-messenger.sqlite"
);

if (!databasePath) {
  throw new Error("ELO_MESSENGER_DB is required in production.");
}

const store = new PersistentMessengerStore(databasePath);

const app = createApp({
  eloMessengerLocalStore: store,
  eloMessengerLocalBasePath: "/api/elo-messenger",
  eloMessengerLocalAlias: "/api/elo-messenger-local"
});

app.listen(port, "0.0.0.0", () => {
  console.log("ObraReport AI Backend rodando na porta " + port);
});
