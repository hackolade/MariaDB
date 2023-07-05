class CheckConstraint {

    /**
     * @type {string}
     * */
    GUID

    /**
     * @type {boolean}
     * */
    constrCheck

    /**
     * @type {boolean}
     * */
    constrEnforceUpserts

    /**
     * @type {boolean}
     * */
    constrEnforceReplication

    /**
     * @type {string}
     * */
    chkConstrName

    /**
     * @type {string}
     * */
    constrExpression

}

module.exports = {
    CheckConstraint,
}
