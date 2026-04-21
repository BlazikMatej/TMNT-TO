require("dotenv").config();

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET,
  PORT = 3000,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
  console.error(
    "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or JWT_SECRET in .env"
  );
  process.exit(1);
}

const cleanedSupabaseUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, "");
const supabase = createClient(cleanedSupabaseUrl, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = express();
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const TOKEN_COOKIE = "tmnt_session";

const normalizeUsername = (value) =>
  value.trim().toLowerCase().replace(/\s+/g, "");

const isValidUsername = (value) => /^[a-z0-9_]{3,20}$/.test(value);

const isValidPassword = (value) =>
  typeof value === "string" && value.length >= 6;

const signToken = (user) =>
  jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "7d",
  });

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token =
    req.cookies[TOKEN_COOKIE] ||
    (header.startsWith("Bearer ") ? header.slice(7) : null);
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid session" });
  }
};

app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const normalized = normalizeUsername(username);
    if (!isValidUsername(normalized)) {
      return res.status(400).json({
        error: "Username must be 3-20 chars: a-z, 0-9, _",
      });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    const { data: existing, error: existingError } = await supabase
      .from("tmnt_users")
      .select("id")
      .eq("username", normalized)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({ error: existingError.message });
    }
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from("tmnt_users")
      .insert({
        username: normalized,
        password_hash: passwordHash,
        meta_currency: 0,
        unlocked_units: ["leo", "mike", "don", "raph"],
        max_level: 1,
      })
      .select("id, username, meta_currency, unlocked_units, max_level")
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const token = signToken(data);
    res.cookie(TOKEN_COOKIE, token, { httpOnly: true, sameSite: "lax" });
    return res.json({ profile: data });
  } catch (error) {
    console.error("Register error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Unexpected server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const normalized = normalizeUsername(username);
    const { data: user, error } = await supabase
      .from("tmnt_users")
      .select("*")
      .eq("username", normalized)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken(user);
    res.cookie(TOKEN_COOKIE, token, { httpOnly: true, sameSite: "lax" });
    return res.json({
      profile: {
        id: user.id,
        username: user.username,
        meta_currency: user.meta_currency,
        unlocked_units: user.unlocked_units,
        max_level: user.max_level,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Unexpected server error" });
  }
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(TOKEN_COOKIE);
  return res.json({ ok: true });
});

app.get("/api/profile", requireAuth, async (req, res) => {
  const { data: user, error } = await supabase
    .from("tmnt_users")
    .select("id, username, meta_currency, unlocked_units, max_level")
    .eq("id", req.user.sub)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (!user) {
    return res.status(404).json({ error: "Profile not found" });
  }
  return res.json({ profile: user });
});

app.post("/api/profile", requireAuth, async (req, res) => {
  const { meta_currency, unlocked_units, max_level } = req.body || {};
  const updates = {};

  if (meta_currency !== undefined) {
    if (!Number.isInteger(meta_currency) || meta_currency < 0) {
      return res.status(400).json({ error: "Invalid meta_currency" });
    }
    updates.meta_currency = meta_currency;
  }

  if (unlocked_units !== undefined) {
    if (
      !Array.isArray(unlocked_units) ||
      unlocked_units.some((unit) => typeof unit !== "string")
    ) {
      return res.status(400).json({ error: "Invalid unlocked_units" });
    }
    updates.unlocked_units = unlocked_units;
  }

  if (max_level !== undefined) {
    if (!Number.isInteger(max_level) || max_level < 1) {
      return res.status(400).json({ error: "Invalid max_level" });
    }
    updates.max_level = max_level;
  }

  const { data, error } = await supabase
    .from("tmnt_users")
    .update(updates)
    .eq("id", req.user.sub)
    .select("id, username, meta_currency, unlocked_units, max_level")
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  return res.json({ profile: data });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`TMNT TD running on http://localhost:${PORT}`);
});
