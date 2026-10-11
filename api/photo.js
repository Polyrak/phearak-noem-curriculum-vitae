// Vercel serverless function: stores the profile photo on Cloudinary.
//   GET    /api/photo  -> { url } of the current photo (or { url: null })
//   POST   /api/photo  -> upload { image: "<data URL>" }, needs x-upload-password header
//   DELETE /api/photo  -> remove the photo, needs x-upload-password header
//
// Required environment variables (Vercel > Project > Settings > Environment Variables):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, UPLOAD_PASSWORD

const crypto = require("crypto");

const PUBLIC_ID = "portfolio/profile";

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, UPLOAD_PASSWORD } = process.env;

const apiBase = () => `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}`;

const sign = (params) => {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(toSign + CLOUDINARY_API_SECRET).digest("hex");
};

const signedForm = (params) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const all = { ...params, timestamp };
  return { ...all, api_key: CLOUDINARY_API_KEY, signature: sign(all) };
};

const passwordOk = (req) => {
  const given = Buffer.from(String(req.headers["x-upload-password"] || ""));
  const expected = Buffer.from(UPLOAD_PASSWORD || "");
  return expected.length > 0 && given.length === expected.length && crypto.timingSafeEqual(given, expected);
};

async function getPhoto(res) {
  const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64");
  const response = await fetch(`${apiBase()}/resources/image/upload/${PUBLIC_ID}`, {
    headers: { Authorization: `Basic ${auth}` },
  });

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

async function deletePhoto(res) {
  const response = await fetch(`${apiBase()}/image/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signedForm({ public_id: PUBLIC_ID, invalidate: true })),
  });

  if (!response.ok) return res.status(502).json({ error: "Could not remove photo." });
  return res.status(200).json({ url: null });
}

module.exports = async (req, res) => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return res.status(500).json({ error: "Cloudinary is not configured." });
  }

  try {
    if (req.method === "GET") return await getPhoto(res);

    if (req.method === "POST" || req.method === "DELETE") {
      if (!passwordOk(req)) return res.status(401).json({ error: "Wrong password." });
      return req.method === "POST" ? await uploadPhoto(req, res) : await deletePhoto(res);
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  } catch {
    return res.status(500).json({ error: "Something went wrong." });
  }
};
