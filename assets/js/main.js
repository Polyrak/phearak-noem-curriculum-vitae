const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
const themeToggle = document.getElementById("themeToggle");
const year = document.getElementById("year");

year.textContent = new Date().getFullYear();

const savedTheme = localStorage.getItem("portfolio-theme");
if (savedTheme === "light") {
  document.body.classList.add("light");
  themeToggle.textContent = "☀️";
}

menuToggle.addEventListener("click", () => {
  navLinks.classList.toggle("open");
});

document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
  });
});

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light");

  const isLight = document.body.classList.contains("light");
  themeToggle.textContent = isLight ? "☀️" : "🌙";
  localStorage.setItem("portfolio-theme", isLight ? "light" : "dark");
});

document.querySelectorAll('.footer a[href="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    document.querySelector("main").scrollTo({ top: 0 });
  });
});

// Years of experience counts up each new year from the start year (2026 -> 9, 2027 -> 10, ...).
const yearsExperience = document.getElementById("yearsExperience");

if (yearsExperience) {
  const startYear = Number(yearsExperience.dataset.startYear);
  yearsExperience.textContent = new Date().getFullYear() - startYear;
}

// Owner-only editing: open the site as /edit or index.html?edit to change the photo and title.
const isEditMode = location.pathname.replace(/\/+$/, "") === "/edit" || new URLSearchParams(location.search).has("edit");
const PASSWORD_KEY = "portfolio-upload-password";

// Stay in edit mode when moving between pages.
if (isEditMode) {
  document.querySelectorAll('a[href$=".html"]').forEach((link) => {
    link.href = `${link.getAttribute("href")}?edit`;
  });
}

// Shrink an image file to a JPEG data URL so uploads stay small.
//   square: crop to a centered square of `size` px (profile photo)
//   otherwise: keep the whole image, longest side at most `size` px (certificates)
const resizeImage = (file, { size, square = false }) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (square) {
          const side = Math.min(img.width, img.height);
          canvas.width = size;
          canvas.height = size;
          context.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        } else {
          const scale = Math.min(1, size / Math.max(img.width, img.height));
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          // White background so transparent PNGs don't turn black as JPEG.
          context.fillStyle = "#fff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
        }

        resolve(canvas.toDataURL("image/jpeg", square ? 0.85 : 0.9));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

// Only the owner knows the upload password; keep it for this tab so it is asked once.
const getPassword = () => {
  try {
    const saved = sessionStorage.getItem(PASSWORD_KEY);
    if (saved) return saved;
  } catch {}
  const entered = prompt("Enter upload password:");
  if (entered) {
    try {
      sessionStorage.setItem(PASSWORD_KEY, entered);
    } catch {}
  }
  return entered;
};

const forgetPassword = () => {
  try {
    sessionStorage.removeItem(PASSWORD_KEY);
  } catch {}
};

const sendToServer = async (url, method, body) => {
  const password = getPassword();
  if (!password) return null;

  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "x-upload-password": password },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) forgetPassword();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
};

// Site settings (job title, Certificates menu), loaded once and shared by every page.
const SETTINGS_API = "/api/settings";
const settingsLoaded = fetch(SETTINGS_API)
  .then((response) => (response.ok ? response.json() : {}))
  .catch(() => ({}));

// Certificates menu: shown on every page only when turned on (switch on certificates.html?edit).
const certNavItem = document.getElementById("certNavItem");

const showCertificatesMenu = (visible) => {
  if (certNavItem) certNavItem.hidden = !visible;
};

settingsLoaded.then((settings) => showCertificatesMenu(settings.showCertificates === true));

// Job title: every element with data-field="title" shows the same saved text.
const titleFields = document.querySelectorAll('[data-field="title"]');

