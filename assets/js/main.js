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

// Job title: every element with data-field="title" shows the same saved text.
const titleFields = document.querySelectorAll('[data-field="title"]');

if (titleFields.length) {
  const SETTINGS_API = "/api/settings";

  const showTitle = (title) => {
    titleFields.forEach((field) => {
      field.textContent = (field.dataset.prefix || "") + title;
    });
  };

  // Once the owner starts editing, a late (or cached) server response must not overwrite their text.
  let titleTouched = false;

  fetch(SETTINGS_API)
    .then((response) => (response.ok ? response.json() : {}))
    .then((data) => {
      if (data.title && !titleTouched) showTitle(data.title);
    })
    .catch(() => {});

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

  // Crop to a centered square and shrink to keep the upload small.
  const resizeImage = (file, size = 600) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const side = Math.min(img.width, img.height);
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          canvas
            .getContext("2d")
            .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
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
      dataUrl = await resizeImage(file);
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
