import cors from "cors";

export const corsMiddleware = cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
});
