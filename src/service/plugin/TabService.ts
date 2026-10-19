import { EnvConfig } from "@/config/EnvConfig";
import BacklinkFilterPanelPageSvelte from "@/components/panel/backlink-filter-panel-page.svelte";
import Instance from "@/utils/Instance";
import { openTab } from "siyuan";
import { CUSTOM_ICON_MAP } from "@/models/icon-constant";
import { isStrBlank } from "@/utils/string-util";
import { clearProtyleGutters, getActiveTab } from "@/utils/html-util";
import { CacheManager } from "@/config/CacheManager";


const BACKLINK_TAB_PREFIX = "backlink_tab_"
const SHOW_BACKLINK_TAB_COMMAND_KEY = "showDocumentBacklinkPanelTab";

export class TabService {


    public static get ins(): TabService {
        return Instance.get(TabService);
    }

    private readonly handleReadonlyEditorHotkey = (event: KeyboardEvent) => {
        tryOpenBacklinkTabWhenEditorSwallowsHotkey(event);
    };

    public init() {
        EnvConfig.ins.plugin.addCommand({
            langKey: SHOW_BACKLINK_TAB_COMMAND_KEY,
            langText: "显示当前文反链过滤面板页签",
            hotkey: "⌥⇧T",
            callback: () => {
                TabService.ins.openCurrentDocumentBacklinkTab();
            },
            editorCallback: (protyle: any) => {
                TabService.ins.openCurrentDocumentBacklinkTab(protyle);
            },
        });

        // 只读/预览文档下，思源会在编辑器 keydown 里提前拦截快捷键，editorCallback 不会触发。
        window.addEventListener("keydown", this.handleReadonlyEditorHotkey, true);



        // 用来修复反链面板页签新窗口打开时，没有初始化该页签ID，导致显示空白的问题 https://github.com/Misuzu2027/syplugin-backlink-panel/issues/23
        // 初始化时查看有没有销毁的ID，有的话初始化tab。
        // let destoryDocIdArray = CacheManager.ins.getAndRemoveBacklinkDestoryTabDocIdArray();
        // console.log("destoryDocIdArray ", destoryDocIdArray)
        // for (const docId of destoryDocIdArray) {
        //     this.pluginAddTab(docId, null);
        // }

    }

    public destory() {
        window.removeEventListener("keydown", this.handleReadonlyEditorHotkey, true);
    }

    public openCurrentDocumentBacklinkTab(protyle?: any) {
        let docInfo = getCurrentDocumentInfo(protyle);
        if (!docInfo) {
            return;
        }
        this.openBacklinkTab(docInfo.docTitle, docInfo.docId, null);
    }

    public pluginAddTab(docId: string, focusBlockId: string) {
        let tabId = BACKLINK_TAB_PREFIX + docId;
        let backlinkFilterPanelPageSvelte: BacklinkFilterPanelPageSvelte;

        EnvConfig.ins.plugin.addTab({
            type: tabId,
            init() {
                this.element.classList.add("backlink-panel-scroll-host");
                backlinkFilterPanelPageSvelte = new BacklinkFilterPanelPageSvelte({
                    target: this.element,
                    props: {
                        rootId: docId,
                        focusBlockId: focusBlockId,
                        panelBacklinkViewExpand: true,
                        currentTab: this,
                    }
                });

                this.element.addEventListener(
                    "scroll",
                    () => {
                        clearProtyleGutters(this.element);
                    },
                );
            },
            beforeDestroy() {
                backlinkFilterPanelPageSvelte?.$destroy();
            },
            destroy() {
            },
            resize() {

            },
            update() {
            }
        });

    }


    public openBacklinkTab(docTitle: string, docId: string, focusBlockId: string) {
        if (isStrBlank(docTitle) || isStrBlank(docId)) {
            console.log("反链过滤面板插件 打开反链页签错误，参数缺失")
            return;
        }

        let tabId = BACKLINK_TAB_PREFIX + docId;

        this.pluginAddTab(docId, focusBlockId);

        CacheManager.ins.addBacklinkDestoryTabDocId(docId);

        openTab({
            app: EnvConfig.ins.app,
            custom: {
                id: EnvConfig.ins.plugin.name + tabId,
                icon: CUSTOM_ICON_MAP.BacklinkPanelFilter.id,
                title: docTitle,
                // data: { rootId: docId, focusBlockId: focusBlockId }
            },
            position: "right",
            afterOpen() {
            }
        });
    }

}

