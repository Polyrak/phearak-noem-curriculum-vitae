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

const profileOrb = document.getElementById("profileOrb");

if (profileOrb) {
  const DEFAULT_PHOTO = "assets/images/profile.jpg";
  const PHOTO_API = "/api/photo";
  const PASSWORD_KEY = "portfolio-upload-password";
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

  // Upload is owner-only: open the page as index.html?edit to see the controls.
  const isEditMode = new URLSearchParams(location.search).has("edit");
  photoControls.hidden = !isEditMode;
  if (isEditMode) profileOrb.classList.add("editable");

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

  const sendToServer = async (method, body) => {
    const password = getPassword();
    if (!password) return null;

    const response = await fetch(PHOTO_API, {
      method,
      headers: { "Content-Type": "application/json", "x-upload-password": password },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) forgetPassword();
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  };

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
      const data = await sendToServer("POST", { image: dataUrl });
      if (data) showPhoto(data.url);
    } catch (error) {
      alert(`Upload failed: ${error.message}`);
    }
  });

  photoReset.addEventListener("click", async () => {
    if (!confirm("Remove the profile photo for everyone?")) return;
    try {
      const data = await sendToServer("DELETE");
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
