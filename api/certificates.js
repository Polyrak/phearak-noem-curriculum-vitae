// Vercel serverless function: stores certificate images on Cloudinary.
//   GET    /api/certificates  -> { certificates: [{ id, url, title, createdAt }] }, newest first
//   POST   /api/certificates  -> upload { image: "<data URL>", title: "..." }, needs x-upload-password header
//   DELETE /api/certificates  -> remove { id }, needs x-upload-password header

const crypto = require("crypto");
const { apiBase, adminHeaders, signedForm, route } = require("./_cloudinary");

const PREFIX = "portfolio/certificates/";
const MAX_TITLE_LENGTH = 120;

// Cloudinary context values use "|" and "=" as separators, so those must be escaped.
const escapeContext = (value) => value.replace(/([|=\\])/g, "\\$1");

async function listCertificates(req, res) {
  const query = new URLSearchParams({ prefix: PREFIX, max_results: "100", context: "true" });
  const response = await fetch(`${apiBase()}/resources/image/upload?${query}`, { headers: adminHeaders() });
  if (!response.ok) return res.status(502).json({ error: "Could not load certificates." });

  const data = await response.json();
  const certificates = (data.resources || [])
    .map((resource) => ({
      id: resource.public_id,
      url: resource.secure_url,
      title: resource.context?.custom?.caption || "",
      createdAt: resource.created_at,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  return res.status(200).json({ certificates });
}

async function uploadCertificate(req, res) {
  const image = req.body?.image;
  if (typeof image !== "string" || !/^data:image\/(png|jpe?g|webp);base64,/.test(image)) {
    return res.status(400).json({ error: "Please send a PNG, JPG or WebP image." });
  }

  const title = typeof req.body?.title === "string" ? req.body.title.replace(/\s+/g, " ").trim() : "";
  if (title.length > MAX_TITLE_LENGTH) {
    return res.status(400).json({ error: `Title must be at most ${MAX_TITLE_LENGTH} characters.` });
  }

  const params = { public_id: `${PREFIX}cert-${Date.now()}-${crypto.randomBytes(3).toString("hex")}` };
  if (title) params.context = `caption=${escapeContext(title)}`;

  const response = await fetch(`${apiBase()}/image/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: image, ...signedForm(params) }),
  });

  const data = await response.json();
  if (!response.ok) return res.status(502).json({ error: data.error?.message || "Upload failed." });

  return res.status(200).json({
    certificate: { id: data.public_id, url: data.secure_url, title, createdAt: data.created_at },
  });
}

async function deleteCertificate(req, res) {
  const id = req.body?.id;
  if (typeof id !== "string" || !new RegExp(`^${PREFIX}[\\w-]+$`).test(id)) {
    return res.status(400).json({ error: "Unknown certificate." });
  }

  const response = await fetch(`${apiBase()}/image/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signedForm({ public_id: id, invalidate: true })),
  });

  if (!response.ok) return res.status(502).json({ error: "Could not remove certificate." });
  return res.status(200).json({ id });
}

module.exports = route({ GET: listCertificates, POST: uploadCertificate, DELETE: deleteCertificate });
