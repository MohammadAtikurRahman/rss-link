// index.js
import express from "express";
import router from "./route.js";

const app = express();

app.use(express.json());

// সব route এখন root এ, যেমন /resolve, /search
app.use("/", router);

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Google News Resolver API" });
});

const PORT = process.env.PORT || 2000;

app.listen(PORT, () => {
  console.log(`Resolver API running at http://localhost:${PORT}`);
});
