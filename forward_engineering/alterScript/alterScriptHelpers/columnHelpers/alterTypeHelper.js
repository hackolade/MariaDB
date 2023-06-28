const {AlterScriptDto} = require("../../types/AlterScriptDto");

/**
 * @return {boolean}
 * */
const hasLengthChanged = (collection, oldFieldName, currentJsonSchema) => {
    const oldProperty = collection.role.properties[oldFieldName];

    const previousLength = oldProperty?.length;
    const newLength = currentJsonSchema?.length;
    return previousLength !== newLength;
}

/**
 * @return {boolean}
 * */
const hasPrecisionOrScaleChanged = (collection, oldFieldName, currentJsonSchema) => {
    const oldProperty = collection.role.properties[oldFieldName];

    const previousPrecision = oldProperty?.precision;
    const newPrecision = currentJsonSchema?.precision;
    const previousScale = oldProperty?.scale;
    const newScale = currentJsonSchema?.scale;

    return previousPrecision !== newPrecision || previousScale !== newScale;
}

/**
 * @return {boolean}
 * */
const hasMicroSecPrecisionChanged = (collection, oldFieldName, currentJsonSchema) => {
    const oldProperty = collection.role.properties[oldFieldName];

    const previousMicroSecPrecision = oldProperty?.microSecPrecision;
    const newMicroSecPrecision = currentJsonSchema?.microSecPrecision;
    return previousMicroSecPrecision !== newMicroSecPrecision;
}

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
        .filter(([name, jsonSchema]) => {
            const hasTypeChanged = checkFieldPropertiesChanged(jsonSchema.compMod, ['type', 'mode'])
            if (!hasTypeChanged) {
                const oldName = jsonSchema.compMod.oldField.name;
                const isNewLength = hasLengthChanged(collection, oldName, jsonSchema);
                const isNewPrecisionOrScale = hasPrecisionOrScaleChanged(collection, oldName, jsonSchema);
                const isNewMicroSecPrecision = hasMicroSecPrecisionChanged(collection, oldName, jsonSchema);
                return isNewLength || isNewPrecisionOrScale || isNewMicroSecPrecision;
            }
            return hasTypeChanged;
        })
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
        })
        .flat();
}

module.exports = {
    getUpdateTypesScriptDtos
}
