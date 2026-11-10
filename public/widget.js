(function () {
  const script = document.currentScript;
  const origin = script && script.src ? new URL(script.src).origin : "";
  document.querySelectorAll("[data-hall-ledger]").forEach((node) => {
    const slug = node.getAttribute("data-hall-ledger");
    if (!slug || !/^[a-z0-9-]{3,40}$/.test(slug)) return;
    const frame = document.createElement("iframe");
    frame.title = "Free rooms";
    frame.src = origin + "/" + slug + "/embed";
    frame.style.border = "0";
    frame.style.width = "100%";
    frame.style.minHeight = "280px";
    frame.style.background = "#000";
    node.appendChild(frame);
  });
})();
