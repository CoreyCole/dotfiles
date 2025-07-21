// ~/.finicky.js
export default {
  defaultBrowser: "Zen Browser",
  rewrite: [
    {
      // Open Linear links in the native app
      match: "https://linear.app/*",
      url: (url) => {
        // Convert https://linear.app/... to linear://linear.app/...
        return url.toString().replace("https://", "file://linear://");
      },
    },
  ],
  handlers: [
    {
      // Open Google Meet (Hangouts) links in Arc
      match: "meet.google.com/*",
      browser: "Arc",
    },
  ],
};
