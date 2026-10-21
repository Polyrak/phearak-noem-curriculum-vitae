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

### Change the job title

1. Open `https://your-site.vercel.app/edit` (or any page with `?edit`).
2. Click the title "Senior Full-stack software engineer" (it has a dashed outline in edit mode) and type the new text.
3. Press **Enter** to save (or **Esc** to cancel), then enter your `UPLOAD_PASSWORD` if asked.

The new title replaces every element marked `data-field="title"`: the home page heading, the browser tab title on the home page,
and the "I am a ..." sentence on the About page. To show the title somewhere else, add `data-field="title"` to that element.
The title is saved on Cloudinary as `portfolio/settings.json` by `api/settings.js`.

### Certificates

The **Certificates** page (`certificates.html`) shows certificate images stored on Cloudinary under `portfolio/certificates/`.
Visitors can only view them. Clicking a certificate opens the full image.

The **Certificates menu is hidden by default.** When it is on, the menu shows on every page; when it is off, it is hidden
everywhere (also in edit mode).

To turn it on or off, open `https://your-site.vercel.app/edit` (or any page with `?edit`). An **Edit mode** bar appears at the
bottom of the page with a "Certificates menu" switch.
The setting is saved in `portfolio/settings.json` (with the job title) and may take up to a minute to reach visitors.

To add or remove certificates:

1. Open `https://your-site.vercel.app/certificates.html?edit`. You can also open `/edit` and click **Certificates** in the menu, since edit mode stays on when you move between pages.
2. Type the certificate name (optional), click **Choose image**, pick a PNG, JPG or WebP file, and click **Upload**.
3. To delete one, click the ✕ on its card.

Images are shrunk to at most 1600px on the longest side before upload. The whole certificate is kept, not cropped.
New certificates appear first. After a change, other visitors may need up to a minute to see it.
The server side is `api/certificates.js`.

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
