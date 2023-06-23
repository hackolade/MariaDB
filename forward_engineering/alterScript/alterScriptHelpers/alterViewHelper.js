const {AlterScriptDto} = require("../types/AlterScriptDto");

/**
 * @return {(view: Object) => AlterScriptDto}
 * */
const getAddViewScriptDto = app => view => {
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
	const _ = app.require('lodash');
	const {
		getViewSchema,
		getViewName,
	} = require('../../utils/general')({ _ });
	const viewSchema = getViewSchema(view);

	const databaseName = viewSchema.compMod.keyspaceName;
	const viewData = {
		name: getViewName(viewSchema),
		keys: getKeys(
			viewSchema,
			viewSchema.compMod?.collectionData?.collectionRefsDefinitionsMap ?? {},
			ddlProvider,
			app,
		),
		dbData: { databaseName },
	};
	const hydratedView = ddlProvider.hydrateView({ viewData, entityData: [view] });

	const scriptDto = ddlProvider.createViewForAlterScript(hydratedView, databaseName);
	const { deactivatedWholeStatement, statement } = scriptDto;
	const isViewActivated = view.isActivated && !deactivatedWholeStatement;
	return AlterScriptDto.getInstance([statement], isViewActivated, false);
};

/**
 * @return {(view: Object) => AlterScriptDto}
 * */
const getDeleteViewScriptDto = app => view => {
	const _ = app.require('lodash');
	const { getTableName, getViewName } = require('../../utils/general')({ _ });
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);

	const databaseName = view?.role?.compMod?.keyspaceName;
	const viewName = getViewName(view);
	const ddlViewName = getTableName(viewName, databaseName);

	const script = ddlProvider.dropView(ddlViewName);
	return AlterScriptDto.getInstance([script], true, true);
};

/**
 * @return {(view: Object) => AlterScriptDto}
 * */
const getModifiedViewScriptDto = app => view => {
	const _ = app.require('lodash');
	const {
		getTableName,
		checkCompModEqual,
		getViewSchema,
		getViewName,
	} = require('../../utils/general')({ _ });
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
	const viewSchema = getViewSchema(view);
	const viewData = {
		name: getViewName(viewSchema),
		keys: getKeys(
			viewSchema,
			viewSchema.compMod?.collectionData?.collectionRefsDefinitionsMap ?? {},
			ddlProvider,
			app,
		),
		dbData: { databaseName: viewSchema.compMod.keyspaceName },
	};

	const isAlgorithmChanged = !checkCompModEqual(viewSchema.compMod?.algorithm, _);
	const isSqlSecurityChanged = !checkCompModEqual(viewSchema.compMod?.sqlSecurity, _);

	const { deactivatedWholeStatement, selectStatement } = ddlProvider.viewSelectStatement(viewData);

	const algorithm = viewSchema.algorithm
			? `ALGORITHM ${viewSchema.algorithm}`
			: 'ALGORITHM UNDEFINED';
	const sqlSecurity = viewData.sqlSecurity ? `SQL SECURITY ${viewData.sqlSecurity}` : '';

	const ddlViewName = getTableName(viewData.name, viewData.dbData.databaseName);
	const ddlSqlSecurity = isSqlSecurityChanged ? sqlSecurity : undefined;
	const ddlAlgorithm = isAlgorithmChanged ? algorithm : undefined;

	const script = ddlProvider.alterView({
		sqlSecurity: ddlSqlSecurity,
		algorithm: ddlAlgorithm,
		viewName: ddlViewName,
		selectStatement
	});
	const isViewActivated = viewSchema.isActivated && !deactivatedWholeStatement;
	return AlterScriptDto.getInstance([script], isViewActivated, false);
};

const getKeys = (viewSchema, collectionRefsDefinitionsMap, ddlProvider, app) => {
	const _ = app.require('lodash');
	const { mapProperties } = app.require('@hackolade/ddl-fe-utils');

	return mapProperties(viewSchema, (propertyName, schema) => {
		const definition = collectionRefsDefinitionsMap[schema.refId];

		if (!definition) {
			return ddlProvider.hydrateViewColumn({
				name: propertyName,
				isActivated: schema.isActivated,
			});
		}

		const entityName =
			_.get(definition.collection, '[0].code', '') ||
			_.get(definition.collection, '[0].collectionName', '') ||
			'';
		const dbName = _.get(definition.bucket, '[0].code') || _.get(definition.bucket, '[0].name', '');
		const name = definition.name;

		if (name === propertyName) {
			return ddlProvider.hydrateViewColumn({
				containerData: definition.bucket,
				entityData: definition.collection,
				isActivated: schema.isActivated,
				definition: definition.definition,
				entityName,
				name,
				dbName,
			});
		}

		return ddlProvider.hydrateViewColumn({
			containerData: definition.bucket,
			entityData: definition.collection,
			isActivated: schema.isActivated,
			definition: definition.definition,
			alias: propertyName,
			entityName,
			name,
			dbName,
		});
	});
};

module.exports = {
	getAddViewScriptDto,
	getDeleteViewScriptDto,
	getModifiedViewScriptDto,
};
