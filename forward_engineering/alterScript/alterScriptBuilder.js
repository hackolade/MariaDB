const { getAlterScriptDtos } = require('./alterScriptFromDeltaHelper');
const { CoreData, Option } = require('../types/coreApplicationTypes');
const { AlterScriptDto } = require('./types/AlterScriptDto');

/**
 * @param options {{additionalOptions: Option[]} | undefined}
 * @return {boolean}
 * */
const getShouldApplyDropStatements = options => {
	return options?.additionalOptions?.some(option => option.id === 'applyDropStatements' && option.value);
};

/**
 * @return {(dtos: AlterScriptDto[], shouldApplyDropStatements: boolean) => string}
 * */
const joinAlterScriptDtosIntoScript = _ => (dtos, shouldApplyDropStatements) => {
	const { commentIfDeactivated } = require('../utils/general')(_);
	return dtos
		.map(dto => {
			if (dto.isActivated === false) {
				return dto.scripts.map(scriptDto =>
					commentIfDeactivated(scriptDto.script, {
						isActivated: false,
						isPartOfLine: false,
					}),
				);
			}
			if (!shouldApplyDropStatements) {
				return dto.scripts.map(scriptDto =>
					commentIfDeactivated(scriptDto.script, {
						isActivated: !scriptDto.isDropScript,
						isPartOfLine: false,
					}),
				);
			}
			return dto.scripts.map(scriptDto => scriptDto.script);
		})
		.flat()
		.filter(Boolean)
		.map(scriptLine => scriptLine.trim())
		.filter(Boolean)
		.join('\n\n');
};

/**
 * @param data {CoreData}
 * @param app {App}
 * @return {string}
 * */
const buildEntityLevelAlterScript = (data, app) => {
	const _ = app.require('lodash');
	const alterScriptDtos = getAlterScriptDtos(data, app);
	const shouldApplyDropStatements = getShouldApplyDropStatements(data.options);
	return joinAlterScriptDtosIntoScript(_)(alterScriptDtos, shouldApplyDropStatements);
};

/**
 * @param data {CoreData}
 * @param app {App}
 * @return { boolean}
 * */
const doesEntityLevelAlterScriptContainDropStatements = (data, app) => {
	const alterScriptDtos = getAlterScriptDtos(data, app);
	return alterScriptDtos.some(
		alterScriptDto =>
			alterScriptDto.isActivated &&
			alterScriptDto.scripts.some(scriptModificationDto => scriptModificationDto.isDropScript),
	);
};

const mapCoreDataForContainerLevelScripts = data => {
	return {
		...data,
		jsonSchema: data.collections[0],
	};
};

/**
 * @param data {CoreData}
 * @param app {App}
 * @return {string}
 * */
const buildContainerLevelAlterScript = (data, app) => {
	const preparedData = mapCoreDataForContainerLevelScripts(data);
	const _ = app.require('lodash');
	const alterScriptDtos = getAlterScriptDtos(preparedData, app);
	const shouldApplyDropStatements = getShouldApplyDropStatements(preparedData.options);

	return joinAlterScriptDtosIntoScript(_)(alterScriptDtos, shouldApplyDropStatements);
};

/**
 * @param data {CoreData}
 * @param app {App}
 * @return { boolean}
 * */
const doesContainerLevelAlterScriptContainDropStatements = (data, app) => {
	const preparedData = mapCoreDataForContainerLevelScripts(data);
	const alterScriptDtos = getAlterScriptDtos(preparedData, app);
	return alterScriptDtos.some(
		alterScriptDto =>
			alterScriptDto.isActivated &&
			alterScriptDto.scripts.some(scriptModificationDto => scriptModificationDto.isDropScript),
	);
};

module.exports = {
	buildEntityLevelAlterScript,
	doesEntityLevelAlterScriptContainDropStatements,
	buildContainerLevelAlterScript,
	doesContainerLevelAlterScriptContainDropStatements,
};
