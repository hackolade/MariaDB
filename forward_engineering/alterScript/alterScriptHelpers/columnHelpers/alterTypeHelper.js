/**
 * @return {boolean}
 * */
const hasLengthChanged = (collection, oldFieldName, currentJsonSchema) => {
	const oldProperty = collection.role.properties[oldFieldName];

	const previousLength = oldProperty?.length;
	const newLength = currentJsonSchema?.length;
	return previousLength !== newLength;
};

/**
 * @return {boolean}
 * */
const hasPrecisionOrScaleChanged = (collection, oldFieldName, currentJsonSchema) => {
	const oldProperty = collection.role.properties[oldFieldName];

	const previousPrecision = oldProperty?.precision;
	const newPrecision = currentJsonSchema?.precision;
	const previousScale = oldProperty?.scale;
	const newScale = currentJsonSchema?.scale;

	return previousPrecision !== newPrecision || previousScale !== newScale;
};

/**
 * @return {boolean}
 * */
const hasMicroSecPrecisionChanged = (collection, oldFieldName, currentJsonSchema) => {
	const oldProperty = collection.role.properties[oldFieldName];

	const previousMicroSecPrecision = oldProperty?.microSecPrecision;
	const newMicroSecPrecision = currentJsonSchema?.microSecPrecision;
	return previousMicroSecPrecision !== newMicroSecPrecision;
};

/**
 * @return {(columnJsonSchema: Object, collection: Object) => boolean};
 * */
const hasTypeChanged = _ => (columnJsonSchema, collection) => {
	const { checkFieldPropertiesChanged } = require('../../../utils/general')({ _ });
	const hasTypeChanged = checkFieldPropertiesChanged(columnJsonSchema.compMod, ['type', 'mode']);
	if (hasTypeChanged) {
		return true;
	}
	const oldName = columnJsonSchema.compMod.oldField.name;
	const isNewLength = hasLengthChanged(collection, oldName, columnJsonSchema);
	const isNewPrecisionOrScale = hasPrecisionOrScaleChanged(collection, oldName, columnJsonSchema);
	const isNewMicroSecPrecision = hasMicroSecPrecisionChanged(collection, oldName, columnJsonSchema);
	return isNewLength || isNewPrecisionOrScale || isNewMicroSecPrecision;
};

module.exports = {
	hasTypeChanged,
};
