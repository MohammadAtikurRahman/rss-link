// index.js
import express from "express";
import cors from "cors";
import router from "./route.js";

const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  // credentials: true, // only if you use cookies/auth
}));

app.use(express.json());

app.use("/", router);

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Google News Resolver API" });
});

const PORT = process.env.PORT || 2000;
app.listen(PORT, () => {
  console.log(`Resolver API running at http://localhost:${PORT}`);
});
