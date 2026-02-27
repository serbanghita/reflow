import express from "express";
import { corsMiddleware } from "./middleware/cors.js";
import { scenariosRouter } from "./routes/scenarios.js";
import { reflowRouter } from "./routes/reflow.js";

const app = express();
const port = parseInt(process.env.PORT ?? "3001", 10);

app.use(corsMiddleware);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/scenarios", scenariosRouter);
app.use("/api/reflow", reflowRouter);

app.listen(port, () => {
  console.log(`@reflow/server listening on http://localhost:${port}`);
});
