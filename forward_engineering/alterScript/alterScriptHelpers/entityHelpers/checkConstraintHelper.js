const { AlterCollectionDto } = require('../../types/AlterCollectionDto');
const { CheckConstraint } = require('../../types/CheckConstraint');
const { AlterScriptDto } = require('../../types/AlterScriptDto');

/**
 *
 * @typedef {{
 *     old?: CheckConstraint,
 *     new?: CheckConstraint
 * }} CheckConstraintHistoryEntry
 * */

/**
 * @return {(collection: AlterCollectionDto) => Array<CheckConstraintHistoryEntry>}
 * */
const mapCheckConstraintNamesToChangeHistory = _ => collection => {
	const checkConstraintHistory = collection?.compMod?.chkConstr;
	if (!checkConstraintHistory) {
		return [];
	}
	const newConstraints = checkConstraintHistory.new || [];
	const oldConstraints = checkConstraintHistory.old || [];
	const constrNames = _.chain([...newConstraints, ...oldConstraints])
		.map(constr => constr.chkConstrName)
		.filter(Boolean)
		.uniq()
		.value();

	return constrNames.map(chkConstrName => {
		return {
			old: _.find(oldConstraints, { chkConstrName }),
			new: _.find(newConstraints, { chkConstrName }),
		};
	});
};

/**
 * @return {(constraintHistory: Array<CheckConstraintHistoryEntry>, fullTableName: string, isActivated: boolean) => Array<AlterScriptDto>}
 * */
const getDropCheckConstraintScriptDtos = (_, ddlProvider) => (constraintHistory, fullTableName, isActivated) => {
	const { wrapInTics } = require('../../../utils/general')(_);

	return constraintHistory
		.filter(historyEntry => historyEntry.old && !historyEntry.new)
		.map(historyEntry => {
			const wrappedConstraintName = wrapInTics(historyEntry.old.chkConstrName);
			return ddlProvider.dropConstraint(fullTableName, wrappedConstraintName);
		})
		.map(script => AlterScriptDto.getInstance([script], isActivated, true));
};

/**
 * @return {(constraintHistory: Array<CheckConstraintHistoryEntry>, fullTableName: string, isActivated: boolean) => Array<AlterScriptDto>}
 * */
const getAddCheckConstraintScriptDtos = (_, ddlProvider) => (constraintHistory, fullTableName, isActivated) => {
	const { wrapInTics } = require('../../../utils/general')(_);

	return constraintHistory
		.filter(historyEntry => historyEntry.new && !historyEntry.old)
		.map(historyEntry => {
			const { chkConstrName, constrExpression } = historyEntry.new;
			return ddlProvider.addCheckConstraint(fullTableName, wrapInTics(chkConstrName), constrExpression);
		})
		.map(script => AlterScriptDto.getInstance([script], isActivated, false));
};

/**
 * @return {(constraintHistory: Array<CheckConstraintHistoryEntry>, fullTableName: string, isActivated: boolean) => Array<AlterScriptDto>}
 * */
const getUpdateCheckConstraintScriptDtos = (_, ddlProvider) => (constraintHistory, fullTableName, isActivated) => {
	const { wrapInTics } = require('../../../utils/general')(_);

	return constraintHistory
		.filter(historyEntry => {
			if (historyEntry.old && historyEntry.new) {
				const oldExpression = historyEntry.old.constrExpression;
				const newExpression = historyEntry.new.constrExpression;
				return oldExpression !== newExpression;
			}
			return false;
		})
		.map(historyEntry => {
			const { chkConstrName: oldConstrainName } = historyEntry.old;
			const dropConstraintScript = ddlProvider.dropConstraint(fullTableName, wrapInTics(oldConstrainName));

			const { chkConstrName: newConstrainName, constrExpression: newConstraintExpression } = historyEntry.new;
			const addConstraintScript = ddlProvider.addCheckConstraint(
				fullTableName,
				wrapInTics(newConstrainName),
				newConstraintExpression,
			);

			return [
				AlterScriptDto.getInstance([dropConstraintScript], isActivated, true),
				AlterScriptDto.getInstance([addConstraintScript], isActivated, false),
			];
		})
		.flat();
};

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getModifyCheckConstraintScriptDtos = (_, ddlProvider) => collection => {
	const { getCollectionSchema, getCollectionName, getDatabaseName, getTableName } =
		require('../../../utils/general')(_);
	const collectionSchema = getCollectionSchema(collection);
	const collectionName = getCollectionName(collectionSchema);
	const databaseName = getDatabaseName(collection);
	const fullTableName = getTableName(collectionName, databaseName);
	const isActivated = collection.role?.isActivated !== false;

	const constraintHistory = mapCheckConstraintNamesToChangeHistory(_)(collection);

	const addCheckConstraintScripts = getAddCheckConstraintScriptDtos(_, ddlProvider)(
		constraintHistory,
		fullTableName,
		isActivated,
	);
	const dropCheckConstraintScripts = getDropCheckConstraintScriptDtos(_, ddlProvider)(
		constraintHistory,
		fullTableName,
		isActivated,
	);
	const updateCheckConstraintScripts = getUpdateCheckConstraintScriptDtos(_, ddlProvider)(
		constraintHistory,
		fullTableName,
		isActivated,
	);

	return [...addCheckConstraintScripts, ...dropCheckConstraintScripts, ...updateCheckConstraintScripts].filter(
		Boolean,
	);
};

module.exports = {
	getModifyCheckConstraintScriptDtos,
};
