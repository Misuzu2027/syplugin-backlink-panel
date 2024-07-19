<script lang="ts">
    import { EnvConfig } from "@/config/EnvConfig";
    import {
        BACKLINK_BLOCK_SORT_METHOD_ELEMENT,
        CUR_DOC_DEF_BLOCK_SORT_METHOD_ELEMENT,
        RELATED_DEF_BLOCK_SORT_METHOD_ELEMENT,
        RELATED_DOCMUMENT_SORT_METHOD_ELEMENT,
    } from "@/models/backlink-constant";
    import {
        IBacklinkPanelData,
        IBacklinkPanelDataQueryParams,
        IBacklinkPanelRenderData,
        IBacklinkPanelRednerFilterQueryParams,
        BacklinkPanelFilterCriteria,
    } from "@/models/backlink-model";
    import {
        defBlockArrayKeywordMatch,
        defBlockArraySort,
        getBacklinkPanelData,
        getBacklinkPanelRenderData,
        getTurnPageBacklinkPanelRenderData,
    } from "@/service/backlink-data";
    import { isArrayEmpty, isArrayNotEmpty } from "@/utils/array-util";
    import { clearProtyleGutters } from "@/utils/html-util";
    import { removePrefixAndSuffix } from "@/utils/string-util";
    import {
        Constants,
        openMobileFileById,
        openTab,
        Protyle,
        TProtyleAction,
    } from "siyuan";
    import { onDestroy, onMount } from "svelte";
    import { getBlockTypeIconHref } from "@/utils/icon-util";
    import { CacheManager } from "@/config/CacheManager";
    import { BacklinkPanelFilterCriteriaService } from "@/service/setting/BacklinkPanelFilterCriteriaService";
    import { SettingService } from "@/service/setting/SettingService";

    export let rootId: string;
    export let focusBlockId: string;
    // 用来监听变化
    let previousRootId: string;
    let previousFocusBlockId: string;
    // 监听 rootId 变化
    $: if (rootId !== previousRootId || focusBlockId !== previousFocusBlockId) {
        initData();
    }

    /* 绑定 HTML 元素 */
    let curRootElement: HTMLElement;
    let backlinkULElement: HTMLElement;

    /* 数据 */
    let backlinkPanelBaseData: IBacklinkPanelData;
    let backlinkPanelRenderData: IBacklinkPanelRenderData;
    // 用于排序、关键字查找筛选条件，此时不会改动反链信息，所以在页面中处理。

    let queryParams: IBacklinkPanelRednerFilterQueryParams;

    /* 全局使用 */
    let editors: Protyle[] = [];
    let doubleClickTimeout: number = 1;
    let clickCount: number = 0;
    let clickTimeoutId: NodeJS.Timeout;
    let inputChangeTimeoutId: NodeJS.Timeout;

    /* 控制页面元素的 */
    let backlinkPanelFilterViewExpand: boolean = false;

    $: updateDefaultConditions(queryParams, backlinkPanelFilterViewExpand);

    onMount(async () => {
        initData();
        initEvent();
    });

    onDestroy(async () => {
        clearBacklinkProtyleList();
    });

    function updateDefaultConditions(
        queryParams: IBacklinkPanelRednerFilterQueryParams,
        backlinkPanelFilterViewExpand: boolean,
    ) {
        if (!rootId || !queryParams) {
            return;
        }
        let conditions: BacklinkPanelFilterCriteria = {
            queryParams,
            backlinkPanelFilterViewExpand,
        };
        BacklinkPanelFilterCriteriaService.ins.updateBacklinkPanelFilterCriteria(
            rootId,
            conditions,
        );
    }

    function initEvent() {
        curRootElement.parentElement.parentElement.addEventListener(
            "scroll",
            () => {
                clearProtyleGutters(backlinkULElement);
            },
        );

        backlinkULElement.addEventListener("mouseleave", () => {
            clearProtyleGutters(backlinkULElement);
        });
        backlinkULElement.addEventListener("mousemove", (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            // 检查是否是移动到文档名称元素上
            if (
                target &&
                target.classList.contains("b3-list-item__text") &&
                target.classList.contains("list-item__document-name")
            ) {
                clearProtyleGutters(backlinkULElement);
            }
        });
    }

    function clickBacklinkDocumentLi(event: MouseEvent) {
        const target = event.currentTarget as HTMLElement;
        if (event.ctrlKey) {
            let rootId = target.getAttribute("data-node-id");
            openDocumentTab(rootId);
            return;
        }
        let closeStatus = target.classList.contains("backlink-hide");
        if (closeStatus) {
            target.nextElementSibling.classList.remove("fn__none");
            target.classList.remove("backlink-hide");
            target
                .querySelector(".b3-list-item__arrow")
                .classList.add("b3-list-item__arrow--open");
        } else {
            target.nextElementSibling.classList.add("fn__none");
            target.classList.add("backlink-hide");
            target
                .querySelector(".b3-list-item__arrow")
                .classList.remove("b3-list-item__arrow--open");
        }
    }
    function expandLiElement(event: MouseEvent) {
        const target = event.target as HTMLElement;

        const parentLiElement = target.closest(".list-item__document-name");
        if (!parentLiElement) {
            return;
        }

        const liNodes =
            parentLiElement.nextElementSibling.querySelectorAll<HTMLElement>(
                'div[data-subtype="u"].li[fold="1"]',
            );
        liNodes.forEach((node) => {
            node.removeAttribute("fold");
        });
    }

    function openDocumentTab(rootId: string) {
        let actions: TProtyleAction[] = [Constants.CB_GET_CONTEXT];

        if (EnvConfig.ins.isMobile) {
            openMobileFileById(EnvConfig.ins.app, rootId, actions);
        } else {
            openTab({
                app: EnvConfig.ins.app,
                doc: {
                    id: rootId,
                    action: actions,
                },
            });
        }
    }

    async function initData() {
        if (!rootId) {
            return;
        }
        previousRootId = rootId;
        previousFocusBlockId = focusBlockId;
        let settingConfig = SettingService.ins.SettingConfig;
        let backlinkPanelDataQueryParams: IBacklinkPanelDataQueryParams = {
            rootId,
            focusBlockId,
            queryParentDefBlock: settingConfig.queryParentDefBlock,
            querrChildDefBlockForListItem:
                settingConfig.querrChildDefBlockForListItem,
            queryChildDefBlockForHeadline:
                settingConfig.queryChildDefBlockForHeadline,
        };

        backlinkPanelBaseData = await getBacklinkPanelData(
            backlinkPanelDataQueryParams,
        );

        let defaultConditions =
            await BacklinkPanelFilterCriteriaService.ins.getBacklinkPanelFilterCriteria(
                rootId,
            );

        queryParams = defaultConditions.queryParams;
        backlinkPanelFilterViewExpand =
            defaultConditions.backlinkPanelFilterViewExpand;

        queryParams.pageNum = 1;

        updateRenderData();
    }

    async function updateRenderData() {
        backlinkPanelRenderData = await getBacklinkPanelRenderData(
            backlinkPanelBaseData,
            queryParams,
        );
        queryParams = queryParams;

        refreshFilterDisplayData();

        refreshBacklinkPreview();
    }

    async function pageTurning(pageNumParam: number) {
        if (
            pageNumParam < 1 ||
            pageNumParam > backlinkPanelRenderData.totalPage
        ) {
            return;
        }
        queryParams.pageNum = pageNumParam;
        let pageBacklinkPanelRenderData =
            await getTurnPageBacklinkPanelRenderData(
                backlinkPanelRenderData.rootId,
                backlinkPanelRenderData.backlinkBlockNodeArray,
                queryParams,
            );

        backlinkPanelRenderData.backlinkDocArray =
            pageBacklinkPanelRenderData.backlinkDocArray;
        backlinkPanelRenderData.pageNum = pageBacklinkPanelRenderData.pageNum;
        backlinkPanelRenderData.usedCache =
            pageBacklinkPanelRenderData.usedCache;
        queryParams = queryParams;

        refreshBacklinkPreview();
    }

    async function refreshFilterDisplayData() {
        let curDocDefBlockArray = backlinkPanelRenderData.curDocDefBlockArray;
        let relatedDefBlockArray = backlinkPanelRenderData.relatedDefBlockArray;
        let relatedDocumentArray = backlinkPanelRenderData.relatedDocumentArray;

        // 先匹配关键字
        defBlockArrayKeywordMatch(
            curDocDefBlockArray,
            queryParams.filterPanelCurDocDefBlockKeywords,
        );
        defBlockArrayKeywordMatch(
            relatedDefBlockArray,
            queryParams.filterPanelRelatedDefBlockKeywords,
        );
        defBlockArrayKeywordMatch(
            relatedDocumentArray,
            queryParams.filterPanelRelatedDocumentKeywords,
        );
        // 排序
        await defBlockArraySort(
            curDocDefBlockArray,
            queryParams.filterPanelCurDocDefBlockSortMethod,
        );
        await defBlockArraySort(
            relatedDefBlockArray,
            queryParams.filterPanelRelatedDefBlockSortMethod,
        );
        await defBlockArraySort(
            relatedDocumentArray,
            queryParams.filterPanelRelatedDocumentSortMethod,
        );

        backlinkPanelRenderData = backlinkPanelRenderData;
        // console.log("refreshFilterDisplayData ", backlinkPanelRenderData);
    }

    function refreshBacklinkPreview() {
        clearBacklinkProtyleList();

        batchCreateOfficialBacklinkProtyle(
            backlinkPanelRenderData.relatedDocumentArray,
            backlinkPanelRenderData.backlinkDocArray,
        );

        if (backlinkPanelRenderData.usedCache) {
            const cacheMarkElement = document.createElement("div");
            backlinkULElement.inert;
            cacheMarkElement.innerText = "此次查询使用了缓存数据";
            backlinkULElement.prepend(cacheMarkElement);
        }
    }

    function clearBacklinkProtyleList() {
        if (isArrayNotEmpty(editors)) {
            editors.forEach((item) => {
                item.destroy();
            });
        }
        editors = [];
        if (backlinkULElement) {
            backlinkULElement.innerHTML = "";
        }
    }

    function batchCreateOfficialBacklinkProtyle(
        relatedDocumentArray: DefBlock[],
        backlinkDocArray: IBacklinkData[],
    ) {
        if (isArrayEmpty(backlinkDocArray)) {
            let pElement = document.createElement("p");
            pElement.style.padding = "5px 15px";
            pElement.innerText = window.siyuan.languages.emptyContent;
            backlinkULElement.append(pElement);
        }

        for (const backlinkDoc of backlinkDocArray) {
            queryParams.includeRelatedDefBlockIds;
            let backlinkNode = backlinkDoc.backlinkBlock;
            let notebookId = backlinkNode.box;

            let documentName: string = "";
            for (const document of relatedDocumentArray) {
                if (document.id == backlinkNode.root_id) {
                    documentName = document.content;
                    break;
                }
            }
            let backlinkRootId = backlinkDoc.blockPaths[0].id;
            let backlinkRootHpath = backlinkDoc.blockPaths[0].name;

            createdDocumentLiElement(
                documentName,
                backlinkRootId,
                backlinkRootHpath,
            );

            let backlinks: IBacklinkData[] = [backlinkDoc];
            const editorElement = document.createElement("div");
            editorElement.style.minHeight = "auto";

            backlinkULElement.append(editorElement);
            const editor = new Protyle(EnvConfig.ins.app, editorElement, {
                blockId: backlinkRootId,
                backlinkData: backlinks,
                render: {
                    background: false,
                    title: false,
                    gutter: true,
                    scroll: false,
                    breadcrumb: false,
                },
            });
            editor.protyle.notebookId = notebookId;
            editors.push(editor);
        }
    }

    function createdDocumentLiElement(
        documentName: string,
        backlinkRootId: string,
        backlinkRootHpath: string,
    ) {
        let documentLiElement = document.createElement("li");

        documentLiElement.classList.add(
            "b3-list-item",
            "b3-list-item--hide-action",
            // "b3-list-item__text",
            "list-item__document-name",
        );
        documentLiElement.setAttribute("data-node-id", backlinkRootId);

        documentLiElement.innerHTML = `
<span style="padding-left: 4px;margin-right: 2px" class="b3-list-item__toggle b3-list-item__toggle--hl">
<svg class="b3-list-item__arrow b3-list-item__arrow--open"><use xlink:href="#iconRight"></use></svg>
</span>
<svg class="b3-list-item__graphic popover__block"><use xlink:href="#iconFile"></use></svg>
<span class="b3-list-item__text" class="ariaLabel" aria-label="${backlinkRootHpath}"  >
${documentName}
</span>
<svg class="b3-list-item__graphic counter ariaLabel expand-listitem-icon" aria-label="展开所有列表项"><use xlink:href="#LiElementExpand"></use></svg>
`;
        documentLiElement.addEventListener("click", (event: MouseEvent) => {
            clickBacklinkDocumentLi(event);
        });

        documentLiElement
            .querySelector(
                "li > svg.b3-list-item__graphic.counter.ariaLabel.expand-listitem-icon",
            )
            .addEventListener("click", (event: MouseEvent) => {
                expandLiElement(event);
                event.stopPropagation();
            });

        backlinkULElement.append(documentLiElement);
    }

    function getDefBlockAriaLabel(
        defBlock: DefBlock,
        showContent: boolean = false,
    ): string {
        let ariaLabel = "";
        if (!defBlock) {
            return ariaLabel;
        }
        let ariaLabelRow = [];
        if (defBlock.name) {
            ariaLabelRow.push(
                `<br>${window.siyuan.languages.name}: ${defBlock.name}`,
            );
        }
        if (defBlock.alias) {
            ariaLabelRow.push(
                `<br>${window.siyuan.languages.alias}: ${defBlock.alias}`,
            );
        }
        if (defBlock.anchor) {
            ariaLabelRow.push(
                `<br>${window.siyuan.languages.anchor}: ${defBlock.anchor}`,
            );
        }
        if (showContent) {
            ariaLabelRow.push(`<br> ${defBlock.content.substring(0, 100)}`);
        }
        // if (defBlock.memo) {
        //     ariaLabelRow.push(
        //         `<br>${window.siyuan.languages.memo} ${defBlock.memo}`,
        //     );
        // }
        ariaLabel = ariaLabelRow.join("");
        ariaLabel = removePrefixAndSuffix(ariaLabel, "<br>", "<br>");
        return ariaLabel;
    }

    function clearCacheAndRefresh() {
        CacheManager.ins.deleteBacklinkPanelAllCache(rootId);
        initData();
    }

    // 处理定义块点击事件
    function handleRelatedDefBlockClick(event, defBlock: DefBlock) {
        if (event) {
        }
        clickCount++;
        if (clickCount === 1) {
            // console.log(`关联块左键单击 : ${event.type} ${event.button}`);
            clearTimeout(clickTimeoutId);
            clickTimeoutId = setTimeout(() => {
                clickCount = 0;
                addIncludeRelatedDefBlockCondition(defBlock);
            }, doubleClickTimeout);
        } else {
            // console.log(`关联块左键双击 : ${event.type} ${event.button}`);
            clearTimeout(clickTimeoutId);
            clickCount = 0;
            addExcludeRelatedDocBlockCondition(defBlock);
        }
    }
    function handleRelatedDefBlockContextmenu(event, defBlock: DefBlock) {
        if (event) {
        }
        // console.log(`关联块右键单击 : ${event.type} ${event.button}`);
        addExcludeRelatedDefBlockCondition(defBlock);
    }

    // 处理文档块点击事件
    function handleRelatedDocBlockClick(event, defBlock: DefBlock) {
        if (event) {
        }
        clickCount++;
        if (clickCount === 1) {
            clearTimeout(clickTimeoutId);
            clickTimeoutId = setTimeout(() => {
                // console.log(`文档块左键单击 : ${event.type} ${event.button}`);
                clickCount = 0;
                addIncludeRelatedDocBlockCondition(defBlock);
            }, doubleClickTimeout);
        } else {
            // console.log(`文档块左键双击 : ${event.type} ${event.button}`);
            clearTimeout(clickTimeoutId);
            clickCount = 0;
            addExcludeRelatedDocBlockCondition(defBlock);
        }
    }
    function handleRelatedDocBlockContextmenu(event, defBlock: DefBlock) {
        if (event) {
        }
        // console.log(`文档块右键单击 : ${event.type} ${event.button}`);
        addExcludeRelatedDocBlockCondition(defBlock);
    }

    function addIncludeRelatedDefBlockCondition(defBlock: DefBlock) {
        let includeRelatedDefBlockIds = queryParams.includeRelatedDefBlockIds;
        let defBlockId = defBlock.id;
        let recover = recoverDefBlockStatus(defBlock);
        if (!recover) {
            includeRelatedDefBlockIds.add(defBlockId);
        }

        updateRenderData();
    }

    function addExcludeRelatedDefBlockCondition(defBlock: DefBlock) {
        let excludeRelatedDefBlockIds = queryParams.excludeRelatedDefBlockIds;
        let defBlockId = defBlock.id;
        let recover = recoverDefBlockStatus(defBlock);
        if (!recover) {
            excludeRelatedDefBlockIds.add(defBlockId);
        }

        updateRenderData();
    }

    function addIncludeRelatedDocBlockCondition(defBlock: DefBlock) {
        let includeDocumentIds = queryParams.includeDocumentIds;
        let defBlockId = defBlock.id;
        let recover = recoverDocBlockStatus(defBlock);
        if (!recover) {
            includeDocumentIds.add(defBlockId);
        }

        updateRenderData();
    }

    function addExcludeRelatedDocBlockCondition(defBlock: DefBlock) {
        let excludeDocumentIds = queryParams.excludeDocumentIds;
        let defBlockId = defBlock.id;
        let recover = recoverDocBlockStatus(defBlock);
        if (!recover) {
            excludeDocumentIds.add(defBlockId);
        }

        updateRenderData();
    }

    function recoverDefBlockStatus(defBlock: DefBlock): boolean {
        let includeRelatedDefBlockIds = queryParams.includeRelatedDefBlockIds;
        let excludeRelatedDefBlockIds = queryParams.excludeRelatedDefBlockIds;
        let defBlockId = defBlock.id;
        if (includeRelatedDefBlockIds.has(defBlockId)) {
            includeRelatedDefBlockIds.delete(defBlockId);
            return true;
        }
        if (excludeRelatedDefBlockIds.has(defBlockId)) {
            excludeRelatedDefBlockIds.delete(defBlockId);
            return true;
        }
        return false;
    }

    function recoverDocBlockStatus(defBlock: DefBlock): boolean {
        let includeDocumentIds = queryParams.includeDocumentIds;
        let excludeDocumentIds = queryParams.excludeDocumentIds;
        let defBlockId = defBlock.id;
        if (includeDocumentIds.has(defBlockId)) {
            includeDocumentIds.delete(defBlockId);
            return true;
        }
        if (excludeDocumentIds.has(defBlockId)) {
            excludeDocumentIds.delete(defBlockId);
            return true;
        }
        return false;
    }

    function handleBacklinkKeywordInput() {
        // 清除之前的定时器
        clearTimeout(inputChangeTimeoutId);

        inputChangeTimeoutId = setTimeout(() => {
            updateRenderData();
        }, 450);
    }

    function handleFilterPanelInput() {
        // 清除之前的定时器
        clearTimeout(inputChangeTimeoutId);

        inputChangeTimeoutId = setTimeout(() => {
            refreshFilterDisplayData();
        }, 100);
    }

    function getBlockTypeIconHrefByBlock(block: Block) {
        if (!block) {
            return "";
        }
        return getBlockTypeIconHref(block.type, block.subtype);
    }

    function handleKeyDownDefault(event) {
        console.log(event.key);
    }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="backlink-panel__area" bind:this={curRootElement}>
    {#if !rootId}
        <p style="padding: 10px 20px;">
            没有获取到当前文档信息，请切换文档重试
        </p>
    {/if}
    {#if backlinkPanelBaseData && backlinkPanelBaseData.userCache}
        <p style="padding: 10px 20px;">此次面板使用了缓存数据</p>
    {/if}
    <div
        class="panel__title filter-panel__title block__icons"
        on:click={() => {
            backlinkPanelFilterViewExpand = !backlinkPanelFilterViewExpand;
        }}
        on:keydown={handleKeyDownDefault}
    >
        <div class="block__logo" style="font-weight: bold;">
            <svg class="block__logoicon"
                ><use xlink:href="#iconFilter"></use></svg
            >筛选面板
        </div>
        <span class="fn__flex-1"></span>
        <span class="fn__space"></span>
        <span
            class="block__icon b3-tooltips b3-tooltips__sw"
            aria-label="清除缓存并刷新"
            on:click|stopPropagation={clearCacheAndRefresh}
            on:keydown={handleKeyDownDefault}
            ><svg class=""><use xlink:href="#iconRefresh"></use></svg></span
        >
        <span class="fn__space"></span>
        {#if backlinkPanelFilterViewExpand}
            <span
                class="block__icon b3-tooltips b3-tooltips__sw"
                aria-label="折叠"
            >
                <svg><use xlink:href="#iconContract"></use></svg>
            </span>
        {/if}
        {#if !backlinkPanelFilterViewExpand}
            <span
                class="block__icon b3-tooltips b3-tooltips__sw"
                aria-label="展开"
            >
                <svg><use xlink:href="#iconExpand"></use></svg>
            </span>
        {/if}
    </div>
    <!-- 筛选条件区域 -->
    {#if backlinkPanelRenderData && backlinkPanelFilterViewExpand}
        <div class="backlink-panel-filter">
            <h3>当前文档定义块：</h3>
            <div>
                <div class="fn__flex">
                    <select
                        class="b3-select fn__flex-center"
                        bind:value={queryParams.filterPanelCurDocDefBlockSortMethod}
                        on:change={refreshFilterDisplayData}
                    >
                        {#each CUR_DOC_DEF_BLOCK_SORT_METHOD_ELEMENT() as element}
                            <option
                                value={element.value}
                                selected={element.value ==
                                    queryParams.filterPanelCurDocDefBlockSortMethod}
                            >
                                {element.name}
                            </option>
                        {/each}
                    </select>
                    <span class="fn__space"></span>
                    <input
                        class="b3-text-field fn__size200"
                        on:input={handleFilterPanelInput}
                        bind:value={queryParams.filterPanelCurDocDefBlockKeywords}
                    />
                </div>
                <div class="defblock-list">
                    {#each backlinkPanelRenderData.curDocDefBlockArray as defBlock (defBlock.id)}
                        {#if !defBlock.filterStatus}
                            <div
                                id={defBlock.id}
                                class="tag ariaLabel {defBlock.selectionStatus.toLowerCase()}"
                                aria-label={getDefBlockAriaLabel(
                                    defBlock,
                                    true,
                                )}
                                on:click|preventDefault={(event) =>
                                    handleRelatedDefBlockClick(event, defBlock)}
                                on:contextmenu|preventDefault={(event) =>
                                    handleRelatedDefBlockContextmenu(
                                        event,
                                        defBlock,
                                    )}
                                on:keydown={handleKeyDownDefault}
                            >
                                <svg class="b3-list-item__graphic">
                                    <use
                                        xlink:href={getBlockTypeIconHrefByBlock(
                                            defBlock,
                                        )}
                                    ></use>
                                </svg>
                                <span class="block-content">
                                    {defBlock.content}
                                </span>
                                <span class="count">{defBlock.refCount}</span>
                            </div>
                        {/if}
                    {/each}
                </div>
            </div>

            <h3>关联的定义块：</h3>
            <div>
                <div class="fn__flex">
                    <select
                        class="b3-select fn__flex-center"
                        bind:value={queryParams.filterPanelRelatedDefBlockSortMethod}
                        on:change={refreshFilterDisplayData}
                    >
                        {#each RELATED_DEF_BLOCK_SORT_METHOD_ELEMENT() as element}
                            <option
                                value={element.value}
                                selected={element.value ==
                                    queryParams.filterPanelRelatedDefBlockSortMethod}
                            >
                                {element.name}
                            </option>
                        {/each}
                    </select>
                    <input
                        class="b3-text-field fn__size200"
                        on:input={handleFilterPanelInput}
                        bind:value={queryParams.filterPanelRelatedDefBlockKeywords}
                    />
                </div>
                <div class="defblock-list">
                    {#each backlinkPanelRenderData.relatedDefBlockArray as defBlock (defBlock.id)}
                        {#if !defBlock.filterStatus}
                            <div
                                class="tag ariaLabel {defBlock.selectionStatus.toLowerCase()}"
                                aria-label={getDefBlockAriaLabel(
                                    defBlock,
                                    true,
                                )}
                                on:click={(event) =>
                                    handleRelatedDefBlockClick(event, defBlock)}
                                on:contextmenu|preventDefault={(event) =>
                                    handleRelatedDefBlockContextmenu(
                                        event,
                                        defBlock,
                                    )}
                                on:keydown={handleKeyDownDefault}
                            >
                                <svg class="b3-list-item__graphic">
                                    <use
                                        xlink:href={getBlockTypeIconHrefByBlock(
                                            defBlock,
                                        )}
                                    ></use>
                                </svg>
                                <span class="block-content">
                                    {defBlock.content}
                                </span>
                                <span class="count">{defBlock.refCount}</span>
                            </div>
                        {/if}
                    {/each}
                </div>
            </div>
            <h3>反链所在文档：</h3>
            <div>
                <div class="fn__flex">
                    <select
                        class="b3-select fn__flex-center"
                        bind:value={queryParams.filterPanelRelatedDocumentSortMethod}
                        on:change={refreshFilterDisplayData}
                    >
                        {#each RELATED_DOCMUMENT_SORT_METHOD_ELEMENT() as element}
                            <option
                                value={element.value}
                                selected={element.value ==
                                    queryParams.filterPanelRelatedDocumentSortMethod}
                            >
                                {element.name}
                            </option>
                        {/each}
                    </select>
                    <input
                        class="b3-text-field fn__size200"
                        on:input={handleFilterPanelInput}
                        bind:value={queryParams.filterPanelRelatedDocumentKeywords}
                    />
                </div>
                <div class="defblock-list">
                    {#each backlinkPanelRenderData.relatedDocumentArray as defBlock (defBlock.id)}
                        {#if !defBlock.filterStatus}
                            <!-- svelte-ignore a11y-no-static-element-interactions -->
                            <div
                                class="tag ariaLabel {defBlock.selectionStatus.toLowerCase()}"
                                aria-label={getDefBlockAriaLabel(
                                    defBlock,
                                    true,
                                )}
                                on:click={(event) =>
                                    handleRelatedDocBlockClick(event, defBlock)}
                                on:contextmenu|preventDefault={(event) =>
                                    handleRelatedDocBlockContextmenu(
                                        event,
                                        defBlock,
                                    )}
                                on:keydown={handleKeyDownDefault}
                            >
                                <svg class="b3-list-item__graphic">
                                    <use
                                        xlink:href={getBlockTypeIconHrefByBlock(
                                            defBlock,
                                        )}
                                    ></use>
                                </svg>
                                <span class="block-content">
                                    {defBlock.content}
                                </span>
                                <span class="count">{defBlock.refCount}</span>
                            </div>
                        {/if}
                    {/each}
                </div>
            </div>
        </div>
    {/if}
    <hr />
    <!-- 反链块展示区 -->
    <div
        class="panel__title backlink-panel__title block__icons"
        style=" cursor: default;"
    >
        <div class="block__logo" style="font-weight: bold;">
            <svg class="block__logoicon"><use xlink:href="#iconLink"></use></svg
            >反向链接
        </div>
    </div>
    <div class="backlinkList fn__flex-1">
        {#if queryParams && backlinkPanelRenderData && isArrayNotEmpty(backlinkPanelRenderData.backlinkDocArray)}
            <div class="fn__flex" style="padding: 5px 15px;">
                <select
                    class="b3-select fn__flex-center"
                    bind:value={queryParams.backlinkBlockSortMethod}
                    on:change={updateRenderData}
                >
                    {#each BACKLINK_BLOCK_SORT_METHOD_ELEMENT() as element}
                        <option
                            value={element.value}
                            selected={element.value ==
                                queryParams.backlinkBlockSortMethod}
                        >
                            {element.name}
                        </option>
                    {/each}
                </select>

                <input
                    class="b3-text-field fn__size200"
                    on:input={handleBacklinkKeywordInput}
                    bind:value={queryParams.keywordStr}
                />
            </div>
            <div>
                <div class="block__icons" style="overflow:auto">
                    <span
                        class="fn__flex-shrink ft__selectnone {backlinkPanelRenderData.totalPage ==
                            null || backlinkPanelRenderData.totalPage == 0
                            ? 'fn__none'
                            : ''}"
                    >
                        <span class="fn__space"></span>

                        <span class="ft__on-surface">
                            {EnvConfig.ins.i18n.findInBacklink.replace(
                                "${x}",
                                backlinkPanelRenderData.backlinkBlockNodeArray
                                    .length,
                            )}
                        </span>
                    </span>
                    <span class="fn__space"></span>
                    <span class="fn__flex-1" style="min-height: 100%"></span>

                    <span
                        class="fn__flex-shrink ft__selectnone {backlinkPanelRenderData.totalPage ==
                            null || backlinkPanelRenderData.totalPage == 0
                            ? 'fn__none'
                            : ''}"
                    >
                        {backlinkPanelRenderData.pageNum}/{backlinkPanelRenderData.totalPage}
                    </span>

                    <span class="fn__space"></span>
                    <span
                        data-position="9bottom"
                        class="block__icon block__icon--show ariaLabel {backlinkPanelRenderData.pageNum <=
                        1
                            ? 'disabled'
                            : ''}"
                        aria-label={EnvConfig.ins.i18n.previousLabel}
                        on:click={() => {
                            pageTurning(backlinkPanelRenderData.pageNum - 1);
                        }}
                        on:keydown={handleKeyDownDefault}
                        ><svg><use xlink:href="#iconLeft"></use></svg></span
                    >
                    <span class="fn__space"></span>
                    <span
                        data-position="9bottom"
                        class="block__icon block__icon--show ariaLabel {backlinkPanelRenderData.pageNum >=
                        backlinkPanelRenderData.totalPage
                            ? 'disabled'
                            : ''}"
                        aria-label={EnvConfig.ins.i18n.nextLabel}
                        on:click={() => {
                            pageTurning(backlinkPanelRenderData.pageNum + 1);
                        }}
                        on:keydown={handleKeyDownDefault}
                        ><svg><use xlink:href="#iconRight"></use></svg></span
                    >
                    <span class="fn__space"></span>
                </div>
            </div>
        {/if}

        <div class="sy__backlink">
            <ul
                bind:this={backlinkULElement}
                class="b3-list b3-list--background"
            ></ul>
        </div>
    </div>
</div>

<style>
    .tag {
        display: inline-flex;
        align-items: center;
        padding: 3px 12px 3px 3px;
        margin: 4px 4px 4px 2px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid transparent;
        position: relative; /* 为了绝对定位的小数字 */
        max-width: 120px;
        max-height: 30px;
        overflow: hidden; /* 隐藏超出部分的文本 */
        text-overflow: ellipsis; /* 超出部分显示省略号 */
        vertical-align: top; /* 垂直对齐 */
        font-size: 12px;
        white-space: nowrap; /* 禁止换行 */
    }
    .tag:hover {
        border-color: rgba(0, 0, 0, 0.2);
    }
    .selected {
        background-color: green;
        color: white;
    }
    .excluded {
        background-color: black;
        color: white;
    }
    .optional {
        background-color: var(--b3-theme-background);
        color: var(--b3-theme-on-background);
        border: 2px solid black;
    }
    .tag:active {
        transform: scale(0.95);
    }
    .b3-list-item__graphic {
        margin: 1px 0px 0px;
        height: 11px;
        padding: 0px 0px;
    }
    .block-content {
        text-overflow: ellipsis; /* 显示省略号 */
        overflow: hidden; /* 隐藏溢出部分 */
        white-space: nowrap; /* 禁止换行 */
        flex-shrink: 1; /* 允许文本缩小以适应容器 */
    }
    .count {
        position: absolute;
        top: 0px;
        right: 0px;
        /* background: red; */
        /* color: white; */
        border-radius: 20%;
        padding: 2px 5px;
        font-size: 10px;
    }

    .panel__title {
        /* color: var(--b3-theme-on-surface); */
        cursor: pointer;
        border: 0;
        opacity: 1;
        background: rgba(0, 0, 0, 0);
        flex-shrink: 0;
        padding: 2px 10px;
        display: flex;
        align-items: center;
        border-radius: var(--b3-border-radius);
        transition:
            var(--b3-transition),
            opacity 0.3s cubic-bezier(0, 0, 0.2, 1) 0ms;
        line-height: 14px;
        min-height: 30px;
        height: 35px;
    }
    .filter-panel__title:hover {
        color: var(--b3-theme-on-background);
        background-color: var(--b3-list-icon-hover);
    }
    .backlink-panel-filter {
        margin: 0px 5px;
        padding: 6px 3px 6px 13px;
        transition:
            transform 0.3s ease,
            box-shadow 0.3s ease;
    }
    /* 悬停效果 */
    .backlink-panel-filter:hover {
        /* border: 1px solid #ccc; */
        /* transform: translateY(-2px); 悬浮效果 */
        box-shadow:
            0 2px 4px rgba(0, 0, 0, 0.2),
            /* 上边的阴影 */ 0 3px 10px rgba(0, 0, 0, 0.19); /* 四周的阴影 */
    }
    .defblock-list {
        min-height: 30px;
        max-height: 96px; /* 设置最大高度 */
        overflow-y: auto; /* 当内容超过最大高度时显示垂直滚动条 */
        padding: 6px 0px 6px 10px; /* 内边距 */
        background-color: var(--b3-list-hover); /* 背景颜色 */
        border-radius: 6px;
    }

    select {
        /* max-width: 120px; */
        padding-right: 23px;
        width: 100%;
        flex: 1;
    }
    input {
        /* max-width: 100px; */
        width: 100%;
        flex: 1;
    }
    h3 {
        margin: 6px 0px;
    }
    .fn__flex {
        margin-bottom: 10px;
    }
    .backlinkList {
        margin-bottom: 200px;
    }
    .block__icon {
        opacity: 1;
    }
    .backlinkList .b3-text-field:not(.b3-text-field:focus) {
        box-shadow: inset 0 0 0 1px var(--b3-layout-resize);
    }
</style>
