const glob = require("glob");
const fs = require("fs");

(async function () {
  const reg = new RegExp(/createLogger\("([\w\\.]+)"\)/, "g");

  const modules = [];

  glob("src/**/*.ts", function (err, files) {
    for (const file of files) {
      const contents = fs.readFileSync(file, "utf-8");
      if (!contents) continue;

      const results = reg.exec(contents);
      if (results && results.length === 2) {
        const moduleName = results[1];

        modules.push(moduleName);
      }
    }

    console.log(modules);
  });
})();
