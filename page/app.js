(() => {
  "use strict";

  const defaults = { baseUrl: "", apiKey: "" };
  try {
    // The sandbox's origin is null, but its document URL is still real.
    const pageUrl = new URL(location.href);
    if (["http:", "https:"].includes(pageUrl.protocol) && pageUrl.pathname.includes("/_magpie/plugin/")) {
      defaults.baseUrl = pageUrl.origin;
    }
  } catch {
    // No usable document URL: require an explicit address, never loopback.
  }
  const baseInput = document.getElementById("base-url");
  const keyInput = document.getElementById("api-key");
  const settings = document.getElementById("settings");
  const saveButton = document.getElementById("save-options");
  const copyButton = document.getElementById("copy-command");
  const copyStatus = document.getElementById("copy-status");
  const settingsStatus = document.getElementById("settings-status");
  const manualCopy = document.getElementById("manual-copy");
  const manualText = document.getElementById("manual-text");
  let options = {};
  let command = "";

  function feedback(element, message, state = "") {
    element.textContent = message;
    element.dataset.state = state;
  }

  // Quote shell metacharacters literally, including in proxy URLs and keys.
  function shellValue(value) {
    return /^[A-Za-z0-9_@%+=:,./-]+$/.test(value)
      ? value
      : "'" + value.replace(/'/g, "'\"'\"'") + "'";
  }

  function validate(baseUrl, apiKey) {
    if (!baseUrl) {
      throw new Error("无法自动识别网关地址，请在连接配置填写 HTTP(S) URL。");
    }
    if (typeof baseUrl !== "string" || /[\r\n\0]/.test(baseUrl)) {
      throw new Error("网关地址必须是单行 HTTP(S) URL。");
    }
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error("网关地址必须使用 http:// 或 https://。");
    }
    if (!apiKey) {
      throw new Error("请填写网关密钥（Gateway Key），不是网页登录密钥。");
    }
    if (typeof apiKey !== "string" || /[\r\n\0]/.test(apiKey)) {
      throw new Error("API 密钥不能为空，也不能包含换行或空字符。");
    }
  }

  function render() {
    const baseUrl = options.baseUrl ?? defaults.baseUrl;
    const apiKey = options.apiKey ?? defaults.apiKey;
    baseInput.value = baseUrl;
    keyInput.value = apiKey;
    command = "";
    copyButton.disabled = true;
    document.getElementById("command").textContent = "请在连接配置填写有效的网关地址和密钥（Gateway Key）";
    try {
      validate(baseUrl, apiKey);
    } catch (error) {
      document.querySelector("details").open = true;
      feedback(copyStatus, error.message, "error");
      return;
    }
    command = `ANTHROPIC_BASE_URL=${shellValue(baseUrl)} ANTHROPIC_API_KEY=${shellValue(apiKey)} claude`;
    document.getElementById("command").textContent = command;
    copyButton.disabled = false;
    manualCopy.hidden = true;
    manualText.value = "";
    feedback(copyStatus, "就绪。复制这一行命令即可启动 Claude Code。");
  }

  function legacyCopy(text) {
    const previousFocus = document.activeElement;
    const buffer = document.createElement("textarea");
    buffer.value = text;
    buffer.readOnly = true;
    buffer.className = "copy-buffer";
    buffer.tabIndex = -1;
    buffer.setAttribute("aria-hidden", "true");
    document.body.append(buffer);
    try {
      buffer.focus({ preventScroll: true });
      buffer.select();
      buffer.setSelectionRange(0, buffer.value.length);
      return document.execCommand("copy");
    } finally {
      buffer.remove();
      previousFocus?.focus({ preventScroll: true });
    }
  }

  async function copy(text) {
    manualCopy.hidden = true;
    manualText.value = "";
    try {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        if (!legacyCopy(text)) throw new Error("Copy was refused");
      }
      feedback(copyStatus, "已复制命令。请粘贴到终端运行。", "success");
    } catch {
      feedback(copyStatus, "复制失败：浏览器限制了剪贴板。请在下方手动复制。", "error");
      manualCopy.hidden = false;
      manualText.value = text;
      manualText.focus();
      manualText.select();
    }
  }

  copyButton.addEventListener("click", () => {
    void copy(command);
  });

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    try {
      const baseUrl = baseInput.value.trim();
      const apiKey = keyInput.value;
      validate(baseUrl, apiKey);
      const nextOptions = { ...options, apiKey };
      if (baseUrl === defaults.baseUrl) delete nextOptions.baseUrl;
      else nextOptions.baseUrl = baseUrl;
      options = await magpie.options.set(nextOptions);
      render();
      feedback(copyStatus, "命令已更新，可以复制。", "success");
      feedback(settingsStatus, "配置已保存。", "success");
    } catch (error) {
      feedback(settingsStatus, `保存失败：${error.message}`, "error");
    } finally {
      // Magpie permits options.set at most once per second.
      setTimeout(() => { saveButton.disabled = false; }, 1000);
    }
  });

  async function init() {
    try {
      await magpie.ready;
      options = await magpie.options.get();
      settings.disabled = false;
      render();
    } catch {
      feedback(copyStatus, "配置加载失败：请在 Magpie 中重新打开此页面；若配置无效，请在连接配置中修正。", "error");
    }
  }
  void init();
})();
