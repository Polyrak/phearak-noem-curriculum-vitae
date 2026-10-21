// Shared Cloudinary helpers for the API routes (files starting with "_" are not routes on Vercel).
//
// Required environment variables (Vercel > Project > Settings > Environment Variables):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, UPLOAD_PASSWORD

const crypto = require("crypto");

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, UPLOAD_PASSWORD } = process.env;

const apiBase = () => `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}`;

const adminHeaders = () => ({
  Authorization: `Basic ${Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64")}`,
});

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
  const given = Buffer.from(String(req.headers["x-upload-password"] || "").trim());
  const expected = Buffer.from((UPLOAD_PASSWORD || "").trim());
  return expected.length > 0 && given.length === expected.length && crypto.timingSafeEqual(given, expected);
};

// Wraps a route: checks configuration, guards writes with the upload password, handles errors.
//   handlers: { GET, POST, DELETE } -> async (req, res)
const route = (handlers) => async (req, res) => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return res.status(500).json({ error: "Cloudinary is not configured." });
  }

  const handler = handlers[req.method];
  if (!handler) {
    res.setHeader("Allow", Object.keys(handlers).join(", "));
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    if (req.method !== "GET") {
      if (!(UPLOAD_PASSWORD || "").trim()) {
        return res.status(500).json({ error: "UPLOAD_PASSWORD is not set in Vercel (redeploy after adding it)." });
      }
      if (!passwordOk(req)) return res.status(401).json({ error: "Wrong password." });
    }
    return await handler(req, res);
  } catch {
    return res.status(500).json({ error: "Something went wrong." });
  }
};

module.exports = { apiBase, adminHeaders, signedForm, route };
