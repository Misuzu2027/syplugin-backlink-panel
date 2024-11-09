import { IBacklinkBlockQueryParams } from "@/models/backlink-model";
import { isArrayEmpty, isArrayNotEmpty } from "@/utils/array-util";
import { isStrBlank } from "@/utils/string-util";



/**
 * 查询指定块下面的所有定义块
 * @param queryParams 
 * @returns 
 */
export function generateGetDefBlockArraySql(paramObj: {
    rootId: string, focusBlockId?: string, queryCurDocDefBlockRange?: string
}
): string {
    let rootId = paramObj.rootId;
    let focusBlockId = paramObj.focusBlockId;
    let queryCurDocDefBlockRange = paramObj.queryCurDocDefBlockRange;
    let sql = "";
    if (focusBlockId && focusBlockId != rootId) {
        sql = `
        WITH RECURSIVE cte AS (
            SELECT *
            FROM blocks
            WHERE id = '${focusBlockId}' AND root_id = '${rootId}'
            UNION ALL
            SELECT t.*
            FROM blocks t
            INNER JOIN cte ON t.parent_id = cte.id
            WHERE t.root_id = '${rootId}'
        )
        SELECT cte.*,rc.ref_count AS ref_count
        FROM cte
        INNER JOIN refs ON cte.id = refs.def_block_id 
            AND refs.def_block_root_id = '${rootId}'
        LEFT JOIN (
            SELECT def_block_id, COUNT(1) AS ref_count
            FROM refs
            GROUP BY def_block_id
        ) rc 
        WHERE  cte.id = rc.def_block_id
        GROUP BY cte.id, rc.ref_count
        LIMIT 999999999;
        `
        /**
         * 其他简单写法。
        SELECT DISTINCT cte.*,(SELECT count(1) FROM refs rc WHERE cte.id = rc.def_block_id)
        FROM cte 
        INNER JOIN refs ON cte.id = refs.def_block_id AND refs.def_block_root_id = '${rootId}'
         */
    } else {
        let refBlockIdFieldSql = `,CASE WHEN root_id != '${rootId}' THEN ( SELECT block_id FROM refs WHERE root_id = '${rootId}' AND def_block_id = blocks.id )  END AS refBlockId`;
        let refWhereSql = `def_block_root_id = '${rootId}'`;
        if (queryCurDocDefBlockRange == "curDocRefDefBlock") {
            refWhereSql = ` root_id = '${rootId}'`;
        } else if (queryCurDocDefBlockRange == "all") {
            refWhereSql = `def_block_root_id = '${rootId}' OR root_id = '${rootId}'`;
        }
        sql = `
        SELECT * ,(
            SELECT count(refs.def_block_id) FROM refs WHERE refs.def_block_id = blocks.id 
            ) AS refCount
        ${queryCurDocDefBlockRange == "curDocDefBlock" ? "" : refBlockIdFieldSql}
        FROM blocks
        WHERE id in (
          SELECT DISTINCT def_block_id 
          FROM refs
          WHERE ${refWhereSql}
        )
        LIMIT 999999999;
        `
    }

    return cleanSpaceText(sql);
}


export function generateGetParentDefBlockArraySql(
    queryParams: IBacklinkBlockQueryParams,
): string {
    let defBlockIds = queryParams.defBlockIds;
    let backlinkBlockIds = queryParams.backlinkBlockIds;

    let backlinkIdInSql = "";
    if (isArrayNotEmpty(backlinkBlockIds)) {
        backlinkIdInSql = generateAndInConditions("id", backlinkBlockIds);
    } else if (isArrayNotEmpty(defBlockIds)) {
        let defBlockIdInSql = generateAndInConditions("def_block_id", defBlockIds);
        backlinkIdInSql = `AND id IN ( SELECT block_id FROM refs WHERE 1 = 1 ${defBlockIdInSql} ) `
    }
    if (isStrBlank(backlinkIdInSql)) {
        return "";
    }


    let sql = `
    WITH RECURSIVE parent_block AS (
    SELECT id, parent_id, markdown, type, CAST (id AS TEXT) AS childIdPath 
    FROM  blocks 
    WHERE 1 = 1  ${backlinkIdInSql}
    UNION ALL 
    SELECT t.id, t.parent_id, t.markdown, t.type, (p.childIdPath || '->' || t.id) AS childIdPath 
    FROM blocks t 
        INNER JOIN parent_block p ON t.id = p.parent_id
    WHERE t.type NOT IN ( 'd', 'c', 'm', 't', 'p', 'tb', 'html', 'video', 'audio', 'widget', 'iframe', 'query_embed' )
    ) 
    SELECT id, parent_id, type, childIdPath, CASE WHEN type = 'i' THEN '' ELSE markdown END AS markdown
    FROM parent_block 
    WHERE 1 == 1 
    AND( ( type = 'i' ) OR ( type = 'h' AND markdown LIKE '%((%))%' ) )
    LIMIT 999999999;
    `

    /**
     *  
     */

    /**
     * 在 Navicat 测试来看，
     *1. AND type in ('h','i') 
     * 效率高,
     * 用下面这种可以减少返回数据，在数据量大并且伺服的时候更有有优势。
2.    AND (type = 'h' AND markdown LIKE '%((%))%') 
    OR (type = 'i' AND parentListItemMarkdown LIKE '%((%))%')
    最终打算替换成正则表达式，速度可能跟2差不多，但是更准确
3. AND markdown REGEXP '\\(\\((\\d{14}-[a-zA-Z0-9]{7})\\s''[^'']+''\\)\\)'
4. 存在较多反链块的时候，性能极差，决定分离
     */

    return cleanSpaceText(sql);
}


