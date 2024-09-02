import { EnvConfig } from "@/config/EnvConfig";
import BacklinkFilterPanelPageSvelte from "@/components/panel/backlink-filter-panel-page.svelte";
import { SettingService } from "@/service/setting/SettingService";
import Instance from "@/utils/Instance";
import { Menu } from "siyuan";
import { BacklinkFilterPanelAttributeService, DOCUMENT_BOTTOM_SHOW_BACKLINK_FILTER_PANEL_ATTRIBUTE_KEY } from "@/service/setting/BacklinkPanelFilterCriteriaService";
import { clearProtyleGutters } from "@/utils/html-util";
import { generateGetDefBlockArraySql } from "../backlink/backlink-sql";
import { sql } from "@/utils/api";
import { isArrayEmpty } from "@/utils/array-util";


let backlinkPanelPageSvelteMap: Map<string, BacklinkFilterPanelPageSvelte> = new Map();
let documentProtyleElementMap: Map<string, HTMLElement> = new Map();


export class DocumentService {

    public static get ins(): DocumentService {
        return Instance.get(DocumentService);
    }

    public init() {
        EnvConfig.ins.plugin.eventBus.on("loaded-protyle-static", (e: any) => {
            // console.log("loaded-protyle-static e : ", e)
            handleSwitchProtyleOrLoadedProtyleStatic(e);
        });

        EnvConfig.ins.plugin.eventBus.on("switch-protyle", (e: any) => {
            // console.log("switch-protyle e : ", e)
            handleSwitchProtyleOrLoadedProtyleStatic(e);
        });

        EnvConfig.ins.plugin.eventBus.on("destroy-protyle", (e: any) => {
            handleDestroyProtyle(e);
        });

        EnvConfig.ins.plugin.eventBus.on("click-editortitleicon", (e: any) => {
            hadnleClickEditorTitleIcon(e);
        });
        // EnvConfig.ins.plugin.addCommand({
        //     langKey: "showDocumentBottomBacklinkPanel",
        //     langText: "始终显示底部反链面板",
        //     hotkey: "⌥⇧⌘A",
        //     editorCallback: (protyle: any) => {
        //         console.log(protyle, "editorCallback");
        //     },
        // });

        intervalSetNodePaddingBottom();
    }
}

async function handleSwitchProtyleOrLoadedProtyleStatic(e) {
    if (!e || !e.detail || !e.detail.protyle) {
        return;
    }

    let docuemntContentElement = e.detail.protyle.contentElement as HTMLElement;
    let rootId = e.detail.protyle.block.rootID;
    if (!rootId) {
        return;
    }

    let wysiwygElement = e.detail.protyle.wysiwyg.element as Element;
    let documentBottomDisplay = SettingService.ins.SettingConfig.documentBottomDisplay;

    if (documentBottomDisplay) {
        let getDefBlockArraySql = generateGetDefBlockArraySql(rootId, null);
        let curDocDefBlockArray: DefBlock[] = await sql(getDefBlockArraySql);
        if (isArrayEmpty(curDocDefBlockArray)) {
            documentBottomDisplay = false;;
        }
    }

    if (wysiwygElement && wysiwygElement.matches(".protyle-wysiwyg--attr")) {
        let attributeValue = wysiwygElement.getAttribute(DOCUMENT_BOTTOM_SHOW_BACKLINK_FILTER_PANEL_ATTRIBUTE_KEY);
        if (attributeValue == "1") {
            documentBottomDisplay = true;
        } else if (attributeValue == "-1") {
            documentBottomDisplay = false;
        }
    }

    if (!documentBottomDisplay) {
        return;
    }

    addBacklinkPanelToBottom(docuemntContentElement, rootId);

}

function handleDestroyProtyle(e) {
    let rootId = e.detail.protyle.block.rootID;
    documentProtyleElementMap.delete(rootId);

    let docuemntContentElement = e.detail.protyle.contentElement as HTMLElement;
    if (!docuemntContentElement) {
        return;

    }
    destroyPanel(docuemntContentElement);
}


