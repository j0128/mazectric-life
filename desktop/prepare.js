// 把網頁版遊戲檔複製到 desktop/app，供 electron-builder 打包。
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const out = path.join(__dirname, "app");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of ["index.html", "js", "css", "assets"]) {
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
}
// 桌面版圖示：electron-builder 讀 build/icon.ico，視窗用 icon.png
const build = path.join(__dirname, "build");
fs.mkdirSync(build, { recursive: true });
fs.copyFileSync(path.join(root, "assets", "icon.ico"), path.join(build, "icon.ico"));
fs.copyFileSync(path.join(root, "assets", "icon.png"), path.join(build, "icon.png"));
console.log("copied game files to", out);
