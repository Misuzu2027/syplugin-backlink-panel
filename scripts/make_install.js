// make_install.js
import fs from "fs";
import {
    log,
    error,
    resolvePluginDir,
    copyDirectory,
    getThisPluginName,
} from "./utils.js";

let targetDir = "";

const pluginDir = await resolvePluginDir({ manualTarget: targetDir });
if (!pluginDir) {
    process.exit(1);
}

if (!fs.existsSync(pluginDir)) {
    error(`失败！插件目录不存在: "${pluginDir}"`);
    error("请创建该目录，或修改 scripts/link-config.json");
    process.exit(1);
}

log(`>>> 目标插件目录: ${pluginDir}`);

const distDir = `${process.cwd()}/dist`;
if (!fs.existsSync(distDir)) {
    error("失败！未找到 dist/ 目录，请先运行 `pnpm build`。");
    process.exit(1);
}

const name = getThisPluginName();
if (name === null) {
    process.exit(1);
}
const targetPath = `${pluginDir}/${name}`;

copyDirectory(distDir, targetPath);
