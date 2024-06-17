const { AlterScriptDto } = require('../types/AlterScriptDto');
const udfsCompModKey = 'UDFs';

/**
 * @return {(data: Object) => Array<AlterScriptDto>}
 * */
const getModifyUdfsScriptDtos = (_, ddlProvider) => data => {
	const { getCompMod, getContainerName, getModifiedGroupItemsByName, getUdfName } = require('../../utils/general')({
		_,
	});

	const compMod = getCompMod(data);
	const containerName = getContainerName(data);
	const udfsCompMod = compMod[udfsCompModKey] || {};
	const { new: newItems = [], old: oldItems = [] } = udfsCompMod;

	const oldHydrated = oldItems.map(udf => ddlProvider.hydrateUdf(udf));
	const newHydrated = newItems.map(udf => ddlProvider.hydrateUdf(udf));

	const { removed, added, modified } = getModifiedGroupItemsByName(newHydrated, oldHydrated);

	const removedScriptDtos = removed
		.map(item => {
			const udfName = getUdfName(item.name, containerName);
			return ddlProvider.dropUdf(udfName);
		})
		.map(script => AlterScriptDto.getInstance([script], true, true));
	const addedScriptDtos = added
		.map(item => ddlProvider.createUdf(containerName, item))
		.map(script => AlterScriptDto.getInstance([script], true, false));

	const modifiedScriptDtos = modified
		.map(item => ddlProvider.createUdf(containerName, { ...item, orReplace: true }))
		.map(script => AlterScriptDto.getInstance([script], true, false));

	return [...modifiedScriptDtos, ...removedScriptDtos, ...addedScriptDtos].filter(Boolean);
};

module.exports = {
	getModifyUdfsScriptDtos,
};
