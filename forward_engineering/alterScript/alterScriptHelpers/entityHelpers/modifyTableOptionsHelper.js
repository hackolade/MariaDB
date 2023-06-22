const {AlterScriptDto} = require("../../types/AlterScriptDto");

/**
 * @return {(collection: Object) => AlterScriptDto | undefined}
 * */
const getModifyTableOptionsDto = (_, ddlProvider) => (collection) => {
    const {
        getTableName,
        getCompMod,
        getDatabaseName,
        getCollectionName,
        getCollectionSchema,
    } = require('../../../utils/general')({_});

    const tableData = {...collection, ...(collection?.role || {})};

    const compMod = getCompMod(tableData);
    const isDefaultModified = compMod.tableOptions?.new?.defaultCharSet !== compMod.tableOptions?.old?.defaultCharSet;
    const isCharacterSetModified = compMod.tableOptions?.new?.characterSet !== compMod.tableOptions?.old?.characterSet;
    const isCollationModified = compMod.tableOptions?.new?.collation !== compMod.tableOptions.collation?.old?.collation;

    if (isCharacterSetModified || isCollationModified || isDefaultModified) {
        const collectionSchema = getCollectionSchema(collection);
        const collectionName = getCollectionName(collectionSchema);
        const databaseName = getDatabaseName(collection);
        const fullTableName = getTableName(collectionName, databaseName);

        const script = ddlProvider.modifyTableOptions(fullTableName, tableData.tableOptions);
        return AlterScriptDto.getInstance([script], true, false);
    }
    return undefined;
}

module.exports = {
    getModifyTableOptionsDto
}
