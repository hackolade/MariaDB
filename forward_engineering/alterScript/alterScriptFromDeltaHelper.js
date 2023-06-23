const {
    getAddCollectionScriptDto,
    getDeleteCollectionScriptDto,
    getAddColumnScriptDto,
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
        .map(getModifyContainerScriptDtos);

    return [
        ...addContainersScriptDtos,
        ...deleteContainersScriptDtos,
        ...modifyContainersScriptDtos
    ]
        .filter(Boolean);
};

const getAlterCollectionsScripts = (collection, app) => {
    const createCollectionsScripts = []
        .concat(collection.properties?.entities?.properties?.added?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(collection => collection.compMod?.created)
        .map(getAddCollectionScriptDto(app));
    const deleteCollectionScripts = []
        .concat(collection.properties?.entities?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(collection => collection.compMod?.deleted)
        .map(getDeleteCollectionScriptDto(app));
    const modifyCollectionScripts = []
        .concat(collection.properties?.entities?.properties?.modified?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(collection => collection.compMod?.modified)
        .map(getModifyCollectionScriptDtos(app));
    const addColumnScripts = []
        .concat(collection.properties?.entities?.properties?.added?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(collection => !collection.compMod?.created)
        .flatMap(getAddColumnScriptDto(app));
    const deleteColumnScripts = []
        .concat(collection.properties?.entities?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(collection => !collection.compMod?.deleted)
        .flatMap(getDeleteColumnScriptDtos(app));
    const modifyColumnScript = []
        .concat(collection.properties?.entities?.properties?.modified?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .flatMap(getModifyColumnScriptDtos(app));

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

    return [
        ...containersScriptDtos,
        ...collectionsScripts,
        ...viewScriptDtos
    ]
        .filter(Boolean)
        .map((dto) => prettifyAlterScriptDto(dto))
        .filter(Boolean);
};

module.exports = {
    getAlterScriptDtos
};
