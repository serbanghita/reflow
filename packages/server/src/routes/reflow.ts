import { Router } from "express";
import { ReflowService } from "@reflow/engine";
import type { ReflowInput } from "@reflow/engine/types";

const router = Router();
const service = new ReflowService();

router.post("/", (req, res) => {
  try {
    const input: ReflowInput = req.body;

    if (
      !input.settlementTasks ||
      !input.settlementChannels ||
      !input.tradeOrders
    ) {
      res.status(400).json({
        error:
          "Request body must include settlementTasks, settlementChannels, and tradeOrders",
      });
      return;
    }

    const result = service.reflow(input);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export { router as reflowRouter };
