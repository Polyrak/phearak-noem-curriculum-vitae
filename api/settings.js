// Vercel serverless function: stores editable site settings as a JSON file on Cloudinary.
//   GET  /api/settings  -> { title, showCertificates }
//                          (title is null until saved once; showCertificates is false until turned on)
//   POST /api/settings  -> save any of { title: "...", showCertificates: true/false }, needs x-upload-password header

const { apiBase, adminHeaders, signedForm, route } = require("./_cloudinary");

const PUBLIC_ID = "portfolio/settings.json";
const MAX_TITLE_LENGTH = 80;

async function readSettings() {
  const response = await fetch(`${apiBase()}/resources/raw/upload/${PUBLIC_ID}`, { headers: adminHeaders() });
  if (response.status === 404) return {};
  if (!response.ok) throw new Error("Could not load settings.");

  // secure_url contains the version, so this always returns the latest saved file.
  const { secure_url } = await response.json();
  const file = await fetch(secure_url);
  if (!file.ok) throw new Error("Could not load settings.");
  return file.json();
}

const publicSettings = (settings) => ({
  title: settings.title || null,
  showCertificates: settings.showCertificates === true,
});

async function getSettings(req, res) {
  const settings = await readSettings();
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  return res.status(200).json(publicSettings(settings));
}

async function saveSettings(req, res) {
  const body = req.body || {};
  const changes = {};

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.replace(/\s+/g, " ").trim() : "";
    if (!title || title.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ error: `Title must be 1-${MAX_TITLE_LENGTH} characters.` });
    }
    changes.title = title;
  }

  if (body.showCertificates !== undefined) {
    if (typeof body.showCertificates !== "boolean") {
      return res.status(400).json({ error: "showCertificates must be true or false." });
    }
    changes.showCertificates = body.showCertificates;
  }

  if (!Object.keys(changes).length) {
    return res.status(400).json({ error: "Nothing to save." });
  }

  const settings = { ...(await readSettings()), ...changes };
  const file = `data:application/json;base64,${Buffer.from(JSON.stringify(settings)).toString("base64")}`;

  const response = await fetch(`${apiBase()}/raw/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file, ...signedForm({ public_id: PUBLIC_ID, overwrite: true, invalidate: true }) }),
  });

  const data = await response.json();
  if (!response.ok) return res.status(502).json({ error: data.error?.message || "Save failed." });

  return res.status(200).json(publicSettings(settings));
}

module.exports = route({ GET: getSettings, POST: saveSettings });
