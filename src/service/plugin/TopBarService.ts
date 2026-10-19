import { EnvConfig } from "@/config/EnvConfig";
import Instance from "@/utils/Instance";
import { CUSTOM_ICON_MAP } from "@/models/icon-constant";
import { TabService } from "@/service/plugin/TabService";




export class TopBarService {

    public static get ins(): TopBarService {
        return Instance.get(TopBarService);
    }

    public init() {

        if (!EnvConfig.ins.isMobile) {
            EnvConfig.ins.plugin.addTopBar({
                icon: CUSTOM_ICON_MAP.BacklinkPanelFilter.id,
                title: "反链面板页签",
                position: "right",
                callback: () => {
                    TabService.ins.openCurrentDocumentBacklinkTab();
                }
            });

            
        }


    }
}
