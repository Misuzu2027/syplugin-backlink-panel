// Shared helpers for make_dev_link / make_install / install_to_workspace
import fs from "fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import readline from "node:readline";

const LINK_CONFIG_PATH = path.join(process.cwd(), "scripts", "link-config.json");
const LINK_CONFIG_EXAMPLE_PATH = path.join(process.cwd(), "scripts", "link-config.example.json");
/** SiYuan writes runtime ports / workspace list under ~/.config/siyuan/ */
const SIYUAN_CONF_DIR = path.join(os.homedir(), ".config", "siyuan");
const SIYUAN_PORT_JSON = path.join(SIYUAN_CONF_DIR, "port.json");
const SIYUAN_WORKSPACE_JSON = path.join(SIYUAN_CONF_DIR, "workspace.json");
/** Default / reverse-proxy port; actual kernel port may differ when 6806 is busy. */
const SIYUAN_FIXED_PORT = "6806";
const PROBE_TIMEOUT_MS = 800;

export const log = (info) => console.log(`\x1B[36m%s\x1B[0m`, info);
export const error = (info) => console.log(`\x1B[31m%s\x1B[0m`, info);
export const warn = (info) => console.log(`\x1B[33m%s\x1B[0m`, info);

export const POST_HEADER = {
    "Content-Type": "application/json",
};

