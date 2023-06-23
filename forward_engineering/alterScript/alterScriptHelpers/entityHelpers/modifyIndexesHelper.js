const {AlterScriptDto} = require("../../types/AlterScriptDto");
const {App} = require("../../../types/coreApplicationTypes");

const indexesCompModKey = 'Indxs';

const setIndexKeys = (idToNameHashTable, idToActivatedHashTable, index) => {
    return {
        ...index,
        indxKey:
            index.indxKey?.map(key => ({
                ...key,
                name: idToNameHashTable[key.keyId],
                isActivated: idToActivatedHashTable[key.keyId],
            })) || [],
    };
};

const hydrateIndex = (idToNameHashTable, idToActivatedHashTable, ddlProvider) => index => {
    index = setIndexKeys(idToNameHashTable, idToActivatedHashTable, index);

    return ddlProvider.hydrateIndex(index);
};

/**
 * @param app {App}
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getModifyIndexesDtos = (app) => (collection) => {
    const _ = app.require('lodash');
    const {
        getDatabaseName,
        getCompMod,
        getCollectionName,
        getModifiedGroupItemsByName
    } = require('../../../utils/general')({_});
    const ddlProvider = require('../../../ddlProvider/ddlProvider')(null, null, app);
    const {generateIdToNameHashTable, generateIdToActivatedHashTable} = app.require('@hackolade/ddl-fe-utils');

    const tableData = {...collection, ...(collection?.role || {})};
    const databaseName = getDatabaseName(collection);
    const dbData = {databaseName};
    const idToNameHashTable = generateIdToNameHashTable(tableData);
    const idToActivatedHashTable = generateIdToActivatedHashTable(tableData);

    const collectionName = getCollectionName(tableData);

    const compMod = getCompMod(tableData);
    const indexesCompMod = compMod[indexesCompModKey] || {};
    const {new: newItems = [], old: oldItems = []} = indexesCompMod;

    const oldHydrated = oldItems.map(idx => hydrateIndex(idToNameHashTable, idToActivatedHashTable, ddlProvider)(idx));
    const newHydrated = newItems.map(idx => hydrateIndex(idToNameHashTable, idToActivatedHashTable, ddlProvider)(idx));

    const { removed, added, modified } = getModifiedGroupItemsByName(newHydrated, oldHydrated);

    const removedScriptDtos = removed
        .map(item => {
            const script = ddlProvider.dropIndex(collectionName, dbData, item);
            return AlterScriptDto.getInstance([script], true, true);
        })
    const addedScriptDtos = added
        .map(item => {
            const script = ddlProvider.createIndex(collectionName, item, dbData);
            return AlterScriptDto.getInstance([script], true, false);
        })
    const modifiedScriptDtos = modified
        .map(item => {
            const dropScript = ddlProvider.dropIndex(collectionName, dbData, item);
            const addScript = ddlProvider.createIndex(collectionName, item, dbData);

            return [
                AlterScriptDto.getInstance([dropScript], true, true),
                AlterScriptDto.getInstance([addScript], true, false),
            ];
        })
        .flat();

    return [
        ...modifiedScriptDtos,
        ...removedScriptDtos,
        ...addedScriptDtos,
    ]
        .filter(Boolean);

}

module.exports = {
    getModifyIndexesDtos
}
