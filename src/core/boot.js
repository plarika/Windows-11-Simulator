"use strict";
(function bootWindowsSimulatorV6() {
  const required = ["openApp","applyState","renderRecommended","buildExplorerV5","buildSettingsV5","buildServices","buildDiskManagement","buildPowerShell"];
  const missing = required.filter((name) => typeof globalThis[name] !== "function");
  globalThis.Win11SimDiagnostics = {
    version: "7.8.0",
    run() {
      return {
        version: "7.8.0",
        missingFunctions: required.filter((name) => typeof globalThis[name] !== "function"),
        windowCount: document.querySelectorAll(".window").length,
        currentDesktop: Number(state.currentDesktop) || 0,
      };
    },
  };
  if (missing.length) {
    console.error("[V6] Missing modules:", missing);
    const boot = document.getElementById("boot");
    if (boot) boot.innerHTML = "<h2>Falha ao iniciar V6</h2><p>Consulte a consola.</p>";
    return;
  }
  state.desktops = Array.isArray(state.desktops) && state.desktops.length ? state.desktops : ["Ambiente 1"];
  state.currentDesktop = clamp(Number(state.currentDesktop) || 0, 0, state.desktops.length - 1);
  applyState();
  renderRecommended();

  const sessionBoot = globalThis.Win11SessionManager?.handleBootComplete
    ? Promise.resolve().then(() => globalThis.Win11SessionManager.handleBootComplete())
    : Promise.resolve(false);

  setTimeout(async () => {
    let sessionHandled = false;
    try {
      await sessionBoot;
      sessionHandled = Boolean(globalThis.Win11SessionManager);
    } catch (err) {
      console.error("[V7.8.0] Session boot failed", err);
    }
    if (!sessionHandled) {
      document.getElementById("lock")?.classList.remove("hidden");
    }
    document.getElementById("boot")?.classList.add("hidden");
  }, 650);
})();

