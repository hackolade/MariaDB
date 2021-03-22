
class DbFunction {
	constructor(query) {
		this.query = query;
	}

	parse() {
		const parseRegexp = /create(?<orReplace>\s+or\s+replace)?(?<definer>\s+definer\s*=[\s\S]+?)?(?<aggregate>\s+aggregate)?\s+function(?<ifNotExists>\s+if not exists)?\s+\`(?<funcName>[\s\S]+?)\`\s*\((?<funcParameters>[\s\S]*?)\)\s+returns\s+(?<returnType>[a-z0-9\(\)]+)(?<characteristics>(\s*language\s+sql)?(\s*(not)?\s+deterministic)?(\s*contains\s+(sql|no\s+sql|reads\s+sql\s+data|modifies\s+sql\s+data))?(\s*sql\s+security\s+(definer|invoker))?(\s*comment\s+\'[\s\S]+?\')?(\s*charset\s+[\S\s]+?)?(\s*COLLATE\s+[\S\s]+?)?)?\s+(?<funcBody>(begin|return)([\s\S]+))/i;

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
			characteristics,
			funcBody,
		} = result.groups;

		this.orReplace = Boolean(orReplace);
		this.definer = definer;
		this.isAggregate = Boolean(aggregate);
		this.ifNotExists = Boolean(ifNotExists);
		this.name = funcName;
		this.parameters = funcParameters;
		this.returnType = returnType;
		this.characteristics = characteristics || '';
		this.body = funcBody || '';
	}

	getLanguage() {
		return /language sql/i.test(this.characteristics) ? 'SQL' : '';
	}

	getDeterministic() {
		if (/not deterministic/i.test(this.characteristics)) {
			return 'NOT DETERMINISTIC';
		} else if (/deterministic/i.test(this.characteristics)) {
			return 'DETERMINISTIC';
		} else {
			return '';
		}
	}

	getContains() {
		if (/contains\s+sql/i.test(this.characteristics)) {
			return 'SQL';
		} else if (/contains\s+no\s+sql/i.test(this.characteristics)) {
			return 'NO SQL';
		} else if (/contains\s+reads\s+sql\s+data/i.test(this.characteristics)) {
			return 'READS SQL DATA';
		} else if (/contains\s+modifies\s+sql\s+data/i.test(this.characteristics)) {
			return 'MODIFIES SQL DATA';
		} else {
			return '';
		}
	}

	getDefiner() {
		if (/SQL\s+SECURITY\s+DEFINER/i.test(this.characteristics)) {
			return 'DEFINER';
		} else if (/SQL\s+SECURITY\s+INVOKER/i.test(this.characteristics)) {
			return 'INVOKER';
		} else {
			return '';
		}
	}

	getComment() {
		const commentRegexp = /comment\s\'([\s\S]+?)\'/i;

		if (!commentRegexp.test(this.characteristics)) {
			return '';
		}

		const result = this.characteristics.match(commentRegexp);

		return result[1] || '';
	}
}

module.exports = DbFunction;
