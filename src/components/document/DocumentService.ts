import { EnvConfig } from "@/config/EnvConfig";
import BacklinkFilterPanelPageSvelte from "@/components/panel/backlink-filter-panel-page.svelte";
import { SettingService } from "@/service/setting/SettingService";
import Instance from "@/utils/Instance";


let backlinkPanelPageSvelteMap: Map<string, BacklinkFilterPanelPageSvelte> = new Map();
let documentProtyleElementMap: Map<string, HTMLElement> = new Map();


export class DocumentService {

    public static get ins(): DocumentService {
        return Instance.get(DocumentService);
    }

    public init() {
        EnvConfig.ins.plugin.eventBus.on("loaded-protyle-static", (e: any) => {
            // console.log("loaded-protyle-static e : ", e)
            addBacklinkPanelToBottom(e);
        });

        EnvConfig.ins.plugin.eventBus.on("switch-protyle", (e: any) => {
            // console.log("switch-protyle e : ", e)
            addBacklinkPanelToBottom(e);
        });

        EnvConfig.ins.plugin.eventBus.on("destroy-protyle", (e: any) => {
            handleDestroyProtyle(e);
        });
        intervalSetNodePaddingBottom();
    }


}

function addBacklinkPanelToBottom(e) {
    let documentBottomDisplay = SettingService.ins.SettingConfig.documentBottomDisplay;
    if (!documentBottomDisplay) {
        return;
    }
    let docuemntContentElement = e.detail.protyle.contentElement as HTMLElement;
    if (!docuemntContentElement) {
        return;
    }
    let protyleWysiwygElement = docuemntContentElement.querySelector(".protyle-wysiwyg.protyle-wysiwyg--attr");
    let backlinkPanelBottomElement = docuemntContentElement.querySelector(".backlink-panel-document-bottom__area");
    if (backlinkPanelBottomElement) {
        return;
    }
    let rootId = e.detail.protyle.block.rootID;

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


    let pageSvelte = new BacklinkFilterPanelPageSvelte({
        target: backlinkPanelBottomElement,
        props: {
            rootId: rootId,
            focusBlockId: null,
        }
    });

    backlinkPanelPageSvelteMap.set(rootId, pageSvelte);
    documentProtyleElementMap.set(rootId, protyleWysiwygElement as HTMLElement);
    // handleProtyleHeightChange(protyleElement)
}


function handleDestroyProtyle(e) {
    let rootId = e.detail.protyle.block.rootID;
    documentProtyleElementMap.delete(rootId);

    let documentBottomDisplay = SettingService.ins.SettingConfig.documentBottomDisplay;
    if (!documentBottomDisplay) {
        return;
    }
    let docuemntContentElement = e.detail.protyle.contentElement as HTMLElement;
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
}

function intervalSetNodePaddingBottom() {
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
        }
    }, 20);
}

