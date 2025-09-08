// ~/.finicky.js
export default {
  defaultBrowser: "Zen Browser",
  handlers: [
    {
      // Open Google Meet (Hangouts) links in Arc
      match: "meet.google.com/*",
      browser: "Arc",
    },
    {
      match: "https://teams.microsoft.com/*",
      browser: "Arc",
    },
  ],
};
