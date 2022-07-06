const { spawn } = require("child_process");
const consola = require("consola");
const fs = require("fs");

class Package {
  constructor(contents) {
    try {
      this.contents = JSON.parse(contents);
    } catch (error) {
      this.contents = null;
    }
  }

  isValid() {
    return this.contents !== null;
  }

  hasPeerDependencies() {
    return this.contents.peerDependencies !== undefined;
  }

  get peerDependencies() {
    return this.contents.peerDependencies || [];
  }

  get peerInstallOptions() {
    return this.contents.peerInstallOptions || {};
  }
}

(async function () {
  if (process.env.SKIP_POSTINSTALL) process.exit(0);

  fs.readFile("package.json", "utf-8", function (error, contents) {
    if (!contents) {
      return consola.error("There doesn't seem to be a package.json here");
    }

    const packageContents = new Package(contents);

    if (!packageContents.isValid()) {
      return consola.error("Invalid package.json contents");
    }

    if (!packageContents.hasPeerDependencies()) {
      return consola.warn("This package doesn't seem to have any peerDependencies");
    }

    const peerDependencies = packageContents.peerDependencies;

    const packages = Object.keys(peerDependencies).map(function (key) {
      return `${key}@${peerDependencies[key]}`;
    });

    spawn(`yarn`, ["add", "--peer", "--no-lockfile", ...packages], {
      detached: true,
      stdio: "inherit",
    });
  });

  process.env.SKIP_POSTINSTALL = "true";
})();
