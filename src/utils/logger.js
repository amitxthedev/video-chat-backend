function logger(message, type = "info") {
  const time = new Date().toISOString();

  if (type === "error") {
    console.error(`[${time}] ❌ ${message}`);
  } else if (type === "warn") {
    console.warn(`[${time}] ⚠️ ${message}`);
  } else {
    console.log(`[${time}] ✅ ${message}`);
  }
}

module.exports = logger;
