"use strict";
(function bootWindowsSimulatorV6() {
  const required = ["openApp","applyState","renderRecommended","buildExplorerV5","buildSettingsV5","buildServices","buildDiskManagement","buildPowerShell"];
  const missing = required.filter((name) => typeof globalThis[name] !== "function");
  globalThis.Win11SimDiagnostics = {
    version: "6.0.0",
    run() {
      return {
        version: "6.0.0",
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
  setTimeout(() => {
    document.getElementById("boot")?.classList.add("hidden");
    document.getElementById("lock")?.classList.remove("hidden");
  }, 1000);
})();
