importScripts('lute.min.js');

let lute = null;

self.onmessage = function(e) {
  const { text, options } = e.data;
  
  if (!lute) {
    lute = Lute.New();
    // Default configuration to match Vditor's behavior
    lute.SetHeadingAnchor(true);
    lute.SetToC(true);
    lute.SetIndentCodeBlock(true);
    lute.SetGFMAutoLink(true);
    lute.SetSanitize(false); // Trust local content usually
  }

  // Parse and render
  // Note: MarkdownStr signature might vary, usually it is (name, content)
  const html = lute.MarkdownStr("", text);
  
  self.postMessage({ html });
};
