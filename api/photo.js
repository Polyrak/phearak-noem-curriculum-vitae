// Vercel serverless function: stores the profile photo on Cloudinary.
//   GET    /api/photo  -> { url } of the current photo (or { url: null })
//   POST   /api/photo  -> upload { image: "<data URL>" }, needs x-upload-password header
//   DELETE /api/photo  -> remove the photo, needs x-upload-password header

const { apiBase, adminHeaders, signedForm, route } = require("./_cloudinary");

const PUBLIC_ID = "portfolio/profile";

async function getPhoto(req, res) {
  const response = await fetch(`${apiBase()}/resources/image/upload/${PUBLIC_ID}`, { headers: adminHeaders() });

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  if (response.status === 404) return res.status(200).json({ url: null });
  if (!response.ok) return res.status(502).json({ error: "Could not load photo." });

  const data = await response.json();
  return res.status(200).json({ url: data.secure_url });
}

async function uploadPhoto(req, res) {
  const image = req.body && req.body.image;
  if (typeof image !== "string" || !/^data:image\/(png|jpe?g|webp);base64,/.test(image)) {
    return res.status(400).json({ error: "Please send a PNG, JPG or WebP image." });
  }

  const response = await fetch(`${apiBase()}/image/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: image,
      ...signedForm({ public_id: PUBLIC_ID, overwrite: true, invalidate: true }),
    }),
  });

  const data = await response.json();
  if (!response.ok) return res.status(502).json({ error: data.error?.message || "Upload failed." });

  return res.status(200).json({ url: data.secure_url });
}

async function deletePhoto(req, res) {
  const response = await fetch(`${apiBase()}/image/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signedForm({ public_id: PUBLIC_ID, invalidate: true })),
  });

  if (!response.ok) return res.status(502).json({ error: "Could not remove photo." });
  return res.status(200).json({ url: null });
}

module.exports = route({ GET: getPhoto, POST: uploadPhoto, DELETE: deletePhoto });