export async function myfetch(url, options = {}) {
    const { timeout = 2000, body, ...reqOptions } = options;
    return new Promise((resolve, reject) => {
        const req = http.request(url, reqOptions, (res) => {
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
        req.setTimeout(timeout, () => {
            req.destroy(new Error(`timeout after ${timeout}ms`));
        });
        if (body != null) {
            req.write(body);
        }
        req.end();
    });
}

function isProcessAlive(pid) {
    const n = Number(pid);
    if (!Number.isInteger(n) || n <= 0) {
        return false;
    }
    try {
        process.kill(n, 0);
        return true;
    } catch {
        return false;
    }
}

/**
 * Candidate ports (deduped, preferred order):
 * SIYUAN_PORT → 6806 → ports of living PIDs in ~/.config/siyuan/port.json
 */
export function collectSiYuanPortCandidates() {
    const ports = [];
    const seen = new Set();
    const add = (port) => {
        const p = String(port ?? "").trim();
        if (!/^\d+$/.test(p) || seen.has(p)) {
            return;
        }
        seen.add(p);
        ports.push(p);
    };

    if (process.env.SIYUAN_PORT) {
        add(process.env.SIYUAN_PORT);
    }
    add(SIYUAN_FIXED_PORT);

    if (fs.existsSync(SIYUAN_PORT_JSON)) {
        try {
            const pidPorts = JSON.parse(fs.readFileSync(SIYUAN_PORT_JSON, "utf8"));
            for (const [pid, port] of Object.entries(pidPorts ?? {})) {
                if (isProcessAlive(pid)) {
                    add(port);
                }
            }
        } catch (e) {
            warn(`\t读取 ${SIYUAN_PORT_JSON} 失败: ${e.message}`);
        }
    }

    return ports;
}

async function probeSiYuanVersion(port) {
    const url = `http://127.0.0.1:${port}/api/system/version`;
    const response = await myfetch(url, {
        method: "GET",
        timeout: PROBE_TIMEOUT_MS,
    });
    if (!response.ok) {
        return null;
    }
    const conf = await response.json();
    // SiYuan: { code: 0, data: "x.y.z" }
    if (conf?.code === 0 && typeof conf?.data === "string" && conf.data.length > 0) {
        return conf.data;
    }
    return null;
}

/**
 * Find reachable SiYuan HTTP ports. Uses /api/system/version (no auth) to verify.
 * @returns {Promise<string[]>}
 */
export async function detectSiYuanPorts() {
    const candidates = collectSiYuanPortCandidates();
    const checks = await Promise.all(
        candidates.map(async (port) => {
            try {
                const ver = await probeSiYuanVersion(port);
                return ver ? port : null;
            } catch {
                return null;
            }
        }),
    );
    return checks.filter(Boolean);
}

/** Offline fallback: read workspace list from ~/.config/siyuan/workspace.json */
export function readWorkspacesFromConfig() {
    if (!fs.existsSync(SIYUAN_WORKSPACE_JSON)) {
        return null;
    }
    try {
        const paths = JSON.parse(fs.readFileSync(SIYUAN_WORKSPACE_JSON, "utf8"));
        if (!Array.isArray(paths)) {
            return null;
        }
        return paths
            .filter((p) => typeof p === "string" && p.trim() && fs.existsSync(p))
            .map((p) => ({ path: path.resolve(p), closed: true }));
    } catch (e) {
        warn(`\t读取 ${SIYUAN_WORKSPACE_JSON} 失败: ${e.message}`);
        return null;
    }
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
        "utf8",
    );
    log(`已保存工作空间目录到 ${LINK_CONFIG_PATH}`);
}

function cleanPath(input) {
    return input.trim().replace(/^["']|["']$/g, "");
}

/** 从任意输入中提取工作空间根目录 */
export function getWorkspaceDir(input) {
    let dir = path.resolve(cleanPath(input));
    const normalized = dir.replace(/\\/g, "/").replace(/\/+$/, "");
    if (normalized.endsWith("/data/plugins")) {
        return path.resolve(normalized.replace(/\/data\/plugins$/, ""));
    }
    if (normalized.endsWith("/data")) {
        return path.resolve(normalized.replace(/\/data$/, ""));
    }
    return dir;
}

/** 将工作空间目录转换为插件目录，自动拼接 data/plugins */
export function toPluginDir(input) {
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

/** @deprecated alias — prefer `toPluginDir` */
export function resolveWorkspaceToPluginsDir(workspacePath) {
    return toPluginDir(workspacePath);
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
    warn("  1. 启动思源后重新运行此命令（通过 ~/.config/siyuan/port.json 自动检测端口）");
    warn("  2. 复制 scripts/link-config.example.json 为 scripts/link-config.json，填写 workspaceDir");
    warn("  3. 设置环境变量 SIYUAN_PLUGIN_DIR（填工作空间目录即可，会自动拼接 data/plugins）");
    warn("  4. 设置环境变量 SIYUAN_PORT（内核监听非默认端口时）");
    warn("  5. 在下方手动输入工作空间目录（会自动拼接 data/plugins）\n");
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

/**
 * 解析 `<workspace>/data/plugins`，优先级：
 * manual target → link-config.json → 运行中的思源 API → SIYUAN_PLUGIN_DIR → 交互输入
 */
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

    log(">>> 尝试自动获取思源工作空间...");
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

async function fetchWorkspacesFromPort(port) {
    const url = `http://127.0.0.1:${port}/api/system/getWorkspaces`;
    const response = await myfetch(url, {
        method: "POST",
        headers: POST_HEADER,
        timeout: PROBE_TIMEOUT_MS,
    });
    let conf;
    try {
        conf = await response.json();
    } catch {
        throw new Error(`HTTP ${response.status} (invalid JSON)`);
    }
    if (!response.ok || conf?.code !== 0) {
        throw new Error(conf?.msg || `HTTP ${response.status}`);
    }
    if (!Array.isArray(conf?.data)) {
        throw new Error("unexpected getWorkspaces payload");
    }
    return conf.data;
}

/**
 * 解析工作空间列表：
 * 1. 探测思源端口（SIYUAN_PORT / 6806 / port.json 中存活进程的端口）
 * 2. 回退到 ~/.config/siyuan/workspace.json（内核未运行时也可用）
 */
export async function getSiYuanDir() {
    const ports = await detectSiYuanPorts();
    if (ports.length > 0) {
        log(`>>> 检测到思源端口: ${ports.map((p) => `127.0.0.1:${p}`).join(", ")}`);
        const errors = [];
        for (const port of ports) {
            try {
                const data = await fetchWorkspacesFromPort(port);
                if (data.length > 0) {
                    log(`>>> 从 API 获取工作空间 (port ${port})`);
                    return data;
                }
                errors.push(`${port}: 工作空间列表为空（可能需要鉴权？）`);
            } catch (e) {
                errors.push(`${port}: ${e.message}`);
            }
        }
        warn(`\t在已检测端口上 getWorkspaces 失败: ${errors.join("; ")}`);
    } else {
        warn("\t未检测到运行中的思源 HTTP 端口（已尝试 6806 + ~/.config/siyuan/port.json）");
    }

    const fromFile = readWorkspacesFromConfig();
    if (fromFile?.length > 0) {
        warn(`>>> 使用离线工作空间列表: ${SIYUAN_WORKSPACE_JSON}`);
        return fromFile;
    }

    error("\t无法解析思源工作空间。");
    error("\t请启动思源，或配置 scripts/link-config.json / SIYUAN_PLUGIN_DIR");
    return null;
}

export async function chooseTarget(workspaces) {
    const count = workspaces.length;
    log(`>>> 检测到 ${count} 个思源工作空间`);
    workspaces.forEach((workspace, i) => {
        const mark = workspace.closed === false ? " (已打开)" : workspace.closed === true ? " (已关闭)" : "";
        log(`\t[${i}] ${workspace.path}${mark}`);
    });

    if (count === 1) {
        return toPluginDir(workspaces[0].path);
    }

    while (true) {
        const answer = await ask(`\t请选择工作空间 [0-${count - 1}]: `);
        const index = Number.parseInt(answer, 10);
        if (!Number.isNaN(index) && index >= 0 && index < count) {
            return toPluginDir(workspaces[index].path);
        }
        error(`\t无效的选择: "${answer}"`);
    }
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
        // Go 1.23 no longer supports junctions as symlinks:
        // https://github.com/siyuan-note/siyuan/issues/12399
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
