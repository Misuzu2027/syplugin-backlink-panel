// install_to_workspace.js — build (via npm script) then copy dist into a chosen SiYuan workspace
import fs from "fs";
import {
    log,
    error,
    ask,
    getSiYuanDir,
    chooseTarget,
    getThisPluginName,
    toPluginDir,
    installDistAsPlugin,
} from "./utils.js";

log(">>> 选择工作空间来源:");
log("\t[0] 从正在运行的思源读取 (http://127.0.0.1:6806/api/system/getWorkspaces)");
log("\t[1] 手动输入工作空间目录");

let pluginsDir = "";
const modeAnswer = await ask("\t请选择 [0/1]: ");

if (modeAnswer === "0") {
    log(">>> 正在从思源获取工作空间列表...");
    const workspaces = await getSiYuanDir();
    if (!workspaces || workspaces.length === 0) {
        error(">>> 无法获取工作空间列表，请确认思源已启动，或改用选项 [1] 手动输入目录");
        process.exit(1);
    }
    pluginsDir = await chooseTarget(workspaces);
    if (!pluginsDir) {
        process.exit(1);
    }
} else if (modeAnswer === "1") {
    const workspacePath = await ask("\t请输入工作空间目录（工作空间根路径，含 data 的上一级）: ");
    if (!workspacePath) {
        error(">>> 未输入目录");
        process.exit(1);
    }
    pluginsDir = toPluginDir(workspacePath);
    log(`>>> 插件安装目录: ${pluginsDir}`);
} else {
    error(`>>> 无效选项: "${modeAnswer}"`);
    process.exit(1);
}

if (!fs.existsSync(pluginsDir)) {
    log(`>>> 插件目录不存在，将创建: ${pluginsDir}`);
}

const name = getThisPluginName();
if (name === null) {
    process.exit(1);
}

const distDir = `${process.cwd()}/dist`;
const ok = installDistAsPlugin(distDir, pluginsDir, name);
process.exit(ok ? 0 : 1);
