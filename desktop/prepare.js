// 把網頁版遊戲檔複製到 desktop/app，供 electron-builder 打包。
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const out = path.join(__dirname, "app");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of ["index.html", "js", "css"]) {
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
}
console.log("copied game files to", out);