export function generateGetParenListItemtDefBlockArraySql(
    queryParams: IBacklinkBlockQueryParams,
): string {

    let backlinkParentBlockIds = queryParams.backlinkAllParentBlockIds;
    let idInSql = generateAndInConditions("parent_id", backlinkParentBlockIds);


    let sql = `
    SELECT parent_id,GROUP_CONCAT(markdown) as subMarkdown
    FROM blocks sb 
    WHERE 1 = 1 
        ${idInSql}
        AND type NOT IN ('l', 'i') 
        AND markdown LIKE '%((%))%'
    GROUP BY parent_id
    LIMIT 999999999;
    `

    return cleanSpaceText(sql);
}

export function generateGetListItemtSubMarkdownArraySql(
    listItemIdArray: string[],
): string {
    if (isArrayEmpty(listItemIdArray)) {
        return "";
    }
    let idInSql = generateAndInConditions("parent_id", listItemIdArray);


    let sql = `
    SELECT parent_id,GROUP_CONCAT(markdown) as subMarkdown
    FROM blocks sb 
    WHERE 1 = 1 
        ${idInSql}
        AND type NOT IN ('l', 'i') 
    GROUP BY parent_id
    LIMIT 9999999999;
    `

    return cleanSpaceText(sql);
}



export function generateGetBacklinkBlockArraySql(
    queryParams: IBacklinkBlockQueryParams,
): string {
    let defBlockIds = queryParams.defBlockIds;
    let idInSql = generateAndInConditions("def_block_id", defBlockIds);

    let sql = `
    SELECT b.*
    FROM blocks b
    WHERE 1 = 1 
        AND b.id IN ( 
        	SELECT block_id 
            FROM refs 
            WHERE 1 = 1 ${idInSql}
        )
    LIMIT 9999999999;
    `
    return cleanSpaceText(sql);
}


export function generateGetBacklinkListItemBlockArraySql(
    queryParams: IBacklinkBlockQueryParams,
): string {
    let defBlockIds = queryParams.defBlockIds;
    let idInSql = generateAndInConditions("def_block_id", defBlockIds);

    let sql = `
    SELECT b.*, 
    p1.type AS parentBlockType

    FROM blocks b
    LEFT JOIN blocks p1 ON b.parent_id = p1.id

    WHERE 1 = 1 
        AND b.id IN ( 
        	SELECT block_id 
            FROM refs 
            WHERE 1 = 1 ${idInSql}
        )
    LIMIT 999999999;
    `
    /**
     , 
        CASE WHEN p1.type = 'i' 
            THEN p1.markdown 
            ELSE NULL 
        END AS parentListItemMarkdown
     */
    return cleanSpaceText(sql);
}


export function generateGetHeadlineChildDefBlockArraySql(
    queryParams: IBacklinkBlockQueryParams,
): string {
    let defBlockIds = queryParams.defBlockIds;
    let backlinkBlockIds = queryParams.backlinkBlockIds;

    let backlinkIdInSql = "";
    if (isArrayNotEmpty(backlinkBlockIds)) {
        backlinkIdInSql = generateAndInConditions("id", backlinkBlockIds);
    } else if (isArrayNotEmpty(defBlockIds)) {
        let defBlockIdInSql = generateAndInConditions("def_block_id", defBlockIds);
        backlinkIdInSql = `AND id IN ( SELECT block_id FROM refs WHERE 1 = 1 ${defBlockIdInSql} ) `
    }
    if (isStrBlank(backlinkIdInSql)) {
        return "";
    }

    let whereSql = ` AND type IN ( 'h', 'c', 'm', 't', 'p', 'html', 'av', 'video', 'audio', 'l', 's' )  `;
    //     if (!queryParams.queryAllContentUnderHeadline) {
    //         whereSql = `
    // AND type IN ( 'h', 't', 'p' )
    // AND markdown LIKE '%((%))%' 
    //         `;
    //     }



    let sql = `
    WITH RECURSIVE child_block AS (
        SELECT id,parent_id,markdown,type,CAST ( id AS TEXT ) AS parentIdPath 
        FROM blocks 
        WHERE 1 = 1 
            AND type = 'h'
            ${backlinkIdInSql}
    UNION ALL
        SELECT t.id, t.parent_id, t.markdown, t.type, ( c.parentIdPath || '->' || t.id ) AS parentIdPath 
        FROM blocks t
            INNER JOIN child_block c ON c.id = t.parent_id 
        WHERE t.type NOT IN ( 'd', 'i', 'tb', 'audio', 'widget', 'iframe', 'query_embed' ) 
        ) 
    SELECT * 
    FROM child_block 
    WHERE 1 == 1  ${whereSql} 
        LIMIT 999999999;
    `
    return cleanSpaceText(sql);
}


