const {AlterScriptDto} = require("../types/AlterScriptDto");
const {App} = require('../../types/coreApplicationTypes');
const {getRenameColumnScriptDtos} = require("./columnHelpers/renameColumnHelper");
const {getUpdateTypesScriptDtos} = require("./columnHelpers/alterTypeHelper");
const {HydateColumn} = require('../../ddlProvider/types/hydateColumn');
const {getModifyTableOptionsDto} = require("./entityHelpers/modifyTableOptionsHelper");
const {getModifyIndexesDtos} = require("./entityHelpers/modifyIndexesHelper");


/**
 * @param app {App}
 * @return {(collection: Object) => AlterScriptDto}
 * */
const getAddCollectionScriptDto = app => collection => {
    const _ = app.require('lodash');
    const { getDatabaseName, } = require('../../utils/general')({_});
    const {createColumnDefinitionBySchema} = require('./createColumnDefinition')(_);
    const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);

    const databaseName = getDatabaseName(collection);
    const dbData = {databaseName};
    const jsonSchema = {...collection, ...(collection?.role || {})};
    /**
     * @type {HydateColumn[]}
     * */
    const columnDefinitions = _.toPairs(jsonSchema.properties).map(([name, column]) =>
        createColumnDefinitionBySchema({
            name,
            jsonSchema: column,
            parentJsonSchema: jsonSchema,
            ddlProvider,
            dbData,
        }),
    );
    const checkConstraints = (jsonSchema.chkConstr || []).map(check =>
        ddlProvider.createCheckConstraint(ddlProvider.hydrateCheckConstraint(check)),
    );
    const tableData = {
        name: jsonSchema?.code || jsonSchema?.collectionName || jsonSchema?.name,
        columns: columnDefinitions.map(ddlProvider.convertColumnDefinition),
        checkConstraints: checkConstraints,
        foreignKeyConstraints: [],
        dbData,
        columnDefinitions,
    };
    const hydratedTable = ddlProvider.hydrateTable({tableData, entityData: [jsonSchema], jsonSchema});

    const script = ddlProvider.createTable(hydratedTable, jsonSchema.isActivated);
    return AlterScriptDto.getInstance([script], true, false);
};

/**
 * @param app {App}
 * @return {(collection: Object) => AlterScriptDto}
 * */
const getDeleteCollectionScriptDto = app => collection => {
    const _ = app.require('lodash');
    const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
    const {getTableName} = require('../../utils/general')({_});

    const jsonData = {...collection, ...(_.omit(collection?.role, 'properties') || {})};
    const tableName = jsonData?.code || jsonData?.collectionName || jsonSchema?.name;
    const databaseName = collection.compMod.keyspaceName;
    const fullName = getTableName(tableName, databaseName);

    const script = ddlProvider.dropTable(fullName);
    return AlterScriptDto.getInstance([script], true, true);
};

/**
 * @param app {App}
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getModifyCollectionScriptDtos = app => collection => {
    const _ = app.require('lodash');
    const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);

    const modifyIndexesScriptDtos = getModifyIndexesDtos(app)(collection);
    const modifyTableOptionsScriptDto = getModifyTableOptionsDto(_, ddlProvider)(collection);

    return [
        modifyTableOptionsScriptDto,
        ...modifyIndexesScriptDtos,
    ].filter(Boolean);
};

/**
 * @param app {App}
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getAddColumnScriptDtos = app => collection => {
    const _ = app.require('lodash');
    const {createColumnDefinitionBySchema} = require('./createColumnDefinition')(_);
    const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
    const {getTableName} = require('../../utils/general')({_});

    const collectionSchema = {...collection, ...(_.omit(collection?.role, 'properties') || {})};
    const tableName = collectionSchema?.code || collectionSchema?.collectionName || collectionSchema?.name;
    const databaseName = collectionSchema.compMod?.keyspaceName;
    const fullName = getTableName(tableName, databaseName);
    const dbData = {databaseName};

    return _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => !jsonSchema.compMod)
        .map(([name, jsonSchema]) =>
            createColumnDefinitionBySchema({
                name,
                jsonSchema,
                parentJsonSchema: collectionSchema,
                ddlProvider,
                dbData,
            }),
        )
        .map(ddlProvider.convertColumnDefinition)
        .map(columnDefinition => ddlProvider.addColumn(fullName, columnDefinition))
        .map(script => AlterScriptDto.getInstance([script], true, false))
        .filter(Boolean);
};

/**
 * @param app {App}
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getDeleteColumnScriptDtos = app => collection => {
    const _ = app.require('lodash');
    const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
    const {getTableName, wrapInTics} = require('../../utils/general')({_});

    const collectionSchema = {...collection, ...(_.omit(collection?.role, 'properties') || {})};
    const tableName = collectionSchema?.code || collectionSchema?.collectionName || collectionSchema?.name;
    const databaseName = collectionSchema.compMod?.keyspaceName;
    const fullName = getTableName(tableName, databaseName);

    return _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => !jsonSchema.compMod)
        .map(([name]) => {
            const ddlName = wrapInTics(name);
            return ddlProvider.dropColumn(fullName, ddlName);
        })
        .map(script => AlterScriptDto.getInstance([script], true, true))
        .filter(Boolean);
};

/**
 * @param app {App}
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getModifyColumnScriptDtos = app => collection => {
    const _ = app.require('lodash');
    const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);

    const renameColumnScriptDtos = getRenameColumnScriptDtos(_, ddlProvider)(collection);
    const changeTypeScriptDtos = getUpdateTypesScriptDtos(_, ddlProvider)(collection);

    return [...renameColumnScriptDtos, ...changeTypeScriptDtos];
};

module.exports = {
    getAddCollectionScriptDto,
    getDeleteCollectionScriptDto,
    getModifyCollectionScriptDtos,
    getAddColumnScriptDtos,
    getDeleteColumnScriptDtos,
    getModifyColumnScriptDtos,
};
