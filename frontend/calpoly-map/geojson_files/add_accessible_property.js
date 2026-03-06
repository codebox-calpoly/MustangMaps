const fs = require("fs");
const path = require("path");

const filePath = path.resolve(__dirname, "paths.geojson");

function normalize(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

function classifyAccessible(properties = {}) {
  const highway = normalize(properties.highway);
  const wheelchair = normalize(properties.wheelchair);
  const rampWheelchair = normalize(properties["ramp:wheelchair"]);
  const stroller = normalize(properties.stroller);
  const surface = normalize(properties.surface);

  if (wheelchair === "yes" || rampWheelchair === "yes") {
    return true;
  }

  if (wheelchair === "no" || wheelchair === "limited") {
    return false;
  }

  if (stroller === "no" || stroller === "limited") {
    return false;
  }

  if (highway === "steps") {
    return false;
  }

  if (["dirt", "gravel", "unpaved", "ground", "compacted", "mud", "sand"].includes(surface)) {
    return false;
  }

  return true;
}

const raw = fs.readFileSync(filePath, "utf8");
const geojson = JSON.parse(raw);

let accessibleCount = 0;
let inaccessibleCount = 0;

for (const feature of geojson.features) {
  if (!feature.properties || typeof feature.properties !== "object") {
    feature.properties = {};
  }

  const accessible = classifyAccessible(feature.properties);
  feature.properties.accessible = accessible;

  if (accessible) {
    accessibleCount += 1;
  } else {
    inaccessibleCount += 1;
  }
}

fs.writeFileSync(filePath, `${JSON.stringify(geojson, null, 2)}\n`, "utf8");

console.log(
  `Updated ${geojson.features.length} path features. accessible=true: ${accessibleCount}, accessible=false: ${inaccessibleCount}`,
);
