#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ASSET_FILES = ["main.js", "manifest.json", "styles.css"];

function log(msg) {
  console.log(`\x1b[36m[VicSync Release]\x1b[0m ${msg}`);
}

function errorExit(msg) {
  console.error(`\x1b[31m[VicSync Release Error]\x1b[0m ${msg}`);
  process.exit(1);
}

function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim();

  try {
    const creds = execSync("printf 'protocol=https\\nhost=github.com\\n\\n' | git credential fill", {
      stdio: ["pipe", "pipe", "ignore"],
    }).toString();
    const match = creds.match(/password=(.*)/);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  } catch (err) {
    // ignore
  }

  errorExit(
    "Could not obtain a GitHub token. Either ensure your git credentials are saved or set GITHUB_TOKEN=... in your environment."
  );
}

function getRepoInfo() {
  try {
    const remoteUrl = execSync("git remote get-url origin", { stdio: ["pipe", "pipe", "ignore"] })
      .toString()
      .trim();
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch (err) {
    // ignore
  }
  return { owner: "victor-chan-dev", repo: "VicSync-Obsidian" };
}

function parseSemver(v) {
  const parts = v.replace(/^v/, "").split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

function calculateNextVersion(currentVersion, bumpType) {
  if (!bumpType) return currentVersion;
  const semver = parseSemver(currentVersion);
  if (!semver) {
    errorExit(`Cannot auto-bump non-semver version: ${currentVersion}`);
  }

  if (bumpType === "patch") {
    return `${semver.major}.${semver.minor}.${semver.patch + 1}`;
  }
  if (bumpType === "minor") {
    return `${semver.major}.${semver.minor + 1}.0`;
  }
  if (bumpType === "major") {
    return `${semver.major + 1}.0.0`;
  }

  // Explicit version string
  if (/^\d+\.\d+\.\d+$/.test(bumpType.replace(/^v/, ""))) {
    return bumpType.replace(/^v/, "");
  }

  errorExit(`Invalid version argument: "${bumpType}". Use patch, minor, major, or a version number (e.g. 0.5.26).`);
}

function updateVersionFiles(newVersion) {
  log(`Updating version files to ${newVersion}...`);

  // 1. manifest.json
  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  manifest.version = newVersion;
  fs.writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

  // 2. manifest-beta.json (if exists)
  if (fs.existsSync("manifest-beta.json")) {
    const manifestBeta = JSON.parse(fs.readFileSync("manifest-beta.json", "utf8"));
    manifestBeta.version = newVersion;
    fs.writeFileSync("manifest-beta.json", JSON.stringify(manifestBeta, null, 2) + "\n");
  }

  // 3. package.json
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  pkg.version = newVersion;
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

  // 4. versions.json (map plugin version to minAppVersion)
  if (fs.existsSync("versions.json")) {
    const versions = JSON.parse(fs.readFileSync("versions.json", "utf8"));
    versions[newVersion] = manifest.minAppVersion || "0.13.21";
    fs.writeFileSync("versions.json", JSON.stringify(versions, null, 2) + "\n");
  }
}

function buildPlugin() {
  log("Building plugin bundle (npm run build2)...");
  try {
    execSync("node esbuild.config.mjs production", { stdio: "inherit" });
  } catch (err) {
    errorExit("Build failed! Check esbuild output above.");
  }

  for (const file of ASSET_FILES) {
    if (!fs.existsSync(file)) {
      errorExit(`Required release asset missing: ${file}`);
    }
  }
  const mainStat = fs.statSync("main.js");
  log(`Build successful! main.js size: ${(mainStat.size / 1024 / 1024).toFixed(2)} MB`);
}

function commitAndTag(version) {
  log(`Committing and creating git tag "${version}"...`);
  try {
    execSync("git add manifest.json manifest-beta.json package.json versions.json", { stdio: "inherit" });
    const status = execSync("git status --porcelain").toString();
    if (status.includes("manifest.json") || status.includes("package.json")) {
      execSync(`git commit -m "chore: release ${version}"`, { stdio: "inherit" });
      execSync("git push origin master", { stdio: "inherit" });
    }
    // Tag
    const existingTags = execSync("git tag -l").toString().split("\n");
    if (!existingTags.includes(version)) {
      execSync(`git tag -a "${version}" -m "Release ${version}"`, { stdio: "inherit" });
      execSync(`git push origin "${version}"`, { stdio: "inherit" });
      log(`Git tag "${version}" pushed successfully.`);
    } else {
      log(`Git tag "${version}" already exists locally.`);
    }
  } catch (err) {
    console.warn(`Warning during git commit/tag: ${err.message}`);
  }
}

async function githubApi(endpoint, token, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `https://api.github.com${endpoint}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "VicSync-Releaser",
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  return res;
}

async function getOrCreateRelease(owner, repo, tag, token) {
  log(`Checking for existing release for tag "${tag}"...`);
  const checkRes = await githubApi(`/repos/${owner}/${repo}/releases/tags/${tag}`, token);

  if (checkRes.status === 200) {
    const release = await checkRes.json();
    log(`Found existing release: "${release.name || release.tag_name}" (ID: ${release.id})`);
    return release;
  }

  log(`Creating new release for tag "${tag}"...`);
  const createRes = await githubApi(`/repos/${owner}/${repo}/releases`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: tag,
      name: tag,
      body: `### VicSync ${tag}\n\nAutomated release of **VicSync** for Obsidian.\n\nIncluded assets:\n- \`main.js\`\n- \`manifest.json\`\n- \`styles.css\`\n\nInstall via BRAT or copy assets to \`.obsidian/plugins/vicsync/\`.`,
      draft: false,
      prerelease: false,
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    errorExit(`Failed to create release: HTTP ${createRes.status} - ${errText}`);
  }

  const release = await createRes.json();
  log(`Created release successfully: ${release.html_url}`);
  return release;
}

async function uploadAssets(owner, repo, release, token) {
  const uploadUrlBase = release.upload_url.replace(/\{.*\}/, "");

  // Delete existing matching assets to avoid conflicts
  if (Array.isArray(release.assets) && release.assets.length > 0) {
    for (const asset of release.assets) {
      if (ASSET_FILES.includes(asset.name)) {
        log(`Replacing existing asset "${asset.name}" (ID: ${asset.id})...`);
        const delRes = await githubApi(`/repos/${owner}/${repo}/releases/assets/${asset.id}`, token, {
          method: "DELETE",
        });
        if (!delRes.ok && delRes.status !== 404) {
          console.warn(`Warning: Could not delete old asset ${asset.name}: HTTP ${delRes.status}`);
        }
      }
    }
  }

  // Upload fresh assets
  for (const filename of ASSET_FILES) {
    log(`Uploading asset: ${filename}...`);
    const fileContent = fs.readFileSync(filename);
    const contentType = filename.endsWith(".json")
      ? "application/json"
      : filename.endsWith(".css")
      ? "text/css"
      : "application/javascript";

    const uploadUrl = `${uploadUrlBase}?name=${encodeURIComponent(filename)}`;
    const uploadRes = await githubApi(uploadUrl, token, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileContent.length.toString(),
      },
      body: fileContent,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      errorExit(`Failed to upload ${filename}: HTTP ${uploadRes.status} - ${errText}`);
    }

    const uploadedData = await uploadRes.json();
    log(`✓ Uploaded ${uploadedData.name} (${(uploadedData.size / 1024).toFixed(1)} KB)`);
  }
}

