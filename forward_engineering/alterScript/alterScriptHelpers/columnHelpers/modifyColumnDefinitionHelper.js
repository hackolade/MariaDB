const {AlterScriptDto} = require("../../types/AlterScriptDto");
const {ColumnDefinition} = require('../../../ddlProvider/types/columnDefinition');
const {HydratedColumn} = require('../../../ddlProvider/types/hydratedColumn');
const {hasTypeChanged} = require("./alterTypeHelper");
const {hasNotNullAttributeChanged} = require("./nonNullConstraintHelper");
const {hasCommentChanged} = require("./commentsHelper");

/**
 * @return {(
 *  columnName: string,
 *  columnJsonSchema: ColumnDefinition,
 *  collection: Object
 *  ) => boolean}
 * */
const shouldDropAndRecreateColumn = (_) => (columnName, columnJsonSchema, collection) => {
    return hasTypeChanged(_)(columnJsonSchema, collection);
}

/**
 * @return {(
 *  columnName: string,
 *  columnJsonSchema: ColumnDefinition,
 *  collection: Object
 *  ) => boolean}
 * */
const shouldModifyColumn = (_) => (columnName, columnJsonSchema, collection) => {
    const wasCommentModified = hasCommentChanged(_)(columnJsonSchema, collection);
    const wasNotNullModified = hasNotNullAttributeChanged(_)(columnName, columnJsonSchema, collection);

    return [
        wasCommentModified,
        wasNotNullModified,
    ]
        .some(wasModified => wasModified === true);
}

/**
 * Omits PK and Unique constraints definitions from column JSON schema.
 * We handle changes of such constraints on entity level
 * @return {(hydratedColumn: HydratedColumn) => HydratedColumn}
 * */
const removeKeysFromHydratedColumn = (_) => (hydratedColumn) => {
    return _.omit(
        hydratedColumn,
        [
            'primaryKey', 'primaryKeyOptions',
            'unique', 'uniqueKeyOptions'
        ]
    );
}

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getModifyColumnDefinitionScriptDtos = (_, ddlProvider) => (collection) => {
    const {
        getTableName,
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

    const getColumnDefinition = (columnName, columnJsonSchema) => {
        return createColumnDefinitionBySchema({
            name: columnName,
            jsonSchema: columnJsonSchema,
            parentJsonSchema: collection,
            ddlProvider,
            dbData,
        });
    }

    /**
     * @type {AlterScriptDto[]}
     * */
    const modifyScriptDtos = [];

    /**
     * @type {Array<Array<any>>}
     * */
    const namesAndColumnJsonSchemas = _.toPairs(collection.properties);

    for (const nameAndSchemaPair of namesAndColumnJsonSchemas) {
        if (nameAndSchemaPair.length !== 2) {
            continue;
        }
        /**
         * @type {string}
         * */
        const newColumnName = nameAndSchemaPair[0];
        /**
         * @type {ColumnDefinition}
         * */
        const newColumnJsonSchema = nameAndSchemaPair[1];
        const isActivated = newColumnJsonSchema.isActivated;

        const shouldDropAndRecreate = shouldDropAndRecreateColumn(_)(newColumnName, newColumnJsonSchema, collection);
        if (shouldDropAndRecreate) {
            const dropColumnDdlName = wrapInTics(newColumnName);
            const dropScript = ddlProvider.dropColumn(fullName, dropColumnDdlName);

            const hydratedColumn = getColumnDefinition(newColumnName, newColumnJsonSchema);
            const hydratedColumnWithNoKeyDefinitions = removeKeysFromHydratedColumn(_)(hydratedColumn);
            const columnDefinitionDdl = ddlProvider.mapColumnToColumnDefinitionDdl(hydratedColumnWithNoKeyDefinitions);
            const createScript = ddlProvider.addColumn(fullName, columnDefinitionDdl);

            modifyScriptDtos.push(AlterScriptDto.getInstance([dropScript], isActivated, true));
            modifyScriptDtos.push(AlterScriptDto.getInstance([createScript], isActivated, false));
            continue;
        }

        const shouldModify = shouldModifyColumn(_)(newColumnName, newColumnJsonSchema, collection);
        if (shouldModify) {
            const hydratedColumn = getColumnDefinition(newColumnName, newColumnJsonSchema);
            const hydratedColumnWithNoKeyDefinitions = removeKeysFromHydratedColumn(_)(hydratedColumn);
            const modifyScript = ddlProvider.modifyColumn(fullName, hydratedColumnWithNoKeyDefinitions);

            modifyScriptDtos.push(AlterScriptDto.getInstance([modifyScript], isActivated, false));
        }
    }

    return modifyScriptDtos.filter(Boolean);
}

module.exports = {
    getModifyColumnDefinitionScriptDtos
}