if (titleFields.length) {
  const showTitle = (title) => {
    titleFields.forEach((field) => {
      field.textContent = (field.dataset.prefix || "") + title;
    });
  };

  // Once the owner starts editing, a late (or cached) server response must not overwrite their text.
  let titleTouched = false;

  settingsLoaded.then((settings) => {
    if (settings.title && !titleTouched) showTitle(settings.title);
  });

  if (isEditMode) {
    // The <title> tag can't be edited on the page; it just follows the visible fields.
    titleFields.forEach((field) => {
      if (field.closest("head")) return;

      field.contentEditable = "plaintext-only";
      field.spellcheck = false;
      field.classList.add("editable-text");
      field.title = "Click to edit. Enter to save, Esc to cancel.";

      let original = field.textContent;
      field.addEventListener("focus", () => {
        titleTouched = true;
        original = field.textContent;
      });

      field.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          field.blur();
        } else if (event.key === "Escape") {
          field.textContent = original;
          field.blur();
        }
      });

      field.addEventListener("blur", async () => {
        // Copy now: the password prompt can hand focus back and reset `original` mid-save.
        const previous = original;
        const title = field.textContent.replace(/\s+/g, " ").trim();
        if (!title || title === previous) {
          field.textContent = previous;
          return;
        }

        try {
          const data = await sendToServer(SETTINGS_API, "POST", { title });
          if (data) {
            showTitle(data.title);
          } else {
            field.textContent = previous;
          }
        } catch (error) {
          field.textContent = previous;
          alert(`Save failed: ${error.message}`);
        }
      });
    });
  }
}

const profileOrb = document.getElementById("profileOrb");

if (profileOrb) {
  const DEFAULT_PHOTO = "assets/images/profile.jpg";
  const PHOTO_API = "/api/photo";
  const profilePhoto = document.getElementById("profilePhoto");
  const photoControls = document.getElementById("photoControls");
  const photoInput = document.getElementById("photoInput");
  const photoReset = document.getElementById("photoReset");

  const showPhoto = (src) => {
    profilePhoto.src = src || DEFAULT_PHOTO;
    photoReset.hidden = !src;
  };

  profilePhoto.addEventListener("load", () => profileOrb.classList.add("has-photo"));
  profilePhoto.addEventListener("error", () => profileOrb.classList.remove("has-photo"));

  // Load the shared photo from the server; fall back to the local file if the API is unavailable.
  fetch(PHOTO_API)
    .then((response) => (response.ok ? response.json() : { url: null }))
    .then((data) => showPhoto(data.url))
    .catch(() => showPhoto(null));

  photoControls.hidden = !isEditMode;
  if (isEditMode) profileOrb.classList.add("editable");

  // Clicking the circle opens the file picker (skip clicks from the buttons themselves).
  profileOrb.addEventListener("click", (event) => {
    if (!isEditMode || event.target.closest("#photoControls")) return;
    photoInput.click();
  });

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    photoInput.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }

    let dataUrl;
    try {
      dataUrl = await resizeImage(file, { size: 600, square: true });
    } catch {
      alert("Could not read that image. Please try another file.");
      return;
    }

    try {
      const data = await sendToServer(PHOTO_API, "POST", { image: dataUrl });
      if (data) showPhoto(data.url);
    } catch (error) {
      alert(`Upload failed: ${error.message}`);
    }
  });

  photoReset.addEventListener("click", async () => {
    if (!confirm("Remove the profile photo for everyone?")) return;
    try {
      const data = await sendToServer(PHOTO_API, "DELETE");
      if (data) showPhoto(null);
    } catch (error) {
      alert(`Remove failed: ${error.message}`);
    }
  });
}

// Certificates gallery: everyone can view; edit mode can upload and delete.
const certGrid = document.getElementById("certGrid");

