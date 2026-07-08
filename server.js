const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const ADMIN_USER = "Admin";
const ADMIN_PASS = "admin123";

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("Tipprunde Backend läuft 🚀");
});

/* =========================
   REGISTER
========================= */
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  const { error } = await supabase.from("users").insert({
    username,
    password_hash: hash,
    role: "player"
  });

  if (error) return res.status(400).json(error);

  res.json({ success: true });
});

/* =========================
   LOGIN
========================= */
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  // Admin Login
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign(
      { id: "admin", role: "admin", username: "Admin" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }   // Token läuft nicht sofort ab
    );
    return res.json({ token });
  }

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (!user) return res.status(401).json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Wrong password" });

  const token = jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    process.env.JWT_SECRET
  );

  res.json({ token });
});

/* =========================
   GET USERS (ADMIN TEST)
========================= */
app.get("/api/users", async (req, res) => {
  const { data } = await supabase.from("users").select("*");
  res.json(data);
});

/* =========================
   CREATE GAME (ADMIN)
========================= */
app.post("/api/games", async (req, res) => {
  const { matchday, home_team, away_team, kickoff } = req.body;

  const { data, error } = await supabase.from("games").insert({
    matchday,
    home_team,
    away_team,
    kickoff
  });

  if (error) return res.status(400).json(error);

  res.json(data);
});

/* =========================
   SET RESULT (ADMIN)
========================= */
app.put("/api/games/:id/result", async (req, res) => {
  const { id } = req.params;
  const { result_home, result_away } = req.body;

  const { data, error } = await supabase
    .from("games")
    .update({ result_home, result_away })
    .eq("id", id);

  if (error) return res.status(400).json(error);

  res.json(data);
});

/* =========================
   ALLE SPIELE ABRUFEN
========================= */
app.get("/api/games", async (req, res) => {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("kickoff", { ascending: true });

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);
});

/* =========================
   TIPP ABGEBEN UND SPEICHERN
========================= */

app.post("/api/tips/:gameId", async (req, res) => {
  const { gameId } = req.params;
  const { tip_home, tip_away } = req.body;

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  let user;

  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }

  if (user.role === "admin") {
    return res.status(403).json({ error: "Admin kann nicht tippen" });
  }
  
  const user_id = user.id;

  // =========================
  // 1. Spiel + Kickoff holen
  // =========================
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("kickoff")
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    return res.status(400).json({ error: "Game not found" });
  }

  // robuste Zeitkonvertierung (Postgres timestamp safe)
  const kickoffTime = new Date(game.kickoff.replace(" ", "T")).getTime();
  const now = Date.now();

  // =========================
  // 2. Deadline prüfen (1h vorher)
  // =========================
  if (now > kickoffTime - 60 * 60 * 1000) {
    return res.status(403).json({
      error: "Tippabgabe nur bis 1 Stunde vor Spielbeginn möglich"
    });
  }

  // =========================
  // 3. MaxTips aus settings holen
  // =========================
  const { data: settings, error: settingsError } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "maxTipsPerGame")
    .single();

  if (settingsError) {
    return res.status(400).json(settingsError);
  }

  const maxTips = settings ? Number(settings.value) : 1;

  // =========================
  // 4. Anzahl vorhandener Tipps zählen
  // =========================
  const { count, error: countError } = await supabase
    .from("tips")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user_id)
    .eq("game_id", gameId);

  if (countError) {
    return res.status(400).json(countError);
  }

  const currentCount = count || 0;

  // =========================
  // 5. Limit prüfen
  // =========================
  if (currentCount >= maxTips) {
    return res.status(403).json({
      error: `Maximale Anzahl an Tipps (${maxTips}) für dieses Spiel erreicht`
    });
  }

  // =========================
  // 6. Tipp speichern
  // =========================
  const { data, error } = await supabase.from("tips").insert({
    user_id,
    game_id: gameId,
    tip_home: Number(tip_home),
    tip_away: Number(tip_away)
  });

  if (error) {
    console.log("TIP INSERT ERROR:", error);
    return res.status(400).json(error);
  }

  res.json({ success: true, data });
});

/* =========================
   AUSWERTUNG PRO SPIEL
========================= */
app.get("/api/games/:id/evaluate", async (req, res) => {
  const { id } = req.params;

  // Spiel holen
  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .single();

  // Tipps holen
  const { data: tips } = await supabase
    .from("tips")
    .select("*")
    .eq("game_id", id);

  if (!game || !tips) return res.json([]);

  const winners = tips.filter(t =>
    t.tip_home == game.result_home &&
    t.tip_away == game.result_away
  );

  res.json({
    game,
    winners
  });
});

/* =========================
   ANZEIGE DER TIPPS
========================= */
app.get("/api/my-tips", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  let user;

  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }

    // Admin hat keine Tipps in der DB
  if (user.role === "admin") {
    return res.json([]);
  }
  
  const user_id = user.id;

  const { data, error } = await supabase
    .from("tips")
    .select("*")
    .eq("user_id", user_id);

  if (error) {
    return res.status(400).json(error);
  }

  res.json(data);
});

/* =========================
   TIPPS LÖSCHEN
========================= */

app.delete("/api/tips/:tipId", async (req, res) => {
  const { tipId } = req.params;

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { data, error } = await supabase
    .from("tips")
    .delete()
    .eq("id", tipId);

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ success: true });
});

/* =========================
   PASSWORT ZURÜCKSETZEN (ADMIN)
========================= */
app.put("/api/users/:id/reset-password", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }

  if (user.role !== "admin") {
    return res.status(403).json({ error: "Nur Admin erlaubt" });
  }

  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "Passwort zu kurz (min. 4 Zeichen)" });
  }

  const hash = await bcrypt.hash(newPassword, 10);

  const { error } = await supabase
    .from("users")
    .update({ password_hash: hash })
    .eq("id", id);

  if (error) return res.status(400).json(error);

  res.json({ success: true });
});

/* =========================
   SPIEL SPERREN/ENTSPERREN (ADMIN)
========================= */
app.put("/api/games/:id/lock", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }

  if (user.role !== "admin") {
    return res.status(403).json({ error: "Nur Admin erlaubt" });
  }

  const { id } = req.params;
  const { locked } = req.body;

  const { error } = await supabase
    .from("games")
    .update({ locked })
    .eq("id", id);

  if (error) return res.status(400).json(error);

  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server läuft auf Port " + PORT);
});
