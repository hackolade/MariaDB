const {AlterScriptDto} = require("../../types/AlterScriptDto");

/**
 * @return {(data: Object) => AlterScriptDto}
 * */
const getModifyCollationScriptDto = (_, ddlProvider) => (containerData) => {
    const {
        getCompMod,
    } = require('../../../utils/general')({_});
    const compMod = getCompMod(containerData);
    const isCharacterSetModified = compMod.characterSet?.new !== compMod.characterSet?.old;
    const isCollationModified = compMod.collation?.new !== compMod.collation?.old;

    if (isCharacterSetModified || isCollationModified) {
        const ddlContainerName = `\`${containerData.name}\``;
        const ddlCharacterSet = `'${containerData.role?.characterSet}'`;
        const ddlCollate = `'${containerData.role?.collation}'`;
        const script = ddlProvider.alterCollation(ddlContainerName, ddlCharacterSet, ddlCollate);
        return AlterScriptDto.getInstance([script], true, false);
    }
    return undefined;
}

module.exports = {
    getModifyCollationScriptDto
}