if (certGrid) {
  const CERT_API = "/api/certificates";
  const certEmpty = document.getElementById("certEmpty");
  const certUpload = document.getElementById("certUpload");
  const certTitle = document.getElementById("certTitle");
  const certFile = document.getElementById("certFile");
  const certFileName = document.getElementById("certFileName");
  const certSubmit = document.getElementById("certSubmit");

  const updateEmpty = () => {
    certEmpty.hidden = certGrid.children.length > 0;
  };

  const createCard = (certificate) => {
    const card = document.createElement("article");
    card.className = "cert-card";

    const link = document.createElement("a");
    link.href = certificate.url;
    link.target = "_blank";
    link.rel = "noopener";

    const image = document.createElement("img");
    image.src = certificate.url;
    image.alt = certificate.title || "Certificate";
    image.loading = "lazy";
    link.append(image);
    card.append(link);

    if (certificate.title) {
      const title = document.createElement("h3");
      title.textContent = certificate.title;
      card.append(title);
    }

    if (isEditMode) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "photo-btn cert-delete";
      remove.title = "Delete certificate";
      remove.textContent = "✕";
      remove.addEventListener("click", async () => {
        if (!confirm(`Delete "${certificate.title || "this certificate"}" for everyone?`)) return;
        try {
          const data = await sendToServer(CERT_API, "DELETE", { id: certificate.id });
          if (data) {
            card.remove();
            updateEmpty();
          }
        } catch (error) {
          alert(`Delete failed: ${error.message}`);
        }
      });
      card.append(remove);
    }

    return card;
  };

  fetch(CERT_API)
    .then((response) => (response.ok ? response.json() : { certificates: [] }))
    .catch(() => ({ certificates: [] }))
    .then((data) => {
      certGrid.replaceChildren(...data.certificates.map(createCard));
      updateEmpty();
    });

  if (isEditMode) {
    certUpload.hidden = false;

    // Switch that shows or hides the Certificates menu for visitors.
    const certVisibility = document.getElementById("certVisibility");
    const certVisibilityToggle = document.getElementById("certVisibilityToggle");
    const certVisibilityText = document.getElementById("certVisibilityText");

    const showVisibility = (visible) => {
      certVisibilityToggle.checked = visible;
      certVisibilityText.textContent = visible
        ? "Certificates menu is visible to visitors"
        : "Certificates menu is hidden from visitors";
      showCertificatesMenu(visible);
    };

    certVisibility.hidden = false;
    certVisibilityToggle.disabled = true;
    settingsLoaded.then((settings) => {
      showVisibility(settings.showCertificates === true);
      certVisibilityToggle.disabled = false;
    });

    certVisibilityToggle.addEventListener("change", async () => {
      const visible = certVisibilityToggle.checked;
      certVisibilityToggle.disabled = true;
      try {
        const data = await sendToServer(SETTINGS_API, "POST", { showCertificates: visible });
        showVisibility(data ? data.showCertificates : !visible);
      } catch (error) {
        showVisibility(!visible);
        alert(`Save failed: ${error.message}`);
      } finally {
        certVisibilityToggle.disabled = false;
      }
    });

    certFile.addEventListener("change", () => {
      certFileName.textContent = certFile.files[0]?.name || "Choose image";
    });

    certUpload.addEventListener("submit", async (event) => {
      event.preventDefault();

      const file = certFile.files[0];
      if (!file) {
        alert("Please choose an image first.");
        return;
      }
      if (!file.type.startsWith("image/")) {
        alert("Please choose an image file.");
        return;
      }

      let dataUrl;
      try {
        dataUrl = await resizeImage(file, { size: 1600 });
      } catch {
        alert("Could not read that image. Please try another file.");
        return;
      }

      certSubmit.disabled = true;
      certSubmit.textContent = "Uploading…";
      try {
        const data = await sendToServer(CERT_API, "POST", { image: dataUrl, title: certTitle.value });
        if (data) {
          certGrid.prepend(createCard(data.certificate));
          updateEmpty();
          certUpload.reset();
          certFileName.textContent = "Choose image";
        }
      } catch (error) {
        alert(`Upload failed: ${error.message}`);
      } finally {
        certSubmit.disabled = false;
        certSubmit.textContent = "Upload";
      }
    });
  }
}

const revealItems = document.querySelectorAll(".reveal");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  },
  { threshold: 0.12 }
);

revealItems.forEach((item) => observer.observe(item));
