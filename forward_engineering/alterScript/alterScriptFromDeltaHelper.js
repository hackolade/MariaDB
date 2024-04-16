const {
    getAddCollectionScriptDto,
    getDeleteCollectionScriptDto,
    getAddColumnScriptDtos,
    getDeleteColumnScriptDtos,
    getModifyColumnScriptDtos,
    getModifyCollectionScriptDtos,
} = require('./alterScriptHelpers/alterEntityHelper');
const {
    getAddViewScriptDto,
    getDeleteViewScriptDto,
    getModifiedViewScriptDto,
} = require('./alterScriptHelpers/alterViewHelper');
const {getScriptOptions} = require("./getScriptOptions");

const {AlterScriptDto, ModificationScript} = require("./types/AlterScriptDto");
const {App, CoreData} = require("../types/coreApplicationTypes");
const {
    getDeleteForeignKeyScriptDtos,
    getAddForeignKeyScriptDtos,
    getModifyForeignKeyScriptDtos
} = require("./alterScriptHelpers/alterRelationshipsHelper");

const getAlterContainersScriptDtos = (collection, app, {skipModified} = {}) => {
    const {
        getAddContainerScriptDto,
        getDeleteContainerScriptDto,
        getModifyContainerScriptDtos
    } = require('./alterScriptHelpers/alterContainerHelper')(app);

    const addedContainers = collection.properties?.containers?.properties?.added?.items;
    const deletedContainers = collection.properties?.containers?.properties?.deleted?.items;
    const modifiedContainers = collection.properties?.containers?.properties?.modified?.items;

    const addContainersScriptDtos = []
        .concat(addedContainers)
        .filter(Boolean)
        .map(container => ({...Object.values(container.properties)[0], name: Object.keys(container.properties)[0]}))
        .map(getAddContainerScriptDto);
    const deleteContainersScriptDtos = []
        .concat(deletedContainers)
        .filter(Boolean)
        .map(container => getDeleteContainerScriptDto(Object.keys(container.properties)[0]));

    if (skipModified) {
        return [
            ...addContainersScriptDtos,
            ...deleteContainersScriptDtos,
        ]
            .filter(Boolean);
    }

    const modifyContainersScriptDtos = []
        .concat(modifiedContainers)
        .filter(Boolean)
        .map(container => ({...Object.values(container.properties)[0], name: Object.keys(container.properties)[0]}))
        .flatMap(getModifyContainerScriptDtos);

    return [
        ...addContainersScriptDtos,
        ...deleteContainersScriptDtos,
        ...modifyContainersScriptDtos
    ]
        .filter(Boolean);
};

const getAlterCollectionsScripts = (collection, app) => {
    const createScriptsData = []
    .concat(collection.properties?.entities?.properties?.added?.items)
    .filter(Boolean)
    .map(item => Object.values(item.properties)[0])

    const deleteScriptsData = []
    .concat(collection.properties?.entities?.properties?.deleted?.items)
    .filter(Boolean)
    .map(item => Object.values(item.properties)[0])

    const modifyScriptsData = []
    .concat(collection.properties?.entities?.properties?.modified?.items)
    .filter(Boolean)
    .map(item => Object.values(item.properties)[0])

    const createCollectionsScripts = createScriptsData.filter(collection => collection.compMod?.created).map(getAddCollectionScriptDto(app));
    const deleteCollectionScripts = deleteScriptsData.filter(collection => collection.compMod?.deleted).map(getDeleteCollectionScriptDto(app));
    const modifyCollectionScripts = modifyScriptsData.flatMap(getModifyCollectionScriptDtos(app));
    const addColumnScripts = createScriptsData.filter(collection => !collection.compMod?.created).flatMap(getAddColumnScriptDtos(app));
    const deleteColumnScripts = deleteScriptsData.filter(collection => !collection.compMod?.deleted).flatMap(getDeleteColumnScriptDtos(app));
    const modifyColumnScript = modifyScriptsData.flatMap(getModifyColumnScriptDtos(app));

    return [
        ...createCollectionsScripts,
        ...deleteCollectionScripts,
        ...modifyCollectionScripts,
        ...addColumnScripts,
        ...deleteColumnScripts,
        ...modifyColumnScript,
    ].filter(Boolean);
};

