import {
  MERMAID_THEME_CSS,
  MERMAID_THEME_VARIABLES,
  type MermaidAppearance,
} from "@cocurdex/shared";

export const MERMAID_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/mermaid@11.16.1/dist/mermaid.min.js";

const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  `script-src ${MERMAID_SCRIPT_URL} 'unsafe-inline'`,
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export function allowsMermaidNavigation(url: string) {
  return url === "about:blank";
}

export type MermaidMessage =
  | { type: "rendered"; svg: string; width: number; height: number }
  | { type: "error" };

const FONT_FAMILY = "-apple-system, Roboto, 'Segoe UI', sans-serif";

function scriptValue(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function mermaidDocument(source: string, appearance: MermaidAppearance) {
  const config = {
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    fontFamily: FONT_FAMILY,
    themeCSS: MERMAID_THEME_CSS,
    themeVariables: {
      ...MERMAID_THEME_VARIABLES[appearance],
      fontFamily: FONT_FAMILY,
    },
  };
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
</head>
<body>
<div id="diagram"></div>
<script src="${MERMAID_SCRIPT_URL}"></script>
<script>
(function () {
  var post = function (message) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  };
  if (!window.mermaid) {
    post({ type: "error" });
    return;
  }
  window.mermaid.initialize(${scriptValue(config)});
  window.mermaid
    .render("cocurdex-mermaid", ${scriptValue(source)})
    .then(function (result) {
      var container = document.getElementById("diagram");
      container.innerHTML = result.svg;
      var box = container.querySelector("svg").viewBox.baseVal;
      post({
        type: "rendered",
        svg: container.innerHTML,
        width: box.width,
        height: box.height,
      });
    })
    .catch(function () {
      post({ type: "error" });
    });
})();
</script>
</body>
</html>`;
}

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

const VIEWER_POLICY = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export function mermaidViewerDocument(svg: string, background: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${VIEWER_POLICY}">
<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=4,user-scalable=yes">
<style>
html,body{margin:0;height:100%;background:${background}}
body{display:flex;align-items:center;justify-content:center}
svg{display:block;width:100%;height:auto;max-height:100%}
</style>
</head>
<body>${svg}</body>
</html>`;
}

export function parseMermaidMessage(data: string): MermaidMessage | null {
  try {
    const message = JSON.parse(data) as Partial<MermaidMessage>;
    if (message.type === "error") return { type: "error" };
    if (
      message.type === "rendered" &&
      typeof message.svg === "string" &&
      isPositive(message.width) &&
      isPositive(message.height)
    ) {
      return {
        type: "rendered",
        svg: message.svg,
        width: message.width,
        height: message.height,
      };
    }
  } catch {
    return null;
  }
  return null;
}