function addBacklinkPanelToBottom(docuemntContentElement: HTMLElement, rootId: string) {
    if (!docuemntContentElement || !rootId) {
        return;
    }
    let protyleWysiwygElement = docuemntContentElement.querySelector(".protyle-wysiwyg.protyle-wysiwyg--attr");
    let backlinkPanelBottomElement = docuemntContentElement.querySelector(".backlink-panel-document-bottom__area");
    if (backlinkPanelBottomElement) {
        return;
    }

    backlinkPanelBottomElement = document.createElement("div");
    backlinkPanelBottomElement.classList.add(
        "backlink-panel-document-bottom__area"
    );
    let isMobile = EnvConfig.ins.isMobile;
    if (isMobile) {
        backlinkPanelBottomElement.classList.add("document-panel-plugin-mobile");
    }

    // console.log("handleDestroyProtyle setAttribute rootId ", rootId)
    docuemntContentElement.appendChild(backlinkPanelBottomElement);
    backlinkPanelBottomElement.setAttribute("data-root-id", rootId);

    let hrElement = document.createElement("hr");
    backlinkPanelBottomElement.appendChild(hrElement);

    let pageSvelte = new BacklinkFilterPanelPageSvelte({
        target: backlinkPanelBottomElement,
        props: {
            rootId: rootId,
            focusBlockId: null,
        }
    });
    backlinkPanelBottomElement.parentElement.addEventListener(
        "scroll",
        () => {
            clearProtyleGutters(backlinkPanelBottomElement as HTMLElement);
        },
    );

    backlinkPanelPageSvelteMap.set(rootId, pageSvelte);
    documentProtyleElementMap.set(rootId, protyleWysiwygElement as HTMLElement);
    // handleProtyleHeightChange(protyleElement)
}


function destroyPanel(docuemntContentElement: HTMLElement) {
    if (!docuemntContentElement) {
        return;
    }
    let backlinkPanelBottomElement = docuemntContentElement.querySelector(".backlink-panel-document-bottom__area");
    if (!backlinkPanelBottomElement) {
        return;
    }
    let panelRootId = backlinkPanelBottomElement.getAttribute("data-root-id");
    if (!panelRootId) {
        return;
    }
    let pageSvelte = backlinkPanelPageSvelteMap.get(panelRootId);
    if (!pageSvelte) {
        return;
    }
    backlinkPanelPageSvelteMap.delete(panelRootId);
    pageSvelte.$destroy();
    backlinkPanelBottomElement.remove();

}

function hadnleClickEditorTitleIcon(e) {


    (e.detail.menu as Menu).addItem({
        icon: "BacklinkPanelFilter",
        type: "submenu",
        label: "反链筛选面板",
        submenu: getDocumentBlockIconMenus(e)
    });
}

function getDocumentBlockIconMenus(e) {
    let rootId = e.detail.data.rootID;
    if (!rootId) {
        return;
    }
    let submenus = [];
    submenus.push({
        label: "恢复默认",
        click: async () => {
            await BacklinkFilterPanelAttributeService.ins.updateDocumentBottomShowPanel(rootId, null);
            let documentBottomDisplay = SettingService.ins.SettingConfig.documentBottomDisplay;
            if (documentBottomDisplay) {
                let docuemntContentElement = e.detail.protyle.contentElement as HTMLElement;
                addBacklinkPanelToBottom(docuemntContentElement, rootId);
            } else {
                handleDestroyProtyle(e);
            }
        }
    });
    submenus.push({
        label: "始终显示该文档底部反链",
        click: async () => {
            await BacklinkFilterPanelAttributeService.ins.updateDocumentBottomShowPanel(rootId, 1);

            let docuemntContentElement = e.detail.protyle.contentElement as HTMLElement;
            addBacklinkPanelToBottom(docuemntContentElement, rootId);
        }
    });
    submenus.push({
        label: "始终隐藏该文档底部反链",
        click: async () => {
            BacklinkFilterPanelAttributeService.ins.updateDocumentBottomShowPanel(rootId, -1);
            let docuemntContentElement = e.detail.protyle.contentElement as HTMLElement;
            destroyPanel(docuemntContentElement);
        }
    });

    return submenus;
}



function intervalSetNodePaddingBottom() {
    // 后续看能不能优化成响应式的。。
    setInterval(() => {
        if (documentProtyleElementMap.size <= 0) {
            return;
        }
        let paddingBottomSize = "48px";
        for (const key of documentProtyleElementMap.keys()) {
            let protyleElement = documentProtyleElementMap.get(key);

            if (parseFloat(protyleElement.style.paddingBottom) > 88) {
                protyleElement.style.paddingBottom = paddingBottomSize;
            }
            let panelElement = protyleElement.parentElement.querySelector(".backlink-panel-document-bottom__area") as HTMLElement;
            if (panelElement && protyleElement.style.paddingLeft != panelElement.style.paddingLeft) {
                let paddingLeftPx = parseFloat(protyleElement.style.paddingLeft) < 48 ? protyleElement.style.paddingLeft : '48px';
                panelElement.style.paddingLeft = paddingLeftPx;
                panelElement.style.paddingRight = paddingLeftPx;
            }
        }
    }, 20);
}

