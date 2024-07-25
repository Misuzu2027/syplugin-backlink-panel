import { isArrayEmpty } from "./array-util";

export const escapeAttr = (html: string) => {
    return html.replace(/"/g, "&quot;").replace(/'/g, "&apos;");
};



export async function highlightElementTextByCss(
    contentElement: HTMLElement,
    keywordArray: string[],

) {
    if (!contentElement || isArrayEmpty(keywordArray)) {
        return;
    }
    // If the CSS Custom Highlight API is not supported,
    // display a message and bail-out.
    if (!CSS.highlights) {
        console.log("CSS Custom Highlight API not supported.");
        return;
    }

    // Find all text nodes in the article. We'll search within
    // these text nodes.
    const treeWalker = document.createTreeWalker(
        contentElement,
        NodeFilter.SHOW_TEXT,
    );
    const allTextNodes: Node[] = [];
    let currentNode = treeWalker.nextNode();
    while (currentNode) {
        allTextNodes.push(currentNode);
        currentNode = treeWalker.nextNode();
    }


    // 默认不清除
    // clearCssHighlights();

    // Clean-up the search query and bail-out if
    // if it's empty.

    let allMatchRanges: Range[] = [];

    // Iterate over all text nodes and find matches.
    allTextNodes
        .map((el: Node) => {
            return { el, text: el.textContent.toLowerCase() };
        })
        .map(({ el, text }) => {
            const indices: { index: number; length: number }[] = [];
            for (const queryStr of keywordArray) {
                if (!queryStr) {
                    continue;
                }
                let startPos = 0;
                while (startPos < text.length) {
                    const index = text.indexOf(
                        queryStr.toLowerCase(),
                        startPos,
                    );
                    if (index === -1) break;
                    let length = queryStr.length;
                    indices.push({ index, length });
                    startPos = index + length;
                }
            }

            indices
                .sort((a, b) => a.index - b.index)
                .map(({ index, length }) => {
                    const range = new Range();
                    range.setStart(el, index);
                    range.setEnd(el, index + length);
                    allMatchRanges.push(range);

                });
        });

    // Create a Highlight object for the ranges.
    allMatchRanges = allMatchRanges.flat();
    if (!allMatchRanges || allMatchRanges.length <= 0) {
        return;
    }

    let searchResultsHighlight = CSS.highlights.get("search-result-mark");
    if (searchResultsHighlight) {
        for (const range of allMatchRanges) {
            searchResultsHighlight.add(range);
        }
    } else {
        searchResultsHighlight = new Highlight(...allMatchRanges);
    }

    // Register the Highlight object in the registry.
    CSS.highlights.set("search-result-mark", searchResultsHighlight);

}

export function clearCssHighlights() {
    CSS.highlights.delete("search-result-mark");
    CSS.highlights.delete("search-result-focus");
}



export function highlightContent(content: string, keywords: string[]): string {
    if (!content) {
        return content;
    }
    let contentHtml = getHighlightedContent(content, keywords);
    return contentHtml;
}

export function clearProtyleGutters(target: HTMLElement) {
    if (!target) {
        return;
    }
    target.querySelectorAll(".protyle-gutters").forEach((item) => {
        item.classList.add("fn__none");
        item.innerHTML = "";
    });
}


// 查找可滚动的父级元素
export function findScrollableParent(element: HTMLElement) {
    if (!element) {
        return null;
    }

    // const hasScrollableSpace = element.scrollHeight > element.clientHeight;
    const hasVisibleOverflow = getComputedStyle(element).overflowY !== 'visible';

    if (hasVisibleOverflow) {
        return element;
    }

    return findScrollableParent(element.parentElement);
}




function getHighlightedContent(
    content: string,
    keywords: string[],
): string {
    if (!content) {
        return content;
    }
    // let highlightedContent: string = escapeHtml(content);
    let highlightedContent: string = content;

    if (keywords) {
        highlightedContent = highlightMatches(highlightedContent, keywords);
    }
    return highlightedContent;
}

function highlightMatches(content: string, keywords: string[]): string {
    if (!keywords.length || !content) {
        return content; // 返回原始字符串，因为没有需要匹配的内容
    }

    const regexPattern = new RegExp(`(${keywords.join("|")})`, "gi");
    const highlightedString = content.replace(
        regexPattern,
        "<span class='search-mark'>$1</span>",
    );
    return highlightedString;
}

function escapeHtml(input: string): string {
    const escapeMap: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    };

    return input.replace(/[&<>"']/g, (match) => escapeMap[match]);
}



export function getElementsBeforeDepth(rootElement: HTMLElement, selector: string, depth: number) {
    const result = [];

    function recursiveSearch(node: Element, currentDepth: number) {
        if (currentDepth > depth || syHasChildListNode(node)) {
            return;
        }
        const targetElements = node.querySelectorAll(':scope > ' + selector);
        for (const element of targetElements) {
            result.push(element);
            const childNodes = element.children;
            for (let i = 0; i < childNodes.length; i++) {
                recursiveSearch(childNodes[i], currentDepth + 1);
            }
        }

    }

    recursiveSearch(rootElement, 0)

    return result;
}


export function getElementsAtDepth(rootElement: Element, selector: string, depth: number) {
    const result = [];

    function recursiveSearch(node: Element, currentDepth: number) {
        const targetElements = node.querySelectorAll(':scope > ' + selector);

        if (currentDepth === depth) {
            targetElements.forEach(element => result.push(element));
            return;
        }
        for (const element of targetElements) {
            const childNodes = element.children;
            for (let i = 0; i < childNodes.length; i++) {
                recursiveSearch(childNodes[i], currentDepth + 1);
            }
        }

    }


    recursiveSearch(rootElement, 0);
    return result;
}


export function syHasChildListNode(root: Element): boolean {
    // 获取 root 的所有子节点
    const children = Array.from(root.children) as HTMLElement[];

    // 确保有至少三个子节点
    if (children.length < 3) {
        return false;
    }

    // 获取第三个子节点
    const thirdChild = children[2];

    // 检查第三个子节点是否符合条件
    if (
        thirdChild.matches('[data-type="NodeList"].list') &&
        thirdChild.hasAttribute('data-node-id')
    ) {
        return true;
    }

    return false;
}