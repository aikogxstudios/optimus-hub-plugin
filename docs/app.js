/* ============================================================
   Optimus Hub — app.js
   Interactions: simulated terminal typing, interactive replay,
   centralized dynamic version sync, interactive 6-stage flow
   diagram, and clipboard copy with fallback.
   No dependencies · 100% offline · Respects prefers-reduced-motion.
   ============================================================ */

(function () {
  "use strict";

  var REDUCED_MOTION = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------
     1. Centralized Version Management
     Single source of truth: ensures the original Optimus Hub version
     is propagated to the terminal session banner, CTA buttons,
     code snippets and footer upon load and whenever updated.
     ---------------------------------------------------------- */
  function syncVersion() {
    var brandVerEl = document.getElementById("brand-version") || document.querySelector(".brand .version");
    var currentVer = (brandVerEl && brandVerEl.textContent.trim()) || "v0.2.0";
    if (!currentVer.startsWith("v")) currentVer = "v" + currentVer;

    function applyVersion(ver) {
      // Terminal session banner: original Optimus Hub version
      var bannerVerEl = document.getElementById("t-banner-version");
      if (bannerVerEl) {
        bannerVerEl.textContent = "Optimus Hub " + ver + " · tty1";
      }

      // Terminal execution log ref
      var termRefEl = document.getElementById("t-term-ref");
      if (termRefEl) {
        termRefEl.textContent = ver;
      }

      // Direct install code and copy button
      var directCodeEl = document.getElementById("install-cmd-direct");
      var directBtn = document.getElementById("copy-direct");
      var directUrl = "https://github.com/aikogxstudios/optimus-hub-plugin#" + ver;
      if (directCodeEl) directCodeEl.textContent = directUrl;
      if (directBtn) directBtn.setAttribute("data-copy", directUrl);

      // Hero install button
      var heroInstallBtn = document.getElementById("hero-install-btn") || document.querySelector(".hero-actions .btn-primary");
      if (heroInstallBtn) {
        heroInstallBtn.textContent = "Install " + ver;
      }

      // Header brand version
      if (brandVerEl) {
        brandVerEl.textContent = ver;
      }

      // Footer version
      var footerVerEl = document.getElementById("footer-version");
      if (footerVerEl) {
        footerVerEl.textContent = ver;
      }
    }

    applyVersion(currentVer);

    // If served over HTTP during development, attempt reading package.json automatically
    if (window.location.protocol.startsWith("http")) {
      try {
        fetch("./package.json")
          .then(function (res) { return res.json(); })
          .then(function (pkg) {
            if (pkg && pkg.version) {
              var parsedVer = "v" + pkg.version.replace(/^v/, "");
              applyVersion(parsedVer);
            }
          })
          .catch(function () {});
      } catch (err) {}
    }
  }

  /* ----------------------------------------------------------
     2. Simulated terminal: type the install command, show the flow
     ---------------------------------------------------------- */
  function initTerminal() {
    var cmdEl = document.getElementById("t-cmd");
    var cursorEl = document.getElementById("t-cursor");
    var outLines = document.querySelectorAll(".terminal .t-out");
    var replayBtn = document.getElementById("term-replay");
    var statusLabel = document.getElementById("term-status-label");
    if (!cmdEl) return;

    // Full CLI command illustrating adding the marketplace source.
    var commandText = "orca plugins add optimus-hub";

    var typeTimer = null;
    var staggerTimers = [];

    function clearTimers() {
      if (typeTimer) window.clearTimeout(typeTimer);
      staggerTimers.forEach(function (t) { window.clearTimeout(t); });
      staggerTimers = [];
    }

    function showOutputImmediate() {
      if (cursorEl) cursorEl.style.display = "none";
      outLines.forEach(function (line) {
        line.hidden = false;
      });
      if (statusLabel) statusLabel.textContent = "ACTIVE";
    }

    function runAnimation() {
      clearTimers();
      cmdEl.textContent = "";
      if (cursorEl) cursorEl.style.display = "inline-block";
      outLines.forEach(function (line) {
        line.hidden = true;
      });
      if (statusLabel) statusLabel.textContent = "VERIFYING";

      if (REDUCED_MOTION || typeof requestAnimationFrame !== "function") {
        cmdEl.textContent = commandText;
        showOutputImmediate();
        return;
      }

      var i = 0;
      var typeDelayMs = 20;
      var pauseBeforeOutputMs = 220;
      var lineStaggerMs = 150;

      function typeNext() {
        if (i <= commandText.length) {
          cmdEl.textContent = commandText.slice(0, i);
          i += 1;
          typeTimer = window.setTimeout(typeNext, typeDelayMs);
        } else {
          typeTimer = window.setTimeout(function () {
            if (cursorEl) cursorEl.style.display = "none";
            outLines.forEach(function (line, index) {
              var t = window.setTimeout(function () {
                line.hidden = false;
                if (index === outLines.length - 1 && statusLabel) {
                  statusLabel.textContent = "ACTIVE";
                }
              }, index * lineStaggerMs);
              staggerTimers.push(t);
            });
          }, pauseBeforeOutputMs);
        }
      }

      typeTimer = window.setTimeout(typeNext, 300);
    }

    if (replayBtn) {
      replayBtn.addEventListener("click", function () {
        runAnimation();
      });
    }

    runAnimation();
  }

  /* ----------------------------------------------------------
     3. Copy buttons: clipboard + accessible confirmation
     ---------------------------------------------------------- */
  function initCopyButtons() {
    var buttons = document.querySelectorAll("button[data-copy]");
    var status = document.getElementById("copy-status");
    if (!buttons.length || !status) return;

    var statusTimer = null;

    function setStatus(message, isError) {
      status.textContent = message;
      status.classList.toggle("is-error", Boolean(isError));
      if (statusTimer) window.clearTimeout(statusTimer);
      if (!isError) {
        statusTimer = window.setTimeout(function () {
          status.textContent = "";
        }, 4500);
      }
    }

    function fallbackCopy(text) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "-9999px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (err) {
        ok = false;
      }
      document.body.removeChild(textarea);
      return ok;
    }

    function copyText(text, btnElement) {
      var originalText = btnElement ? btnElement.textContent : "";

      function onSuccess() {
        setStatus("Copied to clipboard: " + text, false);
        if (btnElement) {
          btnElement.textContent = "✔ Copied!";
          window.setTimeout(function () {
            btnElement.textContent = originalText;
          }, 2000);
        }
      }

      function onFailure() {
        if (fallbackCopy(text)) {
          onSuccess();
        } else {
          setStatus("Copy failed. Please select the URL and copy manually.", true);
        }
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(text).then(onSuccess, onFailure);
      } else {
        if (fallbackCopy(text)) {
          onSuccess();
        } else {
          setStatus("Copy failed. Please select the URL and copy manually.", true);
        }
      }
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var textToCopy = btn.getAttribute("data-copy") || "";
        copyText(textToCopy, btn);
      });
    });
  }

  /* ----------------------------------------------------------
     4. How It Works: interactive 6-stage vertical flow
        - One button per stage with aria-pressed (one active at a time)
        - Detail panel below is aria-live="polite" and shows: what
          happens, who runs it, what it can and cannot do, and the
          real technical fact.
        - Keyboard: Enter/Space (native), ArrowUp/ArrowDown, Home, End
        - Roving tabindex: only the active stage is tabbable
     ---------------------------------------------------------- */
  var FLOW_STAGES = {
    index: {
      tag: "STAGE 01 · INDEX",
      owner: "RUN BY: ORCA (HOST)",
      fields: [
        ["What happens", "Orca resolves the marketplace index from a Git repository. Each entry points to a plugin repository and a pinned ref, so every listing is reproducible."],
        ["Run by", "Orca (host). The plugin is not installed or running yet at this stage."],
        ["Can", "Read-only Git resolution of the index and its named refs."],
        ["Cannot", "Execute or ingest any code. Indexing never activates anything."],
        ["Tech fact", "Index file: <code>orca-marketplace.json</code> · installs resolve to a pinned Git ref."]
      ]
    },
    validate: {
      tag: "STAGE 02 · VALIDATE",
      owner: "RUN BY: ORCA (HOST)",
      fields: [
        ["What happens", "The plugin manifest is validated against the schema and every file in the tree is content-hashed before anything is installed."],
        ["Run by", "Orca (host)."],
        ["Can", "Check manifest versions, engines and paths, and verify the SHA-256 content hash of the whole tree."],
        ["Cannot", "Install a mismatch. A failed validation or a different hash stops the install."],
        ["Tech fact", "<code>pluginApi 1</code> manifests validated with zod · the whole file tree is content-hashed."]
      ]
    },
    consent: {
      tag: "STAGE 03 · CONSENT",
      owner: "RUN BY: ORCA · USER DECIDES",
      fields: [
        ["What happens", "Orca shows the requested capabilities verbatim and asks for explicit approval before the plugin can be enabled."],
        ["Run by", "Orca prompts; the user decides. The plugin cannot prompt on its own behalf."],
        ["Can", "Grant only the three declared capabilities: <code>workspace:read</code>, <code>notifications:show</code>, <code>terminal:send</code>."],
        ["Cannot", "Enable a plugin silently or widen its capabilities after consent."],
        ["Tech fact", "Requested capabilities: <code>workspace:read</code> · <code>notifications:show</code> · <code>terminal:send</code>."]
      ]
    },
    panel: {
      tag: "STAGE 04 · PANEL",
      owner: "RUN BY: PLUGIN (SANDBOXED)",
      fields: [
        ["What happens", "The panel UI loads inside a sandboxed iframe as a single self-contained HTML file, with no external assets."],
        ["Run by", "The plugin renders; Orca hosts the frame and enforces the sandbox."],
        ["Can", "Render its interface and respond to user input."],
        ["Cannot", "Reach the network or the disk. The panel CSP is <code>connect-src 'none'</code>."],
        ["Tech fact", "One inlined HTML file · CSP <code>connect-src none</code> · no network, no disk."]
      ]
    },
    "host-api": {
      tag: "STAGE 05 · HOST API",
      owner: "PLUGIN REQUESTS · ORCA ENFORCES",
      fields: [
        ["What happens", "The panel talks to Orca only through postMessage RPC. Exactly three actions are available to panels, nothing else."],
        ["Run by", "The plugin requests; Orca checks capability, consent and rate limits, then executes."],
        ["Can", "Call <code>workspace.readContext</code>, <code>notifications.show</code> and <code>terminal.sendText</code>."],
        ["Cannot", "Call any other method. Unknown methods are rejected by the host."],
        ["Tech fact", "<code>pluginApi 1</code> · three panel actions: <code>workspace.readContext</code> · <code>notifications.show</code> · <code>terminal.sendText</code>."]
      ]
    },
    terminal: {
      tag: "STAGE 06 · TERMINAL",
      owner: "PLUGIN SENDS · ORCA TYPES",
      fields: [
        ["What happens", "With the user watching, the chosen command is typed into one specific terminal and Enter is pressed only after explicit confirmation."],
        ["Run by", "The plugin sends the text; Orca types it into the terminal the user selected; the user confirms first."],
        ["Can", "Type an official command such as <code>orca skills install --skill &lt;id&gt; --global</code> into the selected terminal."],
        ["Cannot", "Spawn terminals, pick a terminal on its own, or read back arbitrary output."],
        ["Tech fact", "<code>terminal:send</code> capability · audited mutation: every <code>sendText</code> is logged by the host."]
      ]
    }
  };

  function initFlowDiagram() {
    var list = document.getElementById("flow-steps");
    var tagEl = document.getElementById("flow-panel-tag");
    var ownerEl = document.getElementById("flow-panel-owner");
    var detailEl = document.getElementById("flow-detail");
    if (!list || !tagEl || !ownerEl || !detailEl) return;

    var buttons = Array.prototype.slice.call(list.querySelectorAll(".flow-btn"));
    if (!buttons.length) return;
    var order = buttons.map(function (btn) {
      return btn.getAttribute("data-step");
    });
    var current = order[0];

    function fieldHtml(label, value) {
      return '<div class="flow-field"><dt>' + label + "</dt><dd>" + value + "</dd></div>";
    }

    function renderStage(stageId) {
      var stage = FLOW_STAGES[stageId];
      if (!stage) return;
      tagEl.textContent = stage.tag;
      ownerEl.textContent = stage.owner;
      detailEl.innerHTML = stage.fields
        .map(function (pair) {
          return fieldHtml(pair[0], pair[1]);
        })
        .join("");
    }

    function setStage(stageId, focusButton) {
      if (order.indexOf(stageId) === -1) return;
      current = stageId;
      buttons.forEach(function (btn) {
        var isActive = btn.getAttribute("data-step") === stageId;
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
        btn.tabIndex = isActive ? 0 : -1;
        var item = btn.parentNode;
        if (item && item.classList) {
          item.classList.toggle("is-current", isActive);
        }
      });
      renderStage(stageId);
      if (focusButton) {
        var idx = order.indexOf(stageId);
        if (idx !== -1) buttons[idx].focus();
      }
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setStage(btn.getAttribute("data-step"), false);
      });
    });

    // Keyboard support: ArrowUp/ArrowDown and ArrowLeft/ArrowRight move between stages,
    // Home/End jump to the first/last stage. Enter and Space
    // activate the focused button natively.
    list.addEventListener("keydown", function (event) {
      var idx = order.indexOf(current);
      var next = null;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        next = order[(idx + 1) % order.length];
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        next = order[(idx - 1 + order.length) % order.length];
      } else if (event.key === "Home") {
        next = order[0];
      } else if (event.key === "End") {
        next = order[order.length - 1];
      }
      if (next !== null) {
        event.preventDefault();
        setStage(next, true);
      }
    });

    // Sync state with the static first-stage markup rendered without JS.
    setStage(current, false);
  }

  /* ----------------------------------------------------------
     Boot
     ---------------------------------------------------------- */
  function init() {
    syncVersion();
    initTerminal();
    initCopyButtons();
    initFlowDiagram();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
