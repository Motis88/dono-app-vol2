function safeJsonParse(jsonString, fallback = null) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

function safeJsonStringify(data, fallback = '[]') {
  try {
    return JSON.stringify(data);
  } catch {
    return fallback;
  }
}

export const storage = {
  getItem(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return fallback;
      return safeJsonParse(item, fallback);
    } catch {
      return fallback;
    }
  },

  setItem(key, value) {
    try {
      localStorage.setItem(key, safeJsonStringify(value));
      return true;
    } catch {
      return false;
    }
  },

  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};