function tryOpenBacklinkTabWhenEditorSwallowsHotkey(event: KeyboardEvent) {
    if (event.isComposing || event.repeat) {
        return;
    }
    if (shouldIgnoreBacklinkTabHotkeyTarget(event.target)) {
        return;
    }
    if (!isProtyleEditorHotkeySwallowed(event.target)) {
        return;
    }
    if (!matchBacklinkTabCommandHotkey(event)) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    TabService.ins.openCurrentDocumentBacklinkTab();
}

function shouldIgnoreBacklinkTabHotkeyTarget(target: EventTarget) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return true;
    }
    return Boolean(target.closest(".b3-dialog, .b3-menu"));
}

function isProtyleEditorHotkeySwallowed(target: EventTarget): boolean {
    let wysiwygElement: HTMLElement = null;
    if (target instanceof HTMLElement) {
        let protyleElement = target.closest(".protyle") as HTMLElement;
        wysiwygElement = protyleElement?.querySelector(".protyle-wysiwyg") as HTMLElement;
    }
    if (!wysiwygElement) {
        wysiwygElement = getActiveTab()?.querySelector(".protyle-wysiwyg") as HTMLElement;
    }
    if (!wysiwygElement) {
        return false;
    }
    // 只读文档：思源在 wysiwyg keydown 里 stopPropagation，plugin editorCallback 不会执行。
    if (wysiwygElement.getAttribute("contenteditable") === "false") {
        return true;
    }
    // 预览模式：快捷键不走 wysiwyg commonHotkey；同时注册了 editorCallback 时全局 callback 也不会执行。
    return wysiwygElement.classList.contains("fn__none");
}

function matchBacklinkTabCommandHotkey(event: KeyboardEvent): boolean {
    let hotkey = getBacklinkTabCommandHotkey();
    return matchSiyuanPluginHotkey(hotkey, event);
}

function getBacklinkTabCommandHotkey(): string {
    let plugin = EnvConfig.ins.plugin;
    let command = plugin?.commands?.find((item: any) => item.langKey === SHOW_BACKLINK_TAB_COMMAND_KEY);
    if (command?.customHotkey) {
        return command.customHotkey;
    }
    return window.siyuan?.config?.keymap?.plugin?.[plugin?.name]?.[SHOW_BACKLINK_TAB_COMMAND_KEY]?.custom || "⌥⇧T";
}

function matchSiyuanPluginHotkey(hotkey: string, event: KeyboardEvent): boolean {
    if (!hotkey) {
        return false;
    }
    let needAlt = hotkey.includes("⌥");
    let needShift = hotkey.includes("⇧");
    let needMeta = hotkey.includes("⌘");
    let needCtrl = hotkey.includes("⌃");
    let mainKey = hotkey.replace(/[⌥⇧⌘⌃]/g, "");
    if (!mainKey) {
        return false;
    }
    if (event.altKey !== needAlt || event.shiftKey !== needShift) {
        return false;
    }
    let isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    if (isMac) {
        if (event.metaKey !== needMeta || event.ctrlKey !== needCtrl) {
            return false;
        }
    } else {
        let needWinCtrl = needMeta || needCtrl;
        if (event.ctrlKey !== needWinCtrl || event.metaKey) {
            return false;
        }
    }
    let expected = mainKey.toUpperCase();
    let fromCode = "";
    if (event.code?.startsWith("Key")) {
        fromCode = event.code.slice(3).toUpperCase();
    } else if (event.code?.startsWith("Digit")) {
        fromCode = event.code.slice(5);
    } else if (event.code) {
        fromCode = event.code.toUpperCase();
    }
    let fromKey = event.key?.length === 1 ? event.key.toUpperCase() : event.key?.toUpperCase();
    return expected === fromCode || expected === fromKey;
}

function getCurrentDocumentInfo(protyle?: any): { docId: string; docTitle: string } | null {
    let untitled = window.siyuan?.languages?.untitled || "";
    if (protyle?.block?.rootID) {
        let docTitle = protyle.title?.editElement?.textContent
            || protyle.title?.element?.querySelector(".protyle-title__input")?.textContent
            || untitled;
        if (!isStrBlank(protyle.block.rootID) && !isStrBlank(docTitle)) {
            return { docId: protyle.block.rootID, docTitle };
        }
    }

    let currentDocument: HTMLDivElement = getActiveTab();
    if (!currentDocument) {
        return null;
    }
    const docTitleElement = currentDocument.querySelector(".protyle-title");
    let docTitle = currentDocument.querySelector("div.protyle-title__input")?.textContent || untitled;
    let docId = docTitleElement?.getAttribute("data-node-id");
    if (isStrBlank(docId) || isStrBlank(docTitle)) {
        return null;
    }
    return { docId, docTitle };
}
