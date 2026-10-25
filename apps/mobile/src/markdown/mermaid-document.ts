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
  | { type: "size"; height: number }
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
<style>
html,body{margin:0;padding:0;background:transparent}
#diagram svg{display:block;max-width:100%;height:auto;margin:0 auto}
</style>
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
      var height = Math.ceil(container.getBoundingClientRect().height);
      post({ type: "size", height: height });
    })
    .catch(function () {
      post({ type: "error" });
    });
})();
</script>
</body>
</html>`;
}

export function parseMermaidMessage(data: string): MermaidMessage | null {
  try {
    const message = JSON.parse(data) as Partial<MermaidMessage>;
    if (message.type === "error") return { type: "error" };
    if (
      message.type === "size" &&
      typeof message.height === "number" &&
      message.height > 0
    ) {
      return { type: "size", height: message.height };
    }
  } catch {
    return null;
  }
  return null;
}
