module.exports = app => {
	const _ = app.require('lodash');
	const {
		getTableName,
		getCompMod,
		modifyGroupItems
	} = require('../../utils/general')({ _ });
	const ddlProvider = require('../../ddlProvider')(null, null, app);
	const { getDbData } = app.require('@hackolade/ddl-fe-utils').general;

	const getAddContainerScript = containerData => {
		const constructedDbData = getDbData([containerData]);
		const dbData = ddlProvider.hydrateDatabase(constructedDbData, {
			udfs: containerData.role?.UDFs,
			procedures: containerData.role?.Procedures,
			useDb: false
		});

		return _.trim(ddlProvider.createDatabase(dbData));
	};

	const getDeleteContainerScript = containerName => {
		return `DROP DATABASE IF EXISTS \`${containerName}\`;`;
	};

	const getModifyContainerScript = containerData => {
		return [modifyCollation(containerData), modifyUdf(containerData), modifyProcedures(containerData)]
			.filter(Boolean)
			.join('\n\n');
	};

	const modifyCollation = containerData => {
		const compMod = getCompMod(containerData);
		const isCharacterSetModified = compMod.characterSet?.new !== compMod.characterSet?.old;
		const isCollationModified = compMod.collation?.new !== compMod.collation?.old;

		if (isCharacterSetModified || isCollationModified) {
			return `ALTER DATABASE \`${containerData.name}\` CHARACTER SET='${containerData.role?.characterSet}' COLLATE='${containerData.role?.collation}';`;
		} else {
			return '';
		}
	};

	const modifyUdf = containerData =>
		modifyGroupItems({
			data: containerData,
			key: 'UDFs',
			hydrate: ddlProvider.hydrateUdf,
			create: ddlProvider.createUdf,
			drop: (databaseName, udf) => `DROP FUNCTION IF EXISTS ${getTableName(udf.name, databaseName)};`,
		});

	const modifyProcedures = containerData =>
		modifyGroupItems({
			data: containerData,
			key: 'Procedures',
			hydrate: ddlProvider.hydrateProcedure,
			create: ddlProvider.createProcedure,
			drop: (databaseName, procedure) =>
				`DROP PROCEDURE IF EXISTS ${getTableName(procedure.name, databaseName)};`,
		});

	return {
		getAddContainerScript,
		getDeleteContainerScript,
		getModifyContainerScript,
	};
};