async function main() {
  const bumpArg = process.argv[2]; // patch, minor, major, 0.5.26, or undefined
  const { owner, repo } = getRepoInfo();
  log(`Repository: ${owner}/${repo}`);

  const currentManifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  const currentVersion = currentManifest.version;
  log(`Current manifest version: ${currentVersion}`);

  let targetVersion = currentVersion;
  const isBumping = bumpArg && bumpArg !== "current" && bumpArg !== "--no-bump";

  if (isBumping) {
    targetVersion = calculateNextVersion(currentVersion, bumpArg);
    updateVersionFiles(targetVersion);
  }

  // Always build to ensure fresh bundle
  buildPlugin();

  const token = getGitHubToken();

  if (isBumping) {
    commitAndTag(targetVersion);
  }

  const release = await getOrCreateRelease(owner, repo, targetVersion, token);
  await uploadAssets(owner, repo, release, token);

  console.log("");
  console.log(`\x1b[32m✔ Release ${targetVersion} successfully published!\x1b[0m`);
  console.log(`\x1b[36mRelease URL:\x1b[0m ${release.html_url}`);
  console.log(`\x1b[36mBRAT Plugin Repo:\x1b[0m ${owner}/${repo}`);
}

main().catch((err) => {
  errorExit(err.stack || err.message);
});
