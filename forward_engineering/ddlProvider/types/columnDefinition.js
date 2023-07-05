class ColumnDefinition {
    /**
     * @type {string}
     * */
    name

    /**
     * @type {string}
     * */
    type

    /**
     * @type {boolean}
     * */
    nullable

    primaryKey

    /**
     * @type {string}
     * */
    default

    /**
     * @type {string}
     * */
    length

    /**
     * @type {string}
     * */
    scale

    /**
     * @type {string}
     * */
    precision

    /**
     * @type {boolean}
     * */
    hasMaxLength

    /**
     * @type {boolean | undefined}
     * */
    isActivated

    /**
     * @type {boolean | undefined}
     * */
    unique

    /**
     * @type {boolean | undefined}
     * */
    zerofill

    /**
     * @type {boolean | undefined}
     * */
    autoIncrement

    /**
     * @type {boolean | undefined}
     * */
    invisible

    /**
     * @type {boolean | undefined}
     * */
    national

    /**
     * @type {string | undefined}
     * */
    comment

    /**
     * @type {string | undefined}
     * */
    charset

    /**
     * @type {string | undefined}
     * */
    compressionMethod

    /**
     * @type {boolean | undefined}
     * */
    signed

    /**
     * @type {number | undefined}
     * */
    microSecPrecision

    /**
     * @type {Array<string> | undefined}
     * */
    enum
}

module.exports = {
    ColumnDefinition,
}
