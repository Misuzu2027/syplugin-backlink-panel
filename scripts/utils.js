import fs from "fs";
import path from "node:path";
import http from "node:http";
import readline from "node:readline";

const LINK_CONFIG_PATH = path.join(process.cwd(), "scripts", "link-config.json");
const LINK_CONFIG_EXAMPLE_PATH = path.join(process.cwd(), "scripts", "link-config.example.json");

export const log = (info) => console.log(`\x1B[36m%s\x1B[0m`, info);
export const error = (info) => console.log(`\x1B[31m%s\x1B[0m`, info);
export const warn = (info) => console.log(`\x1B[33m%s\x1B[0m`, info);

export const POST_HEADER = {
    "Content-Type": "application/json",
};

export async function myfetch(url, options) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, options, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    json: () => JSON.parse(data),
                });
            });
        });
        req.on("error", (e) => {
            reject(e);
        });
        req.end();
    });
}

export function loadLinkConfig() {
    if (!fs.existsSync(LINK_CONFIG_PATH)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(LINK_CONFIG_PATH, "utf8"));
    } catch (e) {
        error(`解析配置文件失败 ${LINK_CONFIG_PATH}: ${e.message}`);
        return null;
    }
}

export function saveLinkConfig(workspaceDir) {
    fs.writeFileSync(
        LINK_CONFIG_PATH,
        JSON.stringify({ workspaceDir: path.resolve(workspaceDir) }, null, 2) + "\n",
        "utf8"
    );
    log(`已保存工作空间目录到 ${LINK_CONFIG_PATH}`);
}

