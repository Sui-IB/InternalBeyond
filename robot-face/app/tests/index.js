// 入口：让 `node --test app/tests/` 在新旧版本的 Node 上都能跑到全部 *.test.js。
// （Node 22 起 --test 后面跟目录时不再自动搜索，而是把目录当模块加载，于是会加载到这个文件。）
'use strict';
const fs = require('node:fs');
const path = require('node:path');
for (const f of fs.readdirSync(__dirname).sort()) {
  if (f.endsWith('.test.js')) require(path.join(__dirname, f));
}
