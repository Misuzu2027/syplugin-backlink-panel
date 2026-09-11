import { EnvConfig } from "@/config/EnvConfig";
import { Menu } from "siyuan";

export type DailyNoteFilterMode = "all" | "only" | "exclude";

const DAILY_NOTE_ATTR_PREFIX = "custom-dailynote-";

export function isDailyNoteDocument(document: DefBlock): boolean {
    if (!document || !document.ial) {
        return false;
    }
    return document.ial.includes(DAILY_NOTE_ATTR_PREFIX);
}

export function getDailyNoteDocumentIds(documents: DefBlock[]): string[] {
    if (!documents) {
        return [];
    }
    return documents
        .filter((document) => isDailyNoteDocument(document) && document.id)
        .map((document) => document.id);
}

export function getDailyNoteFilterMode(
    documents: DefBlock[],
    includeDocumentIds: Set<string>,
    excludeDocumentIds: Set<string>,
): DailyNoteFilterMode {
    let dailyIds = getDailyNoteDocumentIds(documents);
    if (dailyIds.length === 0) {
        return "all";
    }
    let includeIds = includeDocumentIds instanceof Set ? includeDocumentIds : new Set<string>();
    let excludeIds = excludeDocumentIds instanceof Set ? excludeDocumentIds : new Set<string>();

    if (dailyIds.every((id) => excludeIds.has(id))) {
        return "exclude";
    }

    let allIncluded = dailyIds.every((id) => includeIds.has(id));
    let includeHasOnlyDailies = includeIds.size > 0
        && Array.from(includeIds).every((id) => dailyIds.includes(id));
    if (allIncluded && includeHasOnlyDailies) {
        return "only";
    }
    return "all";
}

export function applyDailyNoteFilter(
    mode: DailyNoteFilterMode,
    documents: DefBlock[],
    includeDocumentIds: Set<string>,
    excludeDocumentIds: Set<string>,
) {
    let dailyIds = getDailyNoteDocumentIds(documents);
    for (const dailyId of dailyIds) {
        includeDocumentIds.delete(dailyId);
        excludeDocumentIds.delete(dailyId);
    }
    if (mode === "only") {
        includeDocumentIds.clear();
        for (const dailyId of dailyIds) {
            includeDocumentIds.add(dailyId);
        }
        return;
    }
    if (mode === "exclude") {
        for (const dailyId of dailyIds) {
            excludeDocumentIds.add(dailyId);
        }
    }
}

export function openBacklinkDailyNoteFilterMenu(options: {
    target: HTMLElement;
    documents: DefBlock[];
    includeDocumentIds: Set<string>;
    excludeDocumentIds: Set<string>;
    onChange: (mode: DailyNoteFilterMode) => void;
}) {
    if (!options || !options.target) {
        return;
    }
    let dailyIds = getDailyNoteDocumentIds(options.documents);
    let hasDailyNotes = dailyIds.length > 0;
    let mode = getDailyNoteFilterMode(
        options.documents,
        options.includeDocumentIds,
        options.excludeDocumentIds,
    );
    let i18n = EnvConfig.ins.i18n;
    let menu = new Menu("backlink-panel-daily-note-filter");
    menu.addItem({
        checked: mode === "all",
        iconHTML: "",
        label: i18n.dailyNoteFilterAll,
        click: () => {
            options.onChange("all");
        },
    });
    menu.addItem({
        checked: mode === "only",
        disabled: !hasDailyNotes,
        iconHTML: "",
        label: i18n.dailyNote,
        click: () => {
            options.onChange("only");
        },
    });
    menu.addItem({
        checked: mode === "exclude",
        disabled: !hasDailyNotes,
        iconHTML: "",
        label: i18n.nonDailyNote,
        click: () => {
            options.onChange("exclude");
        },
    });

    let rect = options.target.getBoundingClientRect();
    menu.open({
        x: rect.left,
        y: rect.bottom,
    });
}
