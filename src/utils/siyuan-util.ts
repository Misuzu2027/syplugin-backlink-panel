
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
  return block.content + " " + block.name + " " + block.alias + " " + block.memo + " " + block.tag;

}