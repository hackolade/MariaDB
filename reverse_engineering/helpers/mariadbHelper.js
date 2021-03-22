const DbFunction = require("./parsers/DbFunction");

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
		const func = new DbFunction(query);
		
		func.parse();

		return {
			funcName: f.meta['Name'],
			funcOrReplace: func.orReplace,
			funcAggregate: func.isAggregate,
			funcIfNotExist: func.ifNotExists,
			funcParams: func.parameters,
			funcDataType: func.returnType,
			funcBody: func.body,
			funcLanguage: func.getLanguage(),
			funcDeterministic: func.getDeterministic(),
			funcContains: func.getContains(),
			funcSqlSecurity: f.meta['Security_type'],
			funcComments: f.meta['Comment'],
		};
	});
};

module.exports = {
	parseDatabaseStatement,
	parseFunctions,
};