function cleanPath(input) {
    return input.trim().replace(/^["']|["']$/g, "");
}

function isPluginDir(dir) {
    return dir.replace(/\\/g, "/").replace(/\/+$/, "").endsWith("/data/plugins");
}

/** 从任意输入中提取工作空间根目录 */
export function getWorkspaceDir(input) {
    let dir = path.resolve(cleanPath(input));
    const normalized = dir.replace(/\\/g, "/").replace(/\/+$/, "");
    if (normalized.endsWith("/data/plugins")) {
        return path.resolve(normalized.replace(/\/data\/plugins$/, ""));
    }
    return dir;
}

/** 将工作空间目录转换为插件目录，自动拼接 data/plugins */
export function toPluginDir(input) {
    const dir = path.resolve(cleanPath(input));

    if (isPluginDir(dir)) {
        return dir;
    }

    const workspaceDir = getWorkspaceDir(input);
    const pluginsDir = path.join(workspaceDir, "data", "plugins");
    log(`>>> 工作空间: ${workspaceDir}`);
    log(`>>> 自动拼接插件目录: ${pluginsDir}`);
    return pluginsDir;
}

/** @deprecated 使用 toPluginDir */
export function normalizePluginDir(input) {
    return toPluginDir(input);
}

function getConfigWorkspaceDir(config) {
    if (config?.workspaceDir) {
        return config.workspaceDir;
    }
    if (config?.pluginDir) {
        return getWorkspaceDir(config.pluginDir);
    }
    return null;
}

export function printResolveHelp() {
    warn("\n无法自动获取思源插件目录。");
    warn("你可以通过以下任一方式配置：\n");
    warn("  1. 启动思源后重新运行此命令（通过 API 自动检测）");
    warn("  2. 复制 scripts/link-config.example.json 为 scripts/link-config.json，填写 workspaceDir");
    warn("  3. 设置环境变量 SIYUAN_PLUGIN_DIR（填工作空间目录即可，会自动拼接 data/plugins）");
    warn("  4. 在下方手动输入工作空间目录（会自动拼接 data/plugins）\n");
    if (fs.existsSync(LINK_CONFIG_EXAMPLE_PATH)) {
        warn(`  配置示例: ${LINK_CONFIG_EXAMPLE_PATH}`);
    }
}

export async function ask(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const answer = await new Promise((resolve) => {
        rl.question(question, resolve);
    });
    rl.close();
    return answer.trim();
}

export async function promptPluginDir() {
    printResolveHelp();
    const answer = await ask("\t请输入思源工作空间目录: ");
    if (!answer) {
        error("未输入路径。");
        return null;
    }
    return {
        workspaceDir: getWorkspaceDir(answer),
        pluginDir: toPluginDir(answer),
    };
}

async function promptSaveConfig() {
    const answer = await ask("\t是否保存此路径到 scripts/link-config.json，以便下次直接使用？[Y/n]: ");
    return answer === "" || answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

export async function resolvePluginDir(options = {}) {
    const { manualTarget = "" } = options;

    if (manualTarget) {
        log(`>>> 使用手动配置的 targetDir: ${manualTarget}`);
        return toPluginDir(manualTarget);
    }

    const config = loadLinkConfig();
    const workspaceFromConfig = getConfigWorkspaceDir(config);
    if (workspaceFromConfig) {
        log(`>>> 从 scripts/link-config.json 读取工作空间: ${workspaceFromConfig}`);
        return toPluginDir(workspaceFromConfig);
    }

    log(">>> 尝试自动获取思源工作空间（需要思源正在运行）...");
    const workspaces = await getSiYuanDir();
    if (workspaces?.length > 0) {
        return await chooseTarget(workspaces);
    }

    const env = process.env?.SIYUAN_PLUGIN_DIR;
    if (env) {
        log(`>>> 从环境变量 SIYUAN_PLUGIN_DIR 读取: ${env}`);
        return toPluginDir(env);
    }

    const result = await promptPluginDir();
    if (!result) {
        return null;
    }

    const { workspaceDir, pluginDir } = result;
    if (await promptSaveConfig()) {
        saveLinkConfig(workspaceDir);
    }

    return pluginDir;
}

export async function getSiYuanDir() {
    const url = "http://127.0.0.1:6806/api/system/getWorkspaces";
    try {
        const response = await myfetch(url, {
            method: "POST",
            headers: POST_HEADER,
        });
        if (!response.ok) {
            error(`\tHTTP 请求失败: ${response.status}`);
            return null;
        }
        const conf = await response.json();
        return conf?.data;
    } catch (e) {
        error(`\t无法连接思源 API (127.0.0.1:6806): ${e.message}`);
        error("\t请确认思源已启动，或配置 scripts/link-config.json");
        return null;
    }
}

export async function chooseTarget(workspaces) {
    const count = workspaces.length;
    log(`>>> 检测到 ${count} 个思源工作空间`);
    workspaces.forEach((workspace, i) => {
        log(`\t[${i}] ${workspace.path}`);
    });

    if (count === 1) {
        return `${workspaces[0].path}/data/plugins`;
    }

    const index = await ask(`\t请选择工作空间 [0-${count - 1}]: `);
    const workspace = workspaces[Number(index)];
    if (!workspace) {
        error(`无效的选择: ${index}`);
        return null;
    }
    return `${workspace.path}/data/plugins`;
}

export function cmpPath(path1, path2) {
    path1 = path1.replace(/\\/g, "/");
    path2 = path2.replace(/\\/g, "/");
    if (path1[path1.length - 1] !== "/") {
        path1 += "/";
    }
    if (path2[path2.length - 1] !== "/") {
        path2 += "/";
    }
    return path1 === path2;
}

export function getThisPluginName() {
    if (!fs.existsSync("./plugin.json")) {
        process.chdir("../");
        if (!fs.existsSync("./plugin.json")) {
            error("失败！未找到 plugin.json");
            return null;
        }
    }

    const plugin = JSON.parse(fs.readFileSync("./plugin.json", "utf8"));
    const name = plugin?.name;
    if (!name) {
        error("失败！请在 plugin.json 中设置插件名称 name");
        return null;
    }

    return name;
}

/**
 * @param {string} distDir
 * @param {string} pluginsDir Parent directory (workspace .../data/plugins)
 * @param {string} pluginName
 * @returns {boolean}
 */
export function installDistAsPlugin(distDir, pluginsDir, pluginName) {
    if (!fs.existsSync(distDir)) {
        error(`构建产物不存在: ${distDir}`);
        return false;
    }

    fs.mkdirSync(pluginsDir, { recursive: true });
    const targetPath = path.join(pluginsDir, pluginName);

    if (fs.existsSync(targetPath)) {
        log(`>>> 移除已有插件目录: ${targetPath}`);
        fs.rmSync(targetPath, { recursive: true, force: true });
    }

    fs.mkdirSync(targetPath, { recursive: true });
    copyDirectory(distDir, targetPath);
    log(`>>> 插件已安装到: ${targetPath}`);
    return true;
}

export function copyDirectory(srcDir, dstDir) {
    if (!fs.existsSync(dstDir)) {
        fs.mkdirSync(dstDir);
        log(`已创建目录 ${dstDir}`);
    }

    fs.readdirSync(srcDir, { withFileTypes: true }).forEach((file) => {
        const src = path.join(srcDir, file.name);
        const dst = path.join(dstDir, file.name);

        if (file.isDirectory()) {
            copyDirectory(src, dst);
        } else {
            fs.copyFileSync(src, dst);
            log(`已复制文件: ${src} --> ${dst}`);
        }
    });
    log("所有文件复制完成！");
}

export function makeSymbolicLink(srcPath, targetPath) {
    if (!fs.existsSync(targetPath)) {
        fs.symlinkSync(srcPath, targetPath, "dir");
        log(`完成！已创建符号链接 ${targetPath} -> ${srcPath}`);
        return true;
    }

    const isSymbol = fs.lstatSync(targetPath).isSymbolicLink();
    if (!isSymbol) {
        error(`失败！${targetPath} 已存在，且不是符号链接`);
        return false;
    }
    const existedPath = fs.readlinkSync(targetPath);
    if (cmpPath(existedPath, srcPath)) {
        log(`正常！${targetPath} 已链接到 ${srcPath}`);
        return true;
    }
    error(`错误！符号链接 ${targetPath} 已指向 ${existedPath}`);
    return false;
}
