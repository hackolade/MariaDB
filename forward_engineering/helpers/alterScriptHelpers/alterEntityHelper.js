const getAddCollectionScript = app => collection => {
	const _ = app.require('lodash');
	const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(_);
	const ddlProvider = require('../../ddlProvider')(null, null, app);

	const databaseName = collection.compMod.keyspaceName;
	const dbData = { databaseName };
	const jsonSchema = { ...collection, ...(collection?.role || {}) };
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
	const hydratedTable = ddlProvider.hydrateTable({ tableData, entityData: [jsonSchema], jsonSchema });

	return ddlProvider.createTable(hydratedTable, jsonSchema.isActivated);
};

const getDeleteCollectionScript = app => collection => {
	const _ = app.require('lodash');
	const { getTableName } = require('../../utils/general')({ _ });

	const jsonData = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
	const tableName = jsonData?.code || jsonData?.collectionName || jsonSchema?.name;
	const databaseName = collection.compMod.keyspaceName;
	const fullName = getTableName(tableName, databaseName);

	return `DROP TABLE IF EXISTS ${fullName};`;
};

const getModifyCollectionScript = app => collection => {
	const _ = app.require('lodash');
	const { modifyGroupItems, getCompMod } = require('../../utils/general')({ _ });
	const ddlProvider = require('../../ddlProvider')(null, null, app);
	const { generateIdToNameHashTable, generateIdToActivatedHashTable } = app.require('@hackolade/ddl-fe-utils');

	const jsonData = { ...collection, ...(collection?.role || {}) };
	const databaseName = collection.compMod.keyspaceName;
	const dbData = { databaseName };
	const idToNameHashTable = generateIdToNameHashTable(jsonData);
	const idToActivatedHashTable = generateIdToActivatedHashTable(jsonData);

	const indexesScripts = modifyGroupItems({
		data: jsonData,
		key: 'Indxs',
		hydrate: hydrateIndex(idToNameHashTable, idToActivatedHashTable, ddlProvider),
		create: (tableName, index) =>
			index.orReplace
				? `${ddlProvider.dropIndex(tableName, index, dbData)}\n\n${ddlProvider.createIndex(
						tableName,
						index,
						dbData,
				  )}`
				: ddlProvider.createIndex(tableName, index, dbData), // TODO: fix indexed fields
		drop: (tableName, index) => ddlProvider.dropIndex(tableName, dbData, index),
	});

	const modifyTableOptionsScript = modifyTableOptions(jsonData, dbData, getCompMod);

	return [].concat(modifyTableOptionsScript).concat(indexesScripts).join('\n\n');
};

const modifyTableOptions = (tableData, dbData, getCompMod) => {
	const { getTableName } = require('../../utils/general')({});
	const compMod = getCompMod(tableData);
	const isDefaultModified = compMod.tableOptions?.new?.defaultCharSet !== compMod.tableOptions?.old?.defaultCharSet;
	const isCharacterSetModified = compMod.tableOptions?.new?.characterSet !== compMod.tableOptions?.old?.characterSet;
	const isCollationModified = compMod.tableOptions?.new?.collation !== compMod.tableOptions.collation?.old?.collation;

	if (isCharacterSetModified || isCollationModified || isDefaultModified) {
		const fullTableName = getTableName(tableData?.code || tableData.name, dbData.databaseName);
		const defaultStr = tableData.tableOptions?.defaultCharSet ? 'DEFAULT ' : '';
		const characterSet = tableData.tableOptions?.characterSet
			? `CHARACTER SET='${tableData.tableOptions?.characterSet}' `
			: '';
		const collate = tableData.tableOptions?.collation ? `COLLATE='${tableData.tableOptions?.collation}'` : '';

		return `ALTER TABLE ${fullTableName} ${defaultStr}${characterSet}${collate};`.trim();
	} else {
		return '';
	}
};

const getAddColumnScript = app => collection => {
	const _ = app.require('lodash');
	const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(_);
	const ddlProvider = require('../../ddlProvider')(null, null, app);
	const { getTableName } = require('../../utils/general')({ _ });

	const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
	const tableName = collectionSchema?.code || collectionSchema?.collectionName || collectionSchema?.name;
	const databaseName = collectionSchema.compMod?.keyspaceName;
	const fullName = getTableName(tableName, databaseName);
	const dbData = { databaseName };

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
		.map(script => `ALTER TABLE IF EXISTS ${fullName} ADD COLUMN IF NOT EXISTS ${script};`);
};

const getDeleteColumnScript = app => collection => {
	const _ = app.require('lodash');
	const { getTableName } = require('../../utils/general')({ _ });

	const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
	const tableName = collectionSchema?.code || collectionSchema?.collectionName || collectionSchema?.name;
	const databaseName = collectionSchema.compMod?.keyspaceName;
	const fullName = getTableName(tableName, databaseName);

	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => !jsonSchema.compMod)
		.map(([name]) => `ALTER TABLE IF EXISTS ${fullName} DROP COLUMN IF EXISTS \`${name}\`;`);
};

const getModifyColumnScript = app => collection => {
	const _ = app.require('lodash');
	const {
		getTableName,
		checkFieldPropertiesChanged
	} = require('../../utils/general')({ _ });
	const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(_);
	const ddlProvider = require('../../ddlProvider')(null, null, app);

	const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
	const tableName = collectionSchema?.code || collectionSchema?.collectionName || collectionSchema?.name;
	const databaseName = collectionSchema.compMod?.keyspaceName;
	const fullName = getTableName(tableName, databaseName);
	const dbData = { databaseName };

	const renameColumnScripts = _.values(collection.properties)
		.filter(jsonSchema => checkFieldPropertiesChanged(jsonSchema.compMod, ['name']))
		.map(
			jsonSchema =>
				`ALTER TABLE IF EXISTS ${fullName} RENAME COLUMN \`${jsonSchema.compMod.oldField.name}\` TO \`${jsonSchema.compMod.newField.name}\`;`,
		);

	const changeTypeScripts = _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => checkFieldPropertiesChanged(jsonSchema.compMod, ['type', 'mode']))
		.map(([name, jsonSchema]) => {
			const dropColumn = `ALTER TABLE IF EXISTS ${fullName} DROP COLUMN IF EXISTS \`${name}\`;`;

			const script = ddlProvider.convertColumnDefinition(
				createColumnDefinitionBySchema({
					name,
					jsonSchema,
					parentJsonSchema: collectionSchema,
					ddlProvider,
					dbData,
				}),
			);

			const createColumn = `ALTER TABLE IF EXISTS ${fullName} ADD COLUMN IF NOT EXISTS ${script};`;

			return [dropColumn, createColumn].join('\n\n');
		});

	return [...renameColumnScripts, ...changeTypeScripts];
};

const hydrateIndex = (idToNameHashTable, idToActivatedHashTable, ddlProvider) => index => {
	index = setIndexKeys(idToNameHashTable, idToActivatedHashTable, index);

	return ddlProvider.hydrateIndex(index);
};

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

module.exports = {
	getAddCollectionScript,
	getDeleteCollectionScript,
	getModifyCollectionScript,
	getAddColumnScript,
	getDeleteColumnScript,
	getModifyColumnScript,
};
