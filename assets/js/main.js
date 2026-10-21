// Shared parts (header, footer, edit bar) are set up once. Page content (inside <main>) is set up by
// initPage(), which runs on first load and again after every in-page navigation (see "Navigation").

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

// Owner-only editing: open the site as /edit or index.html?edit to change the photo and title.
const isEditMode = location.pathname.replace(/\/+$/, "") === "/edit" || new URLSearchParams(location.search).has("edit");
const PASSWORD_KEY = "portfolio-upload-password";

// Stay in edit mode when moving between pages.
const keepEditMode = (root) => {
  if (!isEditMode) return;
  root.querySelectorAll('a[href$=".html"]').forEach((link) => {
    link.href = `${link.getAttribute("href")}?edit`;
  });
};

keepEditMode(document);

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
// The resolved object is kept up to date after saves, so pages opened later see the new values.
const SETTINGS_API = "/api/settings";
const settingsLoaded = fetch(SETTINGS_API)
  .then((response) => (response.ok ? response.json() : {}))
  .catch(() => ({}));

const rememberSettings = (data) => settingsLoaded.then((settings) => Object.assign(settings, data));

// Certificates menu: shown on every page only when turned on (switch in the edit bar).
const certNavItem = document.getElementById("certNavItem");

const showCertificatesMenu = (visible) => {
  if (certNavItem) certNavItem.hidden = !visible;
};

settingsLoaded.then((settings) => showCertificatesMenu(settings.showCertificates === true));

// Edit mode: a small bar on every page with the switch that turns the Certificates menu on or off.
if (isEditMode) {
  const editBar = document.createElement("div");
  editBar.className = "edit-bar";
  editBar.innerHTML = `
    <strong>Edit mode</strong>
    <label class="cert-visibility">
      <input type="checkbox" disabled />
      <span class="switch" aria-hidden="true"></span>
      <span class="cert-visibility-text">Certificates menu: loading…</span>
    </label>`;
  document.body.append(editBar);

  const toggle = editBar.querySelector("input");
  const text = editBar.querySelector(".cert-visibility-text");

  const showVisibility = (visible) => {
    toggle.checked = visible;
    text.textContent = `Certificates menu: ${visible ? "on" : "off"}`;
    showCertificatesMenu(visible);
  };

  settingsLoaded.then((settings) => {
    showVisibility(settings.showCertificates === true);
    toggle.disabled = false;
  });

  toggle.addEventListener("change", async () => {
    const visible = toggle.checked;
    toggle.disabled = true;
    try {
      const data = await sendToServer(SETTINGS_API, "POST", { showCertificates: visible });
      if (data) rememberSettings(data);
      showVisibility(data ? data.showCertificates : !visible);
    } catch (error) {
      showVisibility(!visible);
      alert(`Save failed: ${error.message}`);
    } finally {
      toggle.disabled = false;
    }
  });
}

// ----- Page content -----

// Years of experience counts up each new year from the start year (2026 -> 9, 2027 -> 10, ...).
const initYearsExperience = () => {
  const yearsExperience = document.getElementById("yearsExperience");
  if (!yearsExperience) return;

  const startYear = Number(yearsExperience.dataset.startYear);
  yearsExperience.textContent = new Date().getFullYear() - startYear;
};

// Job title: every element with data-field="title" shows the same saved text.
const initTitle = () => {
  const titleFields = document.querySelectorAll('[data-field="title"]');
  if (!titleFields.length) return;

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

  if (!isEditMode) return;

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
          rememberSettings(data);
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
};

const initProfilePhoto = () => {
  const profileOrb = document.getElementById("profileOrb");
  if (!profileOrb) return;

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
};

// Certificates gallery: everyone can view; edit mode can upload and delete.
const initCertificates = () => {
  const certGrid = document.getElementById("certGrid");
  if (!certGrid) return;

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

  if (!isEditMode) return;

  certUpload.hidden = false;

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
};

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  },
  { threshold: 0.12 }
);

const initReveal = () => {
  document.querySelectorAll("main .reveal").forEach((item) => revealObserver.observe(item));
};

const initPage = () => {
  initYearsExperience();
  initTitle();
  initProfilePhoto();
  initCertificates();
  initReveal();
};

initPage();

// ----- Navigation -----
// Menu links load only the new page's <main> instead of reloading the whole page,
// so the header, footer and edit bar stay in place. Falls back to a normal page load if anything fails.

const isPageLink = (link) =>
  link.origin === location.origin &&
  /\.html$/.test(link.pathname) &&
  !link.target &&
  !link.hasAttribute("download");

const setActiveNavLink = (url) => {
  const page = new URL(url).pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((link) => {
    const linkPage = new URL(link.href).pathname.split("/").pop();
    link.classList.toggle("active", linkPage === (page === "edit" ? "index.html" : page));
  });
};

let navigationId = 0;

const navigate = async (url, { push = true } = {}) => {
  const id = ++navigationId;

  let html;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(response.statusText);
    html = await response.text();
  } catch {
    location.href = url;
    return;
  }
  // A newer click started while this page was loading.
  if (id !== navigationId) return;

  const nextDocument = new DOMParser().parseFromString(html, "text/html");
  const nextMain = nextDocument.querySelector("main");
  if (!nextMain) {
    location.href = url;
    return;
  }

  const swap = () => {
    revealObserver.disconnect();
    document.querySelector("main").replaceWith(document.adoptNode(nextMain));

    // Replace <title> and the description so the tab title (and its data-field) match the new page.
    const nextTitle = nextDocument.querySelector("title");
    if (nextTitle) document.querySelector("title").replaceWith(document.adoptNode(nextTitle));
    const nextDescription = nextDocument.querySelector('meta[name="description"]');
    const description = document.querySelector('meta[name="description"]');
    if (nextDescription && description) description.content = nextDescription.content;

    keepEditMode(document.querySelector("main"));
    setActiveNavLink(url);
    initPage();
  };

  if (push) history.pushState({}, "", url);

  if (document.startViewTransition) {
    document.startViewTransition(swap);
  } else {
    swap();
  }
};

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const link = event.target.closest("a[href]");
  if (!link || !isPageLink(link)) return;

  event.preventDefault();
  navLinks.classList.remove("open");
  if (link.href === location.href) return;
  navigate(link.href);
});

window.addEventListener("popstate", () => navigate(location.href, { push: false }));
