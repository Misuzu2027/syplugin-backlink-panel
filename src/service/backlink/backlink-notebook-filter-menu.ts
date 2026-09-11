import { EnvConfig } from "@/config/EnvConfig";
import { Menu } from "siyuan";

function setMenuItemChecked(element: HTMLElement, checked: boolean) {
    if (!element) {
        return;
    }
    element.querySelector(".b3-menu__checked")?.remove();
    if (checked) {
        element.insertAdjacentHTML(
            "beforeend",
            '<svg class="b3-menu__checked"><use xlink:href="#iconSelect"></use></svg>',
        );
    }
}

export async function openBacklinkNotebookFilterMenu(options: {
    target: HTMLElement;
    excludeNotebookIds: Set<string>;
    onChange: (excludeNotebookIds: Set<string>) => void;
}) {
    if (!options || !options.target) {
        return;
    }
    let excludeNotebookIds =
        options.excludeNotebookIds instanceof Set
            ? options.excludeNotebookIds
            : new Set<string>();
    let menu = new Menu("backlink-panel-notebook-filter");
    let allItemElement: HTMLElement;
    let notebookItemElements = new Map<string, HTMLElement>();

    const refreshMenuChecked = () => {
        setMenuItemChecked(allItemElement, excludeNotebookIds.size === 0);
        notebookItemElements.forEach((element, notebookId) => {
            setMenuItemChecked(element, !excludeNotebookIds.has(notebookId));
        });
    };

    const emitChange = () => {
        options.onChange(new Set(excludeNotebookIds));
        refreshMenuChecked();
    };

    menu.addItem({
        checked: excludeNotebookIds.size === 0,
        iconHTML: "",
        label: EnvConfig.ins.i18n.allNotebooks,
        bind: (element) => {
            allItemElement = element;
        },
        click: () => {
            excludeNotebookIds.clear();
            emitChange();
            return true;
        },
    });
    menu.addSeparator();

    let notebookMap = await EnvConfig.ins.notebookMap(true);
    for (const notebook of notebookMap.values()) {
        if (!notebook || notebook.closed) {
            continue;
        }
        let notebookId = notebook.id;
        menu.addItem({
            checked: !excludeNotebookIds.has(notebookId),
            iconHTML: "",
            label: notebook.name,
            bind: (element) => {
                notebookItemElements.set(notebookId, element);
            },
            click: () => {
                if (excludeNotebookIds.has(notebookId)) {
                    excludeNotebookIds.delete(notebookId);
                } else {
                    excludeNotebookIds.add(notebookId);
                }
                emitChange();
                return true;
            },
        });
    }

    menu.addSeparator();
    menu.addItem({
        icon: "iconClose",
        label: EnvConfig.ins.i18n.close,
        click: () => {
            return false;
        },
    });

    let rect = options.target.getBoundingClientRect();
    menu.open({
        x: rect.left,
        y: rect.bottom,
    });
}
