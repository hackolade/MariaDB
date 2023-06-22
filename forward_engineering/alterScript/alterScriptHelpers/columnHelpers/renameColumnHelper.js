const {AlterScriptDto} = require("../../types/AlterScriptDto");

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getRenameColumnScriptDtos = (_, ddlProvider) => (collection) => {
    const {
        getTableName,
        checkFieldPropertiesChanged,
        wrapInTics,
        getCollectionName,
        getCollectionSchema,
        getDatabaseName,
    } = require('../../../utils/general')({_});

    const collectionSchema = getCollectionSchema(collection);
    const tableName = getCollectionName(collectionSchema);
    const databaseName = getDatabaseName(collectionSchema);
    const fullName = getTableName(tableName, databaseName);

    return _.values(collection.properties)
        .filter(jsonSchema => checkFieldPropertiesChanged(jsonSchema.compMod, ['name']))
        .map((jsonSchema) => {
            const ddlOldName = wrapInTics(jsonSchema.compMod.oldField.name);
            const ddlNewName = wrapInTics(jsonSchema.compMod.newField.name);

            return ddlProvider.renameColumn(fullName, ddlOldName, ddlNewName);
        })
        .map(script => AlterScriptDto.getInstance([script], true, false));
}

module.exports = {
    getRenameColumnScriptDtos
}
