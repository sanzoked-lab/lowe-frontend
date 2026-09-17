const DEFAULT_API_BASE = "https://lowe-backend-deepseek-api.vercel.app";
const REQUEST_TIMEOUT_MS = 25000;
const MAX_IMAGE_DIMENSION = 1200;
const MAX_IMAGE_QUALITY = 0.78;

const apiBaseInput = document.querySelector("#api-base-url");
const backendStatus = document.querySelector("#backend-status");

let apiBase = localStorage.getItem("lowe-api-base") || import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE;
if (apiBaseInput) apiBaseInput.value = apiBase;

const setStatus = (message, isOk = true) => {
  if (!backendStatus) return;
  backendStatus.textContent = message;
  backendStatus.style.color = isOk ? "#166534" : "#b42318";
};

const setButtonLoading = (button, isLoading, defaultLabel = "Submit") => {
  if (!button) return;
  button.disabled = isLoading;
  button.dataset.originalText = button.dataset.originalText || button.textContent || defaultLabel;
  button.textContent = isLoading ? "Working…" : button.dataset.originalText;
};

const parseErrorMessage = (error) => {
  if (error?.name === "AbortError") return "Request timed out. Please try again.";
  return error?.message || "Something went wrong.";
};

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeout ?? REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      signal: controller.signal,
      ...options
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const detail = payload?.detail || payload?.error || payload?.message || "Request failed";
      throw new Error(detail);
    }

    return payload;
  } catch (error) {
    throw new Error(parseErrorMessage(error));
  } finally {
    clearTimeout(timer);
  }
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

function getFirstDefinedValue(result, keys = []) {
  if (!result || typeof result !== "object") return result;

  for (const key of keys) {
    const value = result[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return result;
}

function setOutput(id, value) {
  const el = document.querySelector(`#${id}`);
  if (!el) return;
  el.textContent = formatResult(value);
}

async function readOptimizedImage(file) {
  if (!file) return "";

  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    return canvas.toDataURL("image/jpeg", MAX_IMAGE_QUALITY).replace(/^data:image\/jpeg;base64,/, "");
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    const img = new Image();

    reader.onload = () => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const context = canvas.getContext("2d");
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", MAX_IMAGE_QUALITY).replace(/^data:image\/jpeg;base64,/, ""));
      };
      img.onerror = () => reject(new Error("Could not process image"));
      img.src = reader.result;
    };

    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });
}

document.querySelector("#api-base-form")?.addEventListener("submit", (event) => {
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

document.querySelector("#translate-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    direction: formData.get("direction"),
    text: formData.get("text"),
    myLanguage: formData.get("myLanguage")
  };

  const button = event.currentTarget.querySelector("button[type='submit']");
  if (button?.disabled) return;
  setButtonLoading(button, true, "Translate");

  try {
    const result = await fetchJson(`${apiBase}/translate`, {
      method: "POST",
      body: JSON.stringify(payload),
      timeout: REQUEST_TIMEOUT_MS
    });

    const output = getFirstDefinedValue(result, ["translation", "translated", "text", "message"]);
    setOutput("translate-output", output ?? "No translation returned.");
  } catch (error) {
    setOutput("translate-output", `Error: ${parseErrorMessage(error)}`);
  } finally {
    setButtonLoading(button, false, "Translate");
  }
});

document.querySelector("#draft-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    text: formData.get("text"),
    myLanguage: formData.get("myLanguage")
  };

  const button = event.currentTarget.querySelector("button[type='submit']");
  if (button?.disabled) return;
  setButtonLoading(button, true, "Draft");

  try {
    const result = await fetchJson(`${apiBase}/draft`, {
      method: "POST",
      body: JSON.stringify(payload),
      timeout: REQUEST_TIMEOUT_MS
    });

    const output = getFirstDefinedValue(result, ["draft", "message", "text"]);
    setOutput("draft-output", output ?? "No draft returned.");
  } catch (error) {
    setOutput("draft-output", `Error: ${parseErrorMessage(error)}`);
  } finally {
    setButtonLoading(button, false, "Draft");
  }
});

document.querySelector("#image-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const file = formData.get("image");

  if (!file || !file.size) {
    setOutput("image-output", "Please select an image first.");
    return;
  }

  const button = event.currentTarget.querySelector("button[type='submit']");
  if (button?.disabled) return;
  setButtonLoading(button, true, "Translate image");

  try {
    const base64 = await readOptimizedImage(file);

    const result = await fetchJson(`${apiBase}/translate-image`, {
      method: "POST",
      body: JSON.stringify({
        imageBase64: base64,
        myLanguage: formData.get("myLanguage")
      }),
      timeout: REQUEST_TIMEOUT_MS
    });

    const output = getFirstDefinedValue(result, ["translation", "summary", "text", "message"]);
    setOutput("image-output", output ?? "No image translation returned.");
  } catch (error) {
    setOutput("image-output", `Error: ${parseErrorMessage(error)}`);
  } finally {
    setButtonLoading(button, false, "Translate image");
  }
});

document.querySelector("#ask-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    question: formData.get("question"),
    myLanguage: formData.get("myLanguage")
  };

  const button = event.currentTarget.querySelector("button[type='submit']");
  if (button?.disabled) return;
  setButtonLoading(button, true, "Ask");

  try {
    const result = await fetchJson(`${apiBase}/ask`, {
      method: "POST",
      body: JSON.stringify(payload),
      timeout: 30000
    });

    const answer = getFirstDefinedValue(result, ["answer", "response", "message"]) || "No answer returned.";
    const citations = Array.isArray(result?.citations) && result.citations.length
      ? `\n\nSources:\n${result.citations.join("\n")}`
      : "";

    setOutput("ask-output", `${answer}${citations}`);
  } catch (error) {
    setOutput("ask-output", `Error: ${parseErrorMessage(error)}`);
  } finally {
    setButtonLoading(button, false, "Ask");
  }
});

checkBackend();
