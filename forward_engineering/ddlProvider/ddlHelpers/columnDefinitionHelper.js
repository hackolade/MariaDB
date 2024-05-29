const { ColumnDefinition } = require('../../ddlProvider/types/columnDefinition');
const { HydratedColumn } = require('../../ddlProvider/types/hydratedColumn');

module.exports = (_, wrap) => {
	/**
	 * @param type {string}
	 * @param length {number | string}
	 * @return {string}
	 * */
	const addLength = (type, length) => {
		return `${type}(${length})`;
	};

	/**
	 * @param type {string}
	 * @param precision {number | string}
	 * @param scale {number | string}
	 * @return {string}
	 * */
	const addScalePrecision = (type, precision, scale) => {
		if (_.isNumber(scale)) {
			return `${type}(${precision},${scale})`;
		} else {
			return `${type}(${precision})`;
		}
	};

	/**
	 * @param type {string}
	 * @param precision {number | string}
	 * @return {string}
	 * */
	const addPrecision = (type, precision) => {
		return `${type}(${precision})`;
	};

	/**
	 * @param type {string}
	 * @return {boolean}
	 * */
	const canHaveLength = type => ['CHAR', 'VARCHAR', 'BINARY', 'CHAR BYTE', 'VARBINARY', 'BLOB'].includes(type);

	/**
	 * @param type {string}
	 * @return {boolean}
	 * */
	const isNumeric = type =>
		[
			'TINYINT',
			'SMALLINT',
			'MEDIUMINT',
			'INT',
			'INTEGER',
			'BIGINT',
			'INT1',
			'INT2',
			'INT3',
			'INT4',
			'INT8',
			'FLOAT',
			'DOUBLE',
			'REAL',
			'DECIMAL',
			'DEC',
			'NUMERIC',
			'FIXED',
			'NUMBER',
			'DOUBLE PRECISION',
			'BIT',
		].includes(type);

	/**
	 * @param type {string}
	 * @return {boolean}
	 * */
	const canHavePrecision = type => isNumeric(type);

	/**
	 * @param type {string}
	 * @return {boolean}
	 * */
	const canHaveMicrosecondPrecision = type => ['TIME', 'DATETIME', 'TIMESTAMP'].includes(type);

	/**
	 * @param type {string}
	 * @return {boolean}
	 * */
	const canHaveScale = type =>
		['DECIMAL', 'FLOAT', 'DOUBLE', 'DEC', 'FIXED', 'NUMERIC', 'NUMBER', 'DOUBLE PRECISION', 'REAL'].includes(type);

	/**
	 * @param type {string}
	 * @param columnDefinition {ColumnDefinition | HydratedColumn}
	 * @return {string}
	 * */
	const decorateType = (type, columnDefinition) => {
		if (canHaveLength(type) && _.isNumber(columnDefinition.length)) {
			return addLength(type, columnDefinition.length);
		} else if (canHavePrecision(type) && canHaveScale(type) && _.isNumber(columnDefinition.precision)) {
			return addScalePrecision(type, columnDefinition.precision, columnDefinition.scale);
		} else if (canHavePrecision(type) && _.isNumber(columnDefinition.precision)) {
			return addPrecision(type, columnDefinition.precision);
		} else if (canHaveMicrosecondPrecision(type) && _.isNumber(columnDefinition.microSecPrecision)) {
			return addPrecision(type, columnDefinition.microSecPrecision);
		} else if (['ENUM', 'SET'].includes(type) && !_.isEmpty(columnDefinition.enum)) {
			return `${type}('${columnDefinition.enum.join("', '")}')`;
		}

		return type;
	};

	/**
	 * @param type {string}
	 * @return {boolean}
	 * */
	const isString = type =>
		['CHAR', 'VARCHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'].includes(_.toUpper(type));

	/**
	 * @param type {string}
	 * @return {boolean}
	 * */
	const isDateTime = type => ['TIME', 'DATE', 'DATETIME', 'TIMESTAMP'].includes(type);

	/**
	 * @param str {string}
	 * @return {string}
	 * */
	const escapeQuotes = str => _.trim(str).replace(/(')+/g, "'$1");

	/**
	 * @param type {string}
	 * @param defaultValue {string}
	 * @return {string}
	 * */
	const decorateDefault = (type, defaultValue) => {
		const constantsValues = ['current_timestamp', 'null'];
		if ((isString(type) || isDateTime(type)) && !constantsValues.includes(_.toLower(defaultValue))) {
			return wrap(escapeQuotes(defaultValue));
		}
		return defaultValue;
	};

	/**
	 * @param type {string}
	 * @return {boolean}
	 * */
	const canBeNational = type => {
		return ['CHAR', 'VARCHAR'].includes(type);
	};

	/**
	 * @param type {string}
	 * @param signed {boolean}
	 * @return {string}
	 * */
	const getSign = (type, signed) => {
		if (!isNumeric(type)) {
			return '';
		}

		if (signed === false) {
			return ' UNSIGNED';
		}

		return '';
	};

	/**
	 *
	 * @param {string} type
	 * @returns {boolean}
	 */
	const canHaveAutoIncrement = type => {
		const typesAllowedToHaveAutoIncrement = ['tinyint', 'smallint', 'mediumint', 'int', 'bigint'];
		return typesAllowedToHaveAutoIncrement.includes(type);
	};

	return {
		decorateType,
		decorateDefault,
		canBeNational,
		isNumeric,
		getSign,
		canHaveAutoIncrement,
	};
};
