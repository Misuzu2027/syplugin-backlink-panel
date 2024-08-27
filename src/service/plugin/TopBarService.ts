import { EnvConfig } from "@/config/EnvConfig";
import Instance from "@/utils/Instance";
import { CUSTOM_ICON_MAP } from "@/models/icon-constant";
import { getActiveTab } from "@/utils/html-util";
import { TabService } from "@/service/plugin/TabService";




export class TopBarService {

    public static get ins(): TopBarService {
        return Instance.get(TopBarService);
    }

    public init() {

        if (!EnvConfig.ins.isMobile) {
            EnvConfig.ins.plugin.addTopBar({
                icon: CUSTOM_ICON_MAP.BacklinkPanelFilter.id,
                title: "当前文化的反链面板",
                position: "right",
                callback: () => {
                    let currentDocument: HTMLDivElement = getActiveTab();
                    if (!currentDocument) {
                        return;
                    }

                    const docTitleElement = currentDocument.querySelector(".protyle-title");
                    let docTitle = currentDocument.querySelector("div.protyle-title__input").textContent;
                    let docId = docTitleElement.getAttribute("data-node-id");
                    TabService.ins.openBacklinkTab(docTitle, docId, null);
                }
            });
        }

    }
}
