(function () {
  "use strict";

  const rawOptions = window.CoolshinUml || {};
  const options = {
    assetBase: ensureTrailingSlash(rawOptions.assetBase || "/js/"),
    autoRender: rawOptions.autoRender !== false,
    plantumlServer: trimTrailingSlash(
      rawOptions.plantumlServer || "https://www.plantuml.com/plantuml"
    ),
  };

  const aliases = new Map([
    ["plantuml", "plantuml"],
    ["puml", "plantuml"],
    ["uml", "plantuml"],
    ["mermaid", "mermaid"],
    ["dot", "graphviz"],
    ["graphviz", "graphviz"],
    ["flow", "flowchart"],
    ["flowchart", "flowchart"],
    ["wavedrom", "wavedrom"],
    ["wave", "wavedrom"],
  ]);

  const dependencies = {
    plantuml: [
      "vendor/plantuml/synchro2.js",
      "vendor/plantuml/zopfli.raw.min.js",
    ],
    mermaid: ["vendor/mermaid/mermaid.min.js"],
    graphviz: ["vendor/viz/viz.js", "vendor/viz/lite.render.js"],
    flowchart: [
      "vendor/flowchart/raphael.min.js",
      "vendor/flowchart/flowchart.min.js",
    ],
    wavedrom: [
      "vendor/wavedrom/theme-default.js",
      "vendor/wavedrom/wavedrom.min.js",
    ],
  };

  const scriptCache = new Map();
  const state = {
    graphviz: null,
    mermaidReady: false,
    nextId: 1,
    wavedromIndex: 0,
  };

  function ensureTrailingSlash(path) {
    return path.endsWith("/") ? path : path + "/";
  }

  function trimTrailingSlash(path) {
    return path.replace(/\/+$/, "");
  }

  function assetUrl(path) {
    return new URL(path, options.assetBase).toString();
  }

  function errorMessage(error) {
    return error && error.message ? error.message : String(error);
  }

  function loadScript(path) {
    const url = assetUrl(path);
    if (scriptCache.has(url)) {
      return scriptCache.get(url);
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Failed to load " + url));
      document.head.appendChild(script);
    });

    scriptCache.set(url, promise);
    return promise;
  }

  async function loadDependencies(kind) {
    const paths = dependencies[kind] || [];
    for (const path of paths) {
      await loadScript(path);
    }
  }

  function getLanguage(code) {
    const pre = code.closest("pre");
    const candidates = [
      code.getAttribute("data-lang"),
      pre && pre.getAttribute("data-lang"),
      code.className,
      pre && pre.className,
    ].filter(Boolean);

    for (const candidate of candidates) {
      const explicit = String(candidate).trim().toLowerCase();
      if (aliases.has(explicit)) {
        return explicit;
      }

      const match = String(candidate).match(/\b(?:language|lang)-([^\s]+)/i);
      if (match) {
        return match[1].toLowerCase();
      }
    }

    const source = code.textContent.trimStart();
    if (/^@start(?:uml|mindmap|wbs|gantt|salt|json|yaml|ditaa|jcckit)/i.test(source)) {
      return "plantuml";
    }

    return "";
  }

  function collectCodeBlocks(root) {
    const scope = root || document;
    return Array.from(scope.querySelectorAll("pre > code"))
      .map((code) => {
        const lang = getLanguage(code);
        const kind = aliases.get(lang);
        return kind ? { code, kind, lang } : null;
      })
      .filter(Boolean);
  }

  function createFigure(kind, lang) {
    const figure = document.createElement("figure");
    figure.className = "uml-diagram uml-diagram--" + kind;
    figure.dataset.umlKind = kind;
    figure.dataset.umlLang = lang;

    const stage = document.createElement("div");
    stage.className = "uml-diagram__stage";
    figure.appendChild(stage);

    return { figure, stage };
  }

  function replacePre(code, figure) {
    const pre = code.closest("pre");
    if (!pre || !pre.parentNode) {
      return false;
    }

    pre.parentNode.replaceChild(figure, pre);
    return true;
  }

  function showError(stage, message, source) {
    const error = document.createElement("div");
    error.className = "uml-diagram__error";
    error.textContent = message;
    stage.replaceChildren(error);

    if (source) {
      const details = document.createElement("details");
      details.className = "uml-diagram__source";
      const summary = document.createElement("summary");
      summary.textContent = "查看 UML 源码";
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = source;
      pre.appendChild(code);
      details.append(summary, pre);
      stage.appendChild(details);
    }
  }

  function normalizePlantUmlSource(source) {
    if (/^\s*@start/i.test(source)) {
      return source;
    }
    return "@startuml\n" + source.trim() + "\n@enduml";
  }

  function encodePlantUml(source) {
    if (!window.Zopfli || !window.Zopfli.RawDeflate || !window.encode64_) {
      throw new Error("PlantUML encoder is not available");
    }

    const utf8 = unescape(encodeURIComponent(source));
    const bytes = [];
    for (let i = 0; i < utf8.length; i += 1) {
      bytes.push(utf8.charCodeAt(i));
    }

    const compressed = new window.Zopfli.RawDeflate(bytes).compress();
    return window.encode64_(compressed);
  }

  async function renderPlantUml(item) {
    await loadDependencies("plantuml");

    const source = normalizePlantUmlSource(item.code.textContent);
    const { figure, stage } = createFigure("plantuml", item.lang);
    const img = document.createElement("img");
    img.alt = "PlantUML diagram";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = options.plantumlServer + "/svg/" + encodePlantUml(source);
    img.onerror = () => {
      showError(stage, "PlantUML 图渲染失败。", source);
    };
    stage.appendChild(img);
    replacePre(item.code, figure);
  }

  async function ensureMermaid() {
    await loadDependencies("mermaid");
    if (!window.mermaid) {
      throw new Error("Mermaid is not available");
    }

    if (!state.mermaidReady) {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "default",
      });
      state.mermaidReady = true;
    }
  }

  async function renderMermaid(item) {
    await ensureMermaid();

    const source = item.code.textContent;
    const { figure, stage } = createFigure("mermaid", item.lang);
    const id = "uml-mermaid-" + state.nextId++;

    try {
      const result = await window.mermaid.render(id, source);
      stage.innerHTML = typeof result === "string" ? result : result.svg || "";
      if (!stage.firstElementChild) {
        throw new Error("Mermaid returned empty SVG");
      }
      replacePre(item.code, figure);
    } catch (error) {
      replacePre(item.code, figure);
      showError(stage, "Mermaid 图渲染失败：" + errorMessage(error), source);
    }
  }

  async function renderGraphviz(item) {
    await loadDependencies("graphviz");
    if (!window.Viz) {
      throw new Error("Viz.js is not available");
    }

    if (!state.graphviz) {
      state.graphviz = new window.Viz();
    }

    const source = item.code.textContent;
    const { figure, stage } = createFigure("graphviz", item.lang);

    try {
      const svg = await state.graphviz.renderSVGElement(source);
      stage.appendChild(svg);
      replacePre(item.code, figure);
    } catch (error) {
      state.graphviz = new window.Viz();
      replacePre(item.code, figure);
      showError(stage, "Graphviz 图渲染失败：" + errorMessage(error), source);
    }
  }

  async function renderFlowchart(item) {
    await loadDependencies("flowchart");
    if (!window.flowchart) {
      throw new Error("Flowchart.js is not available");
    }

    const source = item.code.textContent;
    const { figure, stage } = createFigure("flowchart", item.lang);
    const target = document.createElement("div");
    target.id = "uml-flowchart-" + state.nextId++;
    stage.appendChild(target);

    replacePre(item.code, figure);

    try {
      const graph = window.flowchart.parse(source);
      graph.drawSVG(target.id);
    } catch (error) {
      showError(stage, "Flowchart 图渲染失败：" + errorMessage(error), source);
    }
  }

  function parseWaveDrom(source) {
    return Function('"use strict"; return (' + source + ");")();
  }

  async function renderWaveDrom(item) {
    await loadDependencies("wavedrom");
    if (!window.WaveDrom) {
      throw new Error("WaveDrom is not available");
    }

    const source = item.code.textContent;
    const { figure, stage } = createFigure("wavedrom", item.lang);
    const idx = state.wavedromIndex++;
    const prefix = "uml-wavedrom-";
    stage.id = prefix + idx;

    replacePre(item.code, figure);

    try {
      window.WaveDrom.RenderWaveForm(idx, parseWaveDrom(source), prefix);
    } catch (error) {
      showError(stage, "WaveDrom 图渲染失败：" + errorMessage(error), source);
    }
  }

  async function renderItem(item) {
    const pre = item.code.closest("pre");
    if (!pre || pre.dataset.umlRendered === "true") {
      return;
    }
    pre.dataset.umlRendered = "true";

    try {
      if (item.kind === "plantuml") {
        await renderPlantUml(item);
      } else if (item.kind === "mermaid") {
        await renderMermaid(item);
      } else if (item.kind === "graphviz") {
        await renderGraphviz(item);
      } else if (item.kind === "flowchart") {
        await renderFlowchart(item);
      } else if (item.kind === "wavedrom") {
        await renderWaveDrom(item);
      }
    } catch (error) {
      const { figure, stage } = createFigure(item.kind, item.lang);
      replacePre(item.code, figure);
      showError(stage, "UML 图渲染失败：" + errorMessage(error), item.code.textContent);
    }
  }

  function renderAll(root) {
    const blocks = collectCodeBlocks(root);
    blocks.forEach((item) => {
      renderItem(item);
    });
  }

  window.CoolshinUml = Object.assign(rawOptions, {
    renderAll,
  });

  if (options.autoRender) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => renderAll(document));
    } else {
      renderAll(document);
    }
  }
})();
