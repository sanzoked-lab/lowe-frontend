const DEFAULT_API_BASE = "https://lowe-backend-deepseek-api.vercel.app";

const apiBaseInput = document.querySelector("#api-base-url");
const backendStatus = document.querySelector("#backend-status");

let apiBase = localStorage.getItem("lowe-api-base") || import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE;
apiBaseInput.value = apiBase;

const setStatus = (message, isOk = true) => {
  backendStatus.textContent = message;
  backendStatus.style.color = isOk ? "#166534" : "#b42318";
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = payload?.detail || payload?.error || "Request failed";
    throw new Error(detail);
  }

  return payload;
}

async function checkBackend() {
  try {
    const response = await fetch(`${apiBase}/`, { method: "GET" });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || "Unable to reach backend");
    }
    setStatus(`Connected • ${text || "backend is live"}`);
  } catch (error) {
    setStatus(`Disconnected • ${error.message}`, false);
  }
}

function formatResult(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join("\n");
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value ?? "No result");
}

function setOutput(id, value) {
  const el = document.querySelector(`#${id}`);
  if (!el) return;
  el.textContent = formatResult(value);
}

document.querySelector("#api-base-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const nextBase = apiBaseInput.value.trim();
  if (!nextBase) {
    setStatus("Please provide a backend URL", false);
    return;
  }

  apiBase = nextBase.replace(/\/+$/, "");
  localStorage.setItem("lowe-api-base", apiBase);
  setStatus("Backend URL updated");
  checkBackend();
});

document.querySelector("#translate-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    direction: formData.get("direction"),
    text: formData.get("text"),
    myLanguage: formData.get("myLanguage")
  };

  try {
    const result = await fetchJson(`${apiBase}/translate`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setOutput("translate-output", result.translation || result.translated || result);
  } catch (error) {
    setOutput("translate-output", `Error: ${error.message}`);
  }
});

document.querySelector("#draft-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    text: formData.get("text"),
    myLanguage: formData.get("myLanguage")
  };

  try {
    const result = await fetchJson(`${apiBase}/draft`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setOutput("draft-output", result.draft || result.message || result);
  } catch (error) {
    setOutput("draft-output", `Error: ${error.message}`);
  }
});

document.querySelector("#image-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const file = formData.get("image");

  if (!file || !file.size) {
    setOutput("image-output", "Please select an image first.");
    return;
  }

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""));
      reader.onerror = () => reject(new Error("Could not read image file"));
      reader.readAsDataURL(file);
    });

    const result = await fetchJson(`${apiBase}/translate-image`, {
      method: "POST",
      body: JSON.stringify({
        imageBase64: base64,
        myLanguage: formData.get("myLanguage")
      })
    });

    setOutput("image-output", result.translation || result.summary || result);
  } catch (error) {
    setOutput("image-output", `Error: ${error.message}`);
  }
});

document.querySelector("#ask-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    question: formData.get("question"),
    myLanguage: formData.get("myLanguage")
  };

  try {
    const result = await fetchJson(`${apiBase}/ask`, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const answer = result.answer || result;
    const citations = result.citations ? `\n\nSources:\n${result.citations.join("\n")}` : "";
    setOutput("ask-output", `${answer}${citations}`);
  } catch (error) {
    setOutput("ask-output", `Error: ${error.message}`);
  }
});

checkBackend();
