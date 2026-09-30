import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

// Local checks for this deliberately small extension, not a full Chrome schema.
// No packages, browser access, network requests, or extension installation.
const extensionRoot = new URL("../extension/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("manifest.json", extensionRoot), "utf8"),
);

assert.equal(manifest.manifest_version, 3, "Manifest V3 is required");
assert.equal(typeof manifest.name, "string");
assert.ok(manifest.name.length > 0 && manifest.name.length <= 75);
assert.equal(typeof manifest.version, "string");
assert.match(manifest.version, /^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,3}$/);
const versionParts = manifest.version.split(".").map(Number);
assert.ok(versionParts.every((part) => part <= 65535));
assert.ok(versionParts.some((part) => part > 0));
assert.equal(typeof manifest.description, "string");
assert.ok(manifest.description.length > 0 && manifest.description.length <= 132);

// Expanding these allowlists requires an intentional review of permissions.
assert.deepEqual(Object.keys(manifest).sort(), [
  "content_scripts", "description", "manifest_version", "name", "version",
]);
assert.ok(Array.isArray(manifest.content_scripts));
assert.equal(manifest.content_scripts.length, 1);
const contentScript = manifest.content_scripts[0];
assert.deepEqual(Object.keys(contentScript).sort(), [
  "all_frames", "css", "js", "matches", "run_at", "world",
]);
assert.deepEqual(contentScript.matches, ["https://fairfaxll.assignr.com/*"]);
assert.equal(contentScript.all_frames, false);
assert.equal(contentScript.run_at, "document_idle");
assert.equal(contentScript.world, "ISOLATED");
assert.deepEqual(contentScript.js, ["staffing.js", "overflow.js", "content.js"]);
assert.deepEqual(contentScript.css, ["content.css"]);
assert.ok((await readFile(new URL("content.css", extensionRoot), "utf8")).trim());

for (const file of contentScript.js) {
  const source = await readFile(new URL(file, extensionRoot), "utf8");
  // Parse as a classic content script without executing it.
  new Script(source, { filename: file });
}

console.log("PASS: Manifest V3 fields, Fairfax-only scope, referenced files, and JavaScript syntax.");
console.log("Chrome loading and logged-in calendar behavior require separate manual verification.");
