const localKey = "hanzi-saint-save";

export function loadLocalSave() {
  try {
    const raw = window.localStorage.getItem(localKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocal(payload) {
  const save = {
    ...payload,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(localKey, JSON.stringify(save));
  return save;
}

export async function loadServerSave() {
  const response = await fetch("/api/save");
  if (!response.ok) {
    throw new Error("无法读取服务端存档");
  }
  return response.json();
}

export async function saveServer(payload) {
  const response = await fetch("/api/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("无法写入服务端存档");
  }
  return response.json();
}
