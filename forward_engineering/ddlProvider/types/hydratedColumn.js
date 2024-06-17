class HydratedColumn {
	/**
	 * @type {string}
	 * */
	name;

	/**
	 * @type {string}
	 * */
	type;

	/**
	 * @type {boolean}
	 * */
	primaryKey;

	/**
	 * @type {Object}
	 * */
	primaryKeyOptions;

	/**
	 * @type {boolean}
	 * */
	unique;

	/**
	 * @type {Object}
	 * */
	uniqueKeyOptions;

	/**
	 * @type {string}
	 * */
	nullable;

	/**
	 * @type {any}
	 * */
	default;

	/**
	 * @type {string | undefined}
	 * */
	comment;

	/**
	 * @type {boolean}
	 * */
	isActivated;

	/**
	 * @type {number | undefined}
	 * */
	scale;

	/**
	 * @type {number | undefined}
	 * */
	precision;

	/**
	 * @type {string | undefined}
	 * */
	length;

	/**
	 * @type {boolean | undefined}
	 * */
	national;

	/**
	 * @type {boolean | undefined}
	 * */
	autoIncrement;

	/**
	 * @type {boolean | undefined}
	 * */
	zerofill;

	/**
	 * @type {boolean | undefined}
	 * */
	invisible;

	/**
	 * @type {string}
	 * */
	compressionMethod;

	/**
	 * @type {Array<string> | undefined}
	 * */
	enum;

	/**
	 * @type {any}
	 * */
	synonym;

	/**
	 * @type {boolean | undefined}
	 * */
	signed;

	/**
	 * @type {number | undefined}
	 * */
	microSecPrecision;

	/**
	 * @type {string | undefined}
	 * */
	charset;

	/**
	 * @type {string | undefined}
	 * */
	collation;
}

module.exports = {
	HydratedColumn,
};
