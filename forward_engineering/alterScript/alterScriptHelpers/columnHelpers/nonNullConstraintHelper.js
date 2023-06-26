const {AlterScriptDto} = require("../../types/AlterScriptDto");
const {HydratedColumn} = require('../../../ddlProvider/types/hydratedColumn');

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getModifyNonNullColumnsScriptDtos = (_, ddlProvider) => (collection) => {
    const {getCollectionName, getTableName, getDatabaseName, wrapInTics, getCollectionSchema} = require('../../../utils/general')(_);
    const {createColumnDefinitionBySchema} = require('../createColumnDefinition')(_);

    const collectionSchema = getCollectionSchema(collection);
    const collectionName = getCollectionName(collectionSchema);
    const databaseName = getDatabaseName(collectionSchema);
    const fullTableName = getTableName(collectionName, databaseName);

    const currentRequiredColumnNames = collection.required || [];
    const previousRequiredColumnNames = collection.role.required || [];

    const columnNamesToAddNotNullConstraint = _.difference(currentRequiredColumnNames, previousRequiredColumnNames);
    const columnNamesToRemoveNotNullConstraint = _.difference(previousRequiredColumnNames, currentRequiredColumnNames);

    const addNotNullConstraintsScript = _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            const oldName = jsonSchema.compMod.oldField.name;
            const shouldRemoveForOldName = columnNamesToRemoveNotNullConstraint.includes(oldName);
            const shouldAddForNewName = columnNamesToAddNotNullConstraint.includes(name);
            return shouldAddForNewName && !shouldRemoveForOldName;
        })
        .map(([columnName, jsonSchema]) => {
            const ddlColumnName = wrapInTics(columnName);
            /**
             * @type {HydratedColumn}
             * */
            const columnDefinition = createColumnDefinitionBySchema({
                name: columnName,
                ddlProvider,
                jsonSchema,
                parentJsonSchema: collection,
                schemaData: undefined,
            });
            return ddlProvider.setNotNullConstraint(fullTableName, ddlColumnName, columnDefinition);
        })
        .map(script => AlterScriptDto.getInstance([script], true, false));

    const removeNotNullConstraint = _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            const oldName = jsonSchema.compMod.oldField.name;
            const shouldRemoveForOldName = columnNamesToRemoveNotNullConstraint.includes(oldName);
            const shouldAddForNewName = columnNamesToAddNotNullConstraint.includes(name);
            return shouldRemoveForOldName && !shouldAddForNewName;
        })
        .map(([columnName, jsonSchema]) => {
            const ddlColumnName = wrapInTics(columnName);
            /**
             * @type {HydratedColumn}
             * */
            const columnDefinition = createColumnDefinitionBySchema({
                name: columnName,
                ddlProvider,
                jsonSchema,
                parentJsonSchema: collection,
                schemaData: undefined,
            });
            return ddlProvider.dropNotNullConstraint(fullTableName, ddlColumnName, columnDefinition);
        })
        .map(script => AlterScriptDto.getInstance([script], true, true));

    return [
        ...addNotNullConstraintsScript,
        ...removeNotNullConstraint
    ].filter(Boolean);
}

module.exports = {
    getModifyNonNullColumnsScriptDtos
}
