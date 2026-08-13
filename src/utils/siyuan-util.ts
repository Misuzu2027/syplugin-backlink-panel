import { Constants, TProtyleAction } from "siyuan";
import { isStrBlank } from "./string-util";

// 用于生成随机字符串
function randStr(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function NewNodeID(): string {

  const now = new Date();
  const formattedDate = now.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14); // 格式化为 "YYYYMMDDHHMMSS"
  return `${formattedDate}-${randStr(7)}`;
}

export function getQueryStrByBlock(block: DefBlock | Block) {
  if (!block) {
    return "";
  }
  let markdown = block.markdown;
  if (isStrBlank(markdown)) {
    markdown = block.content;
  }
  return markdown + " " + block.name + " " + block.alias + " " + block.memo + " " + block.tag;

}

/**
 * 内核版本是否不低于 targetVersion，用于跟进内核行为变更时按版本开关功能。
 * 只比较数字段，忽略 -alpha / -beta 之类的后缀。
 */
export function isKernelVersionAtLeast(targetVersion: string): boolean {
  let kernelVersion: string = window?.siyuan?.config?.system?.kernelVersion;
  if (isStrBlank(kernelVersion)) {
    return false;
  }
  let currentParts = parseVersionNumberArray(kernelVersion);
  let targetParts = parseVersionNumberArray(targetVersion);
  let length = Math.max(currentParts.length, targetParts.length);
  for (let i = 0; i < length; i++) {
    let current = i < currentParts.length ? currentParts[i] : 0;
    let target = i < targetParts.length ? targetParts[i] : 0;
    if (current != target) {
      return current > target;
    }
  }
  return true;
}

function parseVersionNumberArray(version: string): number[] {
  return version.split("-")[0].split(".").map((part) => {
    let num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
}

export function getOpenTabActionByZoomIn(zoomIn: boolean): TProtyleAction[] {
  let actions: TProtyleAction[] = zoomIn
    ? [
      Constants.CB_GET_HL,
      Constants.CB_GET_FOCUS,
      Constants.CB_GET_ALL,
    ]
    : [
      Constants.CB_GET_HL,
      // Constants.CB_GET_FOCUS,
      Constants.CB_GET_CONTEXT,
      Constants.CB_GET_ROOTSCROLL,
    ];
  return actions;
}
