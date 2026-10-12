#!/usr/bin/env node

/** Decode the data:application/json;base64 URI returned by CampusMemo.tokenURI. */
const uri = process.argv[2];
const prefix = "data:application/json;base64,";

if (!uri) {
  console.error("Usage: npm run metadata:decode -- 'data:application/json;base64,...'");
  process.exit(1);
}
if (!uri.startsWith(prefix)) {
  console.error("The value must start with data:application/json;base64,");
  process.exit(1);
}

try {
  const json = Buffer.from(uri.slice(prefix.length), "base64").toString("utf8");
  console.log(JSON.stringify(JSON.parse(json), null, 2));
} catch (error) {
  console.error(`Invalid base64 JSON token URI: ${error.message}`);
  process.exit(1);
}
