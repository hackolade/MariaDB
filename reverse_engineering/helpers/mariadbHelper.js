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
			funcName: f.meta['Name'],
			funcOrReplace: func.orReplace,
			funcAggregate: func.isAggregate,
			funcIfNotExist: func.ifNotExists,
			funcParams: func.parameters,
			funcDataType: func.returnType,
			funcBody: func.body,
			funcLanguage: 'SQL',
			funcDeterministic: functionHelper.getDeterministic(func.characteristics),
			funcContains: functionHelper.getContains(func.characteristics),
			funcSqlSecurity: f.meta['Security_type'],
			funcComments: f.meta['Comment'],
		};
	});
};

const parseProcedures = (procedures) => {
	return procedures.map(procedure => {
		const meta = procedure.meta;
		const data = procedureHelper.parseProcedure(procedure.data[0]['Create Procedure']);
		
		return {
			storedProcName: meta['Name'],
			storedProcOrReplace: data.orReplace,
			storedProcParameters: data.parameters,
			storedProcBody: data.body,
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

module.exports = {
	parseDatabaseStatement,
	parseFunctions,
	parseProcedures,
	getJsonSchema,
};
