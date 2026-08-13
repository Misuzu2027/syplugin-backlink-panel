// make_install.js — copy ./dist into <workspace>/data/plugins/<pluginName>
import fs from "fs";
import {
    log,
    error,
    resolvePluginDir,
    getThisPluginName,
    installDistAsPlugin,
} from "./utils.js";

let targetDir = "";

const pluginDir = await resolvePluginDir({ manualTarget: targetDir });
if (!pluginDir) {
    process.exit(1);
}

if (!fs.existsSync(pluginDir)) {
    log(`>>> 插件目录不存在，将创建: ${pluginDir}`);
}

const distDir = `${process.cwd()}/dist`;
if (!fs.existsSync(distDir)) {
    error(`构建产物不存在: ${distDir}`);
    error("请先运行 `pnpm build`（或使用 `pnpm make-install`）。");
    process.exit(1);
}

const name = getThisPluginName();
if (name === null) {
    process.exit(1);
}

const ok = installDistAsPlugin(distDir, pluginDir, name);
process.exit(ok ? 0 : 1);
