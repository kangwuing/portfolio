// Compatibility shim for visitors who still have the former TOEIC homepage HTML cached.
// The current portfolio homepage does not load this file.
const refreshedUrl = new URL("./", import.meta.url);
refreshedUrl.searchParams.set("portfolio-version", "20260820-2");

if (window.location.href !== refreshedUrl.toString()) {
  window.location.replace(refreshedUrl.toString());
}
