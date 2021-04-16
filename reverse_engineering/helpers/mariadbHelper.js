const functionHelper = require("./parsers/functionHelper");
const procedureHelper = require("./parsers/procedureHelper");

const parseDatabaseStatement = (statement) => {
	const characterSetRegExp = /CHARACTER\ SET\ (.+?)\ /i;
	const collationRegExp = /COLLATE\ (.+?)\ /i;
	const commentRegExp = /COMMENT\ \'([\s\S]*?)\'/i;
	const data = {};

	if (characterSetRegExp.test(statement)) {
		data.characterSet = statement.match(characterSetRegExp)[1];
	}

	if (collationRegExp.test(statement)) {
		data.collation = statement.match(collationRegExp)[1];
	}

	if (commentRegExp.test(statement)) {
		data.description = statement.match(commentRegExp)[1];
	}

	return data;
};

const parseFunctions = (functions) => {
	return functions.map(f => {
		const query = f.data[0]['Create Function'];
		const func = functionHelper.parseFunctionQuery(query);

		return {
			name: f.meta['Name'],
			functionDelimiter: (func.body || '').includes(';') ? '$$' : '',
			functionOrReplace: func.orReplace,
			functionAggregate: func.isAggregate,
			functionIfNotExist: func.ifNotExists,
			functionArguments: func.parameters,
			functionDataType: func.returnType,
			functionBody: func.body,
			functionLanguage: 'SQL',
			functionDeterministic: functionHelper.getDeterministic(func.characteristics),
			functionContains: functionHelper.getContains(func.characteristics),
			functionSqlSecurity: f.meta['Security_type'],
			functionDescription: f.meta['Comment'],
		};
	});
};

const parseProcedures = (procedures) => {
	return procedures.map(procedure => {
		const meta = procedure.meta;
		const data = procedureHelper.parseProcedure(procedure.data[0]['Create Procedure']);
		
		return {
			name: meta['Name'],
			delimiter: (data.body || '').includes(';') ? '$$' : '',
			orReplace: data.orReplace,
			inputArgs: data.parameters,
			body: data.body,
			storedProcLanguage: 'SQL',
			storedProcDeterministic: data.deterministic,
			storedProcContains: data.contains,
			storedProcSqlSecurity: meta['Security_type'],
			storedProcComments: meta['Comment']
		};
	});
};

const isJson = (columnName, constraints) => {
	return constraints.some(constraint => {
		const check = constraint['CHECK_CLAUSE'];

		if (!/json_valid/i.test(check)) {
			return false;
		}

		return check.includes(`\`${columnName}\``);
	});
};

const getSubtype = (fieldName, records) => {
	const record = records.find(records => {
		if (typeof records[fieldName] !== 'string') {
			return false;
		}

		try {
			return JSON.parse(records[fieldName]);
		} catch (e) {
			return false;
		}
	});

	if (!record) {
		return ' ';
	}

	const item = JSON.parse(record[fieldName]);
 
	if (!item) {
		return ' ';
	}

	if (Array.isArray(item)) {
		return 'array';
	}

	if (typeof item === 'object') {
		return 'object';
	}

	return ' ';
};

const getJsonSchema = ({ columns, constraints, records }) => {
	const properties = columns.filter((column) => {
		return column['Type'] === 'longtext';
	}).reduce((schema, column) => {
		const fieldName = column['Field'];
	
		if (!isJson(fieldName, constraints)) {
			return schema;
		}
		const subtype = getSubtype(fieldName, records);

		return {
			...schema,
			[fieldName]: {
				type: 'char',
				mode: 'longtext',
				synonym: 'json',
				subtype,
			}
		};
	}, {});

	return {
		properties,
	};
};

const getIndexOrder = (collation) => {
	if (collation === 'A') {
		return 'ASC';
	} else if (collation === 'D') {
		return 'DESC';
	} else {
		return null;
	}
};

const getIndexType = (index) => {
	if (index['Key_name'] === 'PRIMARY') {
		return 'PRIMARY';
	} else if (index['Index_type'] === 'FULLTEXT') {
		return 'FULLTEXT';
	} else if (index['Index_type'] === 'SPATIAL') {
		return 'SPATIAL';
	} else if (Number(index['Non_unique']) === 0) {
		return 'UNIQUE';
	} else {
		return 'KEY';
	}
};

const getIndexCategory = (index) => {
	if (index['Index_type'] === 'BTREE') {
		return 'BTREE';
	} else if (index['Index_type'] === 'HASH') {
		return 'HASH';
	} else if (index['Index_type'] === 'RTREE') {
		return 'RTREE';
	} else {
		return '';
	}
};

const parseIndexes = (indexes) => {
	const indexesByConstraint = indexes.filter(index => !['PRIMARY', 'UNIQUE'].includes(getIndexType(index))).reduce((result, index) => {
		const constraintName = index['Key_name'];

		if (result[constraintName]) {
			return {
				...result,
				[constraintName]: {
					...result[constraintName],
					indxKey: result[constraintName].indxKey.concat({
						name: index['Column_name'],
						type: getIndexOrder(index['Collation']),
					}),
				},
			};
		}

		const indexData = {
			indxName: constraintName,
			indexType: getIndexType(index),
			indexCategory: getIndexCategory(index),
			indexComment: index['Index_comment'],
			indxKey: [{
				name: index['Column_name'],
				type: getIndexOrder(index['Collation']),
			}],
		};

		return {
			...result,
			[constraintName]: indexData,
		};
	}, {});

	return Object.values(indexesByConstraint);
};

module.exports = {
	parseDatabaseStatement,
	parseFunctions,
	parseProcedures,
	getJsonSchema,
	parseIndexes,
};
