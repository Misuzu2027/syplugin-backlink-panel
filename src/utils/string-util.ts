export function removePrefix(input: string, prefix: string): string {
    if (input.startsWith(prefix)) {
        return input.substring(prefix.length);
    } else {
        return input;
    }
}

export function removeSuffix(input: string, suffix: string): string {
    if (input.endsWith(suffix)) {
        return input.substring(0, input.length - suffix.length);
    } else {
        return input;
    }
}

export function removePrefixAndSuffix(input: string, prefix: string, suffix: string): string {
    let result = input;

    if (result.startsWith(prefix)) {
        result = result.substring(prefix.length);
    }

    if (result.endsWith(suffix)) {
        result = result.substring(0, result.length - suffix.length);
    }

    return result;
}

export function containsAllKeywords(
    str: string,
    keywords: string[],
): boolean {
    return keywords.every(keyword => str.includes(keyword));
}


export function longestCommonSubstring(s1: string, s2: string): string {
    s1 = s1 ? s1 : "";
    s2 = s2 ? s2 : "";
    const len1 = s1.length;
    const len2 = s2.length;
    const dp: number[][] = Array.from({ length: len1 + 1 }, () =>
        Array(len2 + 1).fill(0),
    );

    let maxLength = 0;
    let endIndex = 0;

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
                if (dp[i][j] > maxLength) {
                    maxLength = dp[i][j];
                    endIndex = i;
                }
            }
        }
    }

    return s1.substring(endIndex - maxLength, endIndex);
}


export function countOccurrences(str: string, subStr: string): number {
    // 创建一个正则表达式，全局搜索指定的子字符串
    const regex = new RegExp(subStr, 'g');
    // 使用 match 方法匹配所有出现的子字符串，返回匹配结果数组
    const matches = str.match(regex);
    // 返回匹配的次数，如果没有匹配到则返回 0
    return matches ? matches.length : 0;
}