const getAlterViewScriptDtos = (collection, app) => {
    const createViewsScriptDtos = []
        .concat(collection.properties?.views?.properties?.added?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .map(view => ({...view, ...(view.role || {})}))
        .filter(view => view.compMod?.created)
        .map(getAddViewScriptDto(app));

    const deleteViewsScriptDtos = []
        .concat(collection.properties?.views?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .map(view => ({...view, ...(view.role || {})}))
        .filter(view => view.compMod?.deleted)
        .map(getDeleteViewScriptDto(app));

    const modifiedViewsScriptDtos = []
        .concat(collection.properties?.views?.properties?.modified?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .map(view => ({...view, ...(view.role || {})}))
        .filter(view => !view.compMod?.created && !view.compMod?.deleted)
        .map(getModifiedViewScriptDto(app));

    return [
        ...deleteViewsScriptDtos,
        ...createViewsScriptDtos,
        ...modifiedViewsScriptDtos
    ]
        .filter(Boolean);
};

/**
 * @return Array<AlterScriptDto>
 * */
const getAlterRelationshipsScriptDtos = (
    collection,
    app,
) => {
    const _ = app.require('lodash');
    const ddlProvider = require('../ddlProvider/ddlProvider')(null, null, app);

    const addedRelationships = []
        .concat(collection.properties?.relationships?.properties?.added?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(relationship => relationship?.role?.compMod?.created);
    const deletedRelationships = []
        .concat(collection.properties?.relationships?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(relationship => relationship?.role?.compMod?.deleted);
    const modifiedRelationships = []
        .concat(collection.properties?.relationships?.properties?.modified?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(relationship => relationship?.role?.compMod?.modified);

    const deleteFkScriptDtos = getDeleteForeignKeyScriptDtos(ddlProvider, _)(deletedRelationships);
    const addFkScriptDtos = getAddForeignKeyScriptDtos(ddlProvider, _)(addedRelationships);
    const modifiedFkScriptDtos = getModifyForeignKeyScriptDtos(ddlProvider, _)(modifiedRelationships);

    return [
        ...deleteFkScriptDtos,
        ...addFkScriptDtos,
        ...modifiedFkScriptDtos,
    ].filter(Boolean);
}

/**
 * @param dto {AlterScriptDto}
 * @return {AlterScriptDto | undefined}
 */
const prettifyAlterScriptDto = (dto) => {
    if (!dto) {
        return undefined;
    }
    /**
     * @type {Array<ModificationScript>}
     * */
    const nonEmptyScriptModificationDtos = dto.scripts
        .map((scriptDto) => ({
            ...scriptDto,
            script: (scriptDto.script || '').trim()
        }))
        .filter((scriptDto) => Boolean(scriptDto.script));
    if (!nonEmptyScriptModificationDtos.length) {
        return undefined;
    }
    return {
        ...dto,
        scripts: nonEmptyScriptModificationDtos
    }
}

/**
 * @param data {CoreData}
 * @param app {App}
 * @return {Array<AlterScriptDto>}
 * */
const getAlterScriptDtos = (data, app) => {
    const collection = JSON.parse(data.jsonSchema);
    if (!collection) {
        throw new Error(
            '"comparisonModelCollection" is not found. Alter script can be generated only from Delta model',
        );
    }

    const scriptOptions = getScriptOptions(data);
    const containersScriptDtos = getAlterContainersScriptDtos(collection, app, scriptOptions.containers);
    const collectionsScripts = getAlterCollectionsScripts(collection, app);
    const viewScriptDtos = getAlterViewScriptDtos(collection, app);
    const relationshipScriptDtos = getAlterRelationshipsScriptDtos(collection, app);

    return [
        ...containersScriptDtos,
        ...collectionsScripts,
        ...viewScriptDtos,
        ...relationshipScriptDtos,
    ]
        .filter(Boolean)
        .map((dto) => prettifyAlterScriptDto(dto))
        .filter(Boolean);
};

module.exports = {
    getAlterScriptDtos
};
