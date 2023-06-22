const {AlterScriptDto} = require("../../types/AlterScriptDto");

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getUpdateTypesScriptDtos = (_, ddlProvider) => (collection) => {
    const {
        getTableName,
        checkFieldPropertiesChanged,
        wrapInTics,
        getCollectionSchema,
        getCollectionName,
        getDatabaseName
    } = require('../../../utils/general')({_});
    const {createColumnDefinitionBySchema} = require('../createColumnDefinition')(_);

    const collectionSchema = getCollectionSchema(collection);
    const tableName = getCollectionName(collectionSchema);
    const databaseName = getDatabaseName(collectionSchema);
    const fullName = getTableName(tableName, databaseName);
    const dbData = {databaseName};

    return _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => checkFieldPropertiesChanged(jsonSchema.compMod, ['type', 'mode']))
        .map(([name, jsonSchema]) => {
            const dropColumnDdlName = wrapInTics(name);
            const dropScript = ddlProvider.dropColumn(fullName, dropColumnDdlName);

            const columnDefinition = ddlProvider.convertColumnDefinition(
                createColumnDefinitionBySchema({
                    name,
                    jsonSchema,
                    parentJsonSchema: collectionSchema,
                    ddlProvider,
                    dbData,
                }),
            );
            const createScript = ddlProvider.addColumn(fullName, columnDefinition);

            return [
                AlterScriptDto.getInstance([dropScript], true, true),
                AlterScriptDto.getInstance([createScript], true, false),
            ];
        });
}

module.exports = {
    getUpdateTypesScriptDtos
}