export function generateGetListItemChildBlockArraySql(
    queryParams: IBacklinkBlockQueryParams,
): string {
    let defBlockIds = queryParams.defBlockIds;
    let backlinkBlockIds = queryParams.backlinkBlockIds;
    let parentBlockIds = queryParams.backlinkParentListItemBlockIds;

    let idInSql = "";
    if (isArrayNotEmpty(parentBlockIds)) {
        idInSql = generateAndInConditions("id", parentBlockIds);
    } else if (isArrayNotEmpty(backlinkBlockIds)) {
        let backlinkIdInSql = generateAndInConditions("id", backlinkBlockIds);
        idInSql = `AND id IN ( SELECT parent_id FROM blocks WHERE 1 = 1 ${backlinkIdInSql} ) `
    } else if (isArrayNotEmpty(defBlockIds)) {
        let defBlockIdInSql = generateAndInConditions("def_block_id", defBlockIds);
        idInSql = `AND id IN ( SELECT parent_id FROM blocks WHERE 1 =1 AND id IN ( SELECT block_id FROM refs WHERE 1 = 1 ${defBlockIdInSql} ) )`
    }
    if (isStrBlank(idInSql)) {
        return "";
    }

    let sql = `
    WITH RECURSIVE child_block AS (
        SELECT id,parent_id,type,CAST ( id AS TEXT ) AS parentIdPath 
        FROM blocks 
        WHERE 1 = 1 
            ${idInSql}
            AND type = 'i' 
    UNION ALL
        SELECT t.id,t.parent_id,t.type,( c.parentIdPath || '->' || t.id ) AS parentIdPath 
        FROM blocks t INNER JOIN child_block c ON c.id = t.parent_id 
    )
    SELECT * 
    FROM child_block 
    WHERE 1 == 1 AND type IN ( 'i' ) 
        LIMIT 999999999;
    `
    /**
     * todo 先这样，等后续过两个版本后，都有父级索引后再优化。
,
    (SELECT GROUP_CONCAT( markdown ) FROM blocks sb 
        WHERE 1 = 1 AND sb.parent_id = child_block.id AND sb.type NOT IN ( 'l', 'i' ) GROUP BY sb.parent_id 
    ) AS subMarkdown 
     */
    return cleanSpaceText(sql);
}

export function generateGetBlockArraySql(
    blockIds: string[],
): string {
    let idInSql = generateAndInConditions("id", blockIds);

    let sql = `
    SELECT b.*
    FROM blocks b
    WHERE 1 = 1 
    ${idInSql}
    LIMIT 999999999;
    `
    return cleanSpaceText(sql);
}

export function getParentIdIdxInfoSql() {
    let sql = `
    PRAGMA index_info(idx_blocks_parent_id_backlink_panel_plugin);
    `
    return cleanSpaceText(sql);
}

export function getCreateBlocksParentIdIdxSql() {
    let sql = `
    CREATE INDEX idx_blocks_parent_id_backlink_panel_plugin ON blocks(parent_id);
    `
    return cleanSpaceText(sql);
}


function cleanSpaceText(inputText: string): string {
    // 去除换行
    let cleanedText = inputText.replace(/[\r\n]+/g, ' ');

    // 将多个空格转为一个空格
    cleanedText = cleanedText.replace(/\s+/g, ' ');

    // 去除首尾空格
    cleanedText = cleanedText.trim();

    return cleanedText;
}

function generatMarkdownOrLikeDefBlockIdConditions(
    fieldName: string,
    params: string[],
): string {
    if (params.length === 0) {
        return " ";
    }

    const conditions = params.map(
        (param) => `${fieldName}  LIKE '%((${param} %))%'`,
    );
    const result = conditions.join(" OR ");

    return result;
}



function generateAndInConditions(
    fieldName: string,
    params: string[],
): string {
    if (!params || params.length === 0) {
        return " ";
    }
    let result = ` AND ${fieldName} IN (`
    const conditions = params.map(
        (param) => ` '${param}' `,
    );
    result = result + conditions.join(" , ") + " ) ";

    return result;
}

function generateAndNotInConditions(
    fieldName: string,
    params: string[],
): string {
    if (!params || params.length === 0) {
        return " ";
    }
    let result = ` AND ${fieldName} NOT IN (`
    const conditions = params.map(
        (param) => ` '${param}' `,
    );
    result = result + conditions.join(" , ") + " ) ";

    return result;
}

function generateInConditions(
    params: string[],
): string {
    if (!params || params.length === 0) {
        return " ";
    }
    let result = ` ( `
    const conditions = params.map(
        (param) => ` '${param}' `,
    );
    result = result + conditions.join(" , ") + " ) ";

    return result;
}

