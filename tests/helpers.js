const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');

// Load the real TypeScript modules while substituting the VS Code host/network.
function loader(mocks = {}) {
  const cache = new Map();
  function load(name) {
    const file = path.resolve(__dirname, '../src', name + '.ts');
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = esbuild.transformSync(fs.readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs', target: 'node18' }).code;
    const localRequire = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('.')) return load(id.slice(2));
      return require(id);
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
}

function host(settings = {}) {
  return { workspace: { getConfiguration: () => ({ get: (key, fallback) => settings[key] ?? fallback }) } };
}
module.exports = { loader, host };
