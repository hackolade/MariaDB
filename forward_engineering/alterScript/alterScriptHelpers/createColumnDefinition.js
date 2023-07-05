const {HydratedColumn} = require('../../ddlProvider/types/hydratedColumn');
const {ColumnDefinition} = require('../../ddlProvider/types/columnDefinition');


module.exports = _ => {

	/**
	 * @param data {ColumnDefinition}
	 * @return {ColumnDefinition}
	 * */
	const createColumnDefinition = data => {
		return Object.assign(
			{
				name: '',
				type: '',
				nullable: true,
				primaryKey: false,
				default: '',
				length: '',
				scale: '',
				precision: '',
				hasMaxLength: false,
			},
			data,
		);
	};

	/**
	 * @param parentSchema {Object}
	 * @param propertyName {string}
	 * @return {boolean}
	 * */
	const isNullable = (parentSchema, propertyName) => {
		if (!Array.isArray(parentSchema.required)) {
			return true;
		}

		return !parentSchema.required.includes(propertyName);
	};

	/**
	 * @return {any}
	 * */
	const getDefault = jsonSchema => {
		const defaultValue = jsonSchema.default;

		if (jsonSchema.default === null) {
			return 'NULL';
		}
		return defaultValue;
	};

	/**
	 * @return {number | string}
	 * */
	const getLength = jsonSchema => {
		if (_.isNumber(jsonSchema.length)) {
			return jsonSchema.length;
		}
		if (_.isNumber(jsonSchema.maxLength)) {
			return jsonSchema.maxLength;
		}
		return '';
	};

	/**
	 * @return {number | string}
	 * */
	const getScale = jsonSchema => {
		if (_.isNumber(jsonSchema.scale)) {
			return jsonSchema.scale;
		}
		return '';
	};

	/**
	 * @return {number | string}
	 * */
	const getPrecision = jsonSchema => {
		if (_.isNumber(jsonSchema.precision)) {
			return jsonSchema.precision;
		}
		if (_.isNumber(jsonSchema.fractSecPrecision)) {
			return jsonSchema.fractSecPrecision;
		}
		return '';
	};

	/**
	 * @return {boolean | string}
	 * */
	const hasMaxLength = jsonSchema => {
		if (jsonSchema.hasMaxLength) {
			return jsonSchema.hasMaxLength;
		}
		return '';
	};

	/**
	 * @return {string}
	 * */
	const getType = jsonSchema => {
		if (jsonSchema.$ref) {
			return jsonSchema.$ref.split('/').pop();
		}

		return jsonSchema.mode || jsonSchema.childType || jsonSchema.type;
	};

	/**
	 * @param name {string}
	 * @param jsonSchema {Object}
	 * @param parentJsonSchema {Object}
	 * @param ddlProvider {any}
	 * @param schemaData {any | undefined}
	 * @return {HydratedColumn}
	 * */
	const createColumnDefinitionBySchema = ({ name, jsonSchema, parentJsonSchema, ddlProvider, schemaData }) => {
		const columnDefinition = createColumnDefinition({
			name: name,
			type: getType(jsonSchema),
			nullable: isNullable(parentJsonSchema, name),
			default: getDefault(jsonSchema),
			primaryKey: jsonSchema.primaryKey,
			length: getLength(jsonSchema),
			scale: getScale(jsonSchema),
			precision: getPrecision(jsonSchema),
			hasMaxLength: hasMaxLength(jsonSchema),
			isActivated: jsonSchema.isActivated,
		});

		return ddlProvider.hydrateColumn({
			columnDefinition,
			jsonSchema,
			dbData: schemaData,
		});
	};

	return {
		createColumnDefinitionBySchema,
	};
};
