# Phearak Noem Portfolio

This is a simple personal portfolio website.

## How to use

1. Open `index.html` in your browser.
2. Edit the text in `index.html`.
3. Edit colors and layout in `assets/css/style.css`.
4. Edit simple interactions in `assets/js/main.js`.

## Important places to update

- GitHub link
- LinkedIn link
- Email
- Project descriptions
- Education details
- Experience details

## Deploy

You can deploy this static site on:
- GitHub Pages
- Netlify
- Vercel
- Any normal web hosting

Note: the profile photo upload below only works on **Vercel**, because it uses the serverless function in `api/photo.js`.

## Profile photo upload (Cloudinary + Vercel)

The round profile photo on the home page is stored on Cloudinary, so it stays after a refresh and every visitor sees it.
Visitors can only view the photo. Only you can change it, using edit mode and your upload password.

### How it works

- `api/photo.js` is a Vercel serverless function. It keeps the Cloudinary secret on the server.
  - `GET /api/photo` returns the current photo URL (used for every visitor).
  - `POST /api/photo` uploads a new photo (requires the upload password).
  - `DELETE /api/photo` removes the photo (requires the upload password).
- `assets/js/main.js` loads the photo when the page opens. If there is no photo, it shows `assets/images/profile.jpg` if that file exists, otherwise the initials "PN".
- The photo is stored in Cloudinary as `portfolio/profile`. Each new upload replaces the old one.

### One-time setup

1. **Create a Cloudinary account** (free) at https://cloudinary.com.
2. On the Cloudinary dashboard, copy your:
   - Cloud name
   - API Key
   - API Secret
3. **In Vercel**, open your project, go to **Settings → Environment Variables**, and add:

   | Name                    | Value                                |
   | ----------------------- | ------------------------------------ |
   | `CLOUDINARY_CLOUD_NAME` | your Cloudinary cloud name           |
   | `CLOUDINARY_API_KEY`    | your Cloudinary API key              |
   | `CLOUDINARY_API_SECRET` | your Cloudinary API secret           |
   | `UPLOAD_PASSWORD`       | any password you choose for uploads  |

4. **Redeploy** the project in Vercel so the new variables take effect.

Never put these values in the HTML/JS files or commit them to Git.

### Upload or change the photo

1. Open your live site with `?edit` at the end of the address, for example:
   `https://your-site.vercel.app/index.html?edit`
2. Click the round photo (or the 📷 button) and choose a PNG, JPG or WebP image.
3. Enter your `UPLOAD_PASSWORD` when asked (asked once per browser tab).
4. The photo is cropped to a square and uploaded. Everyone sees it within about a minute.

To remove the photo, open the site with `?edit` and click the ✕ button.

Without `?edit`, the upload buttons are hidden and clicking the photo does nothing. The server also rejects any upload without the correct password.

### Testing locally

Opening `index.html` directly in the browser cannot upload, because `/api/photo` only exists on Vercel.
To test locally:

1. Install the Vercel CLI: `npm i -g vercel`
2. Create a file named `.env.local` with the four variables above (it is ignored by Git).
3. Run `vercel dev` and open `http://localhost:3000/index.html?edit`.

### Troubleshooting

- **"Wrong password"**: check `UPLOAD_PASSWORD` in Vercel, then redeploy. Close the tab and try again so the password is asked again.
- **"Cloudinary is not configured"**: one of the `CLOUDINARY_*` variables is missing in Vercel.
- **Photo does not change right away**: the photo URL is cached for up to 60 seconds. Wait a minute and refresh.
- **Nothing happens when clicking the photo**: make sure the address ends with `?edit`.
