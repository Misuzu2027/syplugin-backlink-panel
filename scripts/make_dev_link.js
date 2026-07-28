// make_dev_link.js
import fs from "fs";
import {
    log,
    error,
    resolvePluginDir,
    getThisPluginName,
    makeSymbolicLink,
} from "./utils.js";

// 可选：在此手动填写思源工作空间目录，会自动拼接 data/plugins
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

const devDir = `${process.cwd()}/dev`;
if (!fs.existsSync(devDir)) {
    fs.mkdirSync(devDir);
    warnDevBuildNeeded();
}

const name = getThisPluginName();
if (name === null) {
    process.exit(1);
}
const targetPath = `${pluginDir}/${name}`;

const ok = makeSymbolicLink(devDir, targetPath);
process.exit(ok ? 0 : 1);

function warnDevBuildNeeded() {
    log(">>> 已创建空的 dev/ 目录。请先在思源中使用插件前运行 `pnpm dev`。");
}
