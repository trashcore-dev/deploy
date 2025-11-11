import express from "express";
import axios from "axios";
import fs from "fs";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const HEROKU_API_KEY = "your_heroku_api_key_here"; // keep secret
const DATA_FILE = "./data.json";
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));

const saveApp = (appInfo) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  data.push(appInfo);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// 🟢 Deploy a new bot
app.post("/deploy", async (req, res) => {
  const { repo, appName, sessionId } = req.body;

  try {
    await axios.post("https://api.heroku.com/apps",
      { name: appName },
      { headers: { Authorization: `Bearer ${HEROKU_API_KEY}`, Accept: "application/vnd.heroku+json; version=3" } }
    );

    await axios.patch(`https://api.heroku.com/apps/${appName}/config-vars`,
      { SESSION_ID: sessionId },
      { headers: { Authorization: `Bearer ${HEROKU_API_KEY}`, Accept: "application/vnd.heroku+json; version=3" } }
    );

    await axios.post(`https://api.heroku.com/apps/${appName}/builds`,
      { source_blob: { url: `${repo}/archive/refs/heads/main.zip` } },
      { headers: { Authorization: `Bearer ${HEROKU_API_KEY}`, Accept: "application/vnd.heroku+json; version=3" } }
    );

    const info = {
      name: appName,
      repo,
      sessionId,
      url: `https://${appName}.herokuapp.com`,
      date: new Date().toISOString()
    };
    saveApp(info);

    res.json({ success: true, message: `✅ Bot "${appName}" deployed!`, app: info });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, message: "❌ Deployment failed." });
  }
});

// 📋 Get all bots
app.get("/bots", (req, res) => {
  const bots = JSON.parse(fs.readFileSync(DATA_FILE));
  res.json(bots);
});

// 🔁 Restart bot
app.post("/restart/:appName", async (req, res) => {
  const { appName } = req.params;
  try {
    await axios.delete(`https://api.heroku.com/apps/${appName}/dynos`,
      { headers: { Authorization: `Bearer ${HEROKU_API_KEY}`, Accept: "application/vnd.heroku+json; version=3" } }
    );
    res.json({ success: true, message: `🔁 Bot "${appName}" restarted successfully!` });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, message: "⚠️ Failed to restart bot." });
  }
});

// 🗑 Delete bot
app.delete("/delete/:appName", async (req, res) => {
  const { appName } = req.params;
  try {
    await axios.delete(`https://api.heroku.com/apps/${appName}`,
      { headers: { Authorization: `Bearer ${HEROKU_API_KEY}`, Accept: "application/vnd.heroku+json; version=3" } }
    );

    // Remove from local data.json
    let bots = JSON.parse(fs.readFileSync(DATA_FILE));
    bots = bots.filter((b) => b.name !== appName);
    fs.writeFileSync(DATA_FILE, JSON.stringify(bots, null, 2));

    res.json({ success: true, message: `🗑 Bot "${appName}" deleted successfully.` });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, message: "⚠️ Failed to delete bot." });
  }
});

app.listen(3000, () => console.log("✅ Drexter Bot Deployer backend running on port 3000"));
