// index.js
import express from "express";
import resolveRouter from "./route.js";

const app = express();

app.use(express.json());

// সব resolve সম্পর্কিত route এখানে মাউন্ট
app.use("/resolve", resolveRouter);

// অপশনাল health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Google News Resolver API" });
});

const PORT = process.env.PORT || 2000;

app.listen(PORT, () => {
  console.log(`Resolver API running at http://localhost:${PORT}`);
});
