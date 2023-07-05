const {AlterScriptDto} = require("../types/AlterScriptDto");
const proceduresCompModKey = 'Procedures';

/**
 * @return {(data: Object) => Array<AlterScriptDto>}
 * */
const getModifyProcedureScriptDtos = (_, ddlProvider) => (data) => {
    const {
        getCompMod,
        getContainerName,
        getModifiedGroupItemsByName,
        getProcedureName
    } = require('../../utils/general')({_});

    const compMod = getCompMod(data);
    const containerName = getContainerName(data);
    const proceduresCompMod = compMod[proceduresCompModKey] || {};
    const {new: newItems = [], old: oldItems = []} = proceduresCompMod;

    const oldHydrated = oldItems.map(procedure => ddlProvider.hydrateProcedure(procedure));
    const newHydrated = newItems.map(procedure => ddlProvider.hydrateProcedure(procedure));

    const {removed, added, modified} = getModifiedGroupItemsByName(newHydrated, oldHydrated);

    const removedScriptDtos = removed
        .map(item => {
            const procedureName = getProcedureName(item.name, containerName);
            return ddlProvider.dropProcedure(procedureName);
        })
        .map(script => AlterScriptDto.getInstance([script], true, true));
    const addedScriptDtos = added
        .map(item => ddlProvider.createProcedure(containerName, item))
        .map(script => AlterScriptDto.getInstance([script], true, false));

    const modifiedScriptDtos = modified
        .map(item => ddlProvider.createProcedure(containerName, {...item, orReplace: true}))
        .map(script => AlterScriptDto.getInstance([script], true, false));

    return [
        ...modifiedScriptDtos,
        ...removedScriptDtos,
        ...addedScriptDtos,
    ].filter(Boolean);
};

module.exports = {
    getModifyProcedureScriptDtos,
}
