
class DbFunction {
	constructor(query) {
		this.query = query;
	}

	parse() {
		const parseRegexp = /create(?<orReplace>\s+or\s+replace)?(?<definer>\s+definer\s*=[\s\S]+?)?(?<aggregate>\s+aggregate)?\s+function(?<ifNotExists>\s+if not exists)?\s+\`(?<funcName>[\s\S]+?)\`\s*\((?<funcParameters>[\s\S]+?)\)\s+returns\s+(?<returnType>[a-z0-9\(\)]+)(?<characteristiсs>[\s\S]+?)?\s+(?<funcBody>return\s+\(([\s\S]+)\)|(BEGIN[\s\S]+END))/i;

		if (!parseRegexp.test(this.query)) {
			return;
		}

		const result = this.query.match(parseRegexp);
		const {
			orReplace,
			definer,
			aggregate,
			ifNotExists,
			funcName,
			funcParameters,
			returnType,
			characteristiсs,
			funcBody,
		} = result.groups;

		this.orReplace = Boolean(orReplace);
		this.definer = definer;
		this.isAggregate = Boolean(aggregate);
		this.ifNotExists = Boolean(ifNotExists);
		this.name = funcName;
		this.parameters = funcParameters;
		this.returnType = returnType;
		this.characteristiсs = characteristiсs || '';
		this.body = funcBody || '';
	}

	getLanguage() {
		return /language sql/i.test(this.characteristiсs) ? 'SQL' : '';
	}

	getDeterministic() {
		if (/not deterministic/i.test(this.characteristiсs)) {
			return 'NOT DETERMINISTIC';
		} else if (/deterministic/i.test(this.characteristiсs)) {
			return 'DETERMINISTIC';
		} else {
			return '';
		}
	}

	getContains() {
		if (/contains\s+sql/i.test(this.characteristiсs)) {
			return 'SQL';
		} else if (/contains\s+no\s+sql/i.test(this.characteristiсs)) {
			return 'NO SQL';
		} else if (/contains\s+reads\s+sql\s+data/i.test(this.characteristiсs)) {
			return 'READS SQL DATA';
		} else if (/contains\s+modifies\s+sql\s+data/i.test(this.characteristiсs)) {
			return 'MODIFIES SQL DATA';
		} else {
			return '';
		}
	}

	getDefiner() {
		if (/SQL\s+SECURITY\s+DEFINER/i.test(this.characteristiсs)) {
			return 'DEFINER';
		} else if (/SQL\s+SECURITY\s+INVOKER/i.test(this.characteristiсs)) {
			return 'INVOKER';
		} else {
			return '';
		}
	}

	getComment() {
		const commentRegexp = /comment\s\'([\s\S]+?)\'/i;

		if (!commentRegexp.test(this.characteristiсs)) {
			return '';
		}

		const result = this.characteristiсs.match(commentRegexp);

		return result[1] || '';
	}
}

module.exports = DbFunction;
